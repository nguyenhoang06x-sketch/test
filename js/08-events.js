'use strict';
/* =========================================================
   11. Điều hướng và xử lý sự kiện
   ========================================================= */
function goHome(force = false) {
  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return;
  }

  if (!force) {
    if (state.session?.mode === 'exam') {
      if (!window.confirm('Thoát bài thi? Bài làm hiện tại sẽ không được chấm.')) return;
    } else if (state.session?.mode === 'practice') {
      if (!window.confirm('Thoát phiên luyện tập? Tiến độ hiện tại sẽ bị mất.')) return;
    } else if (state.session?.mode === 'dsdrill') {
      if (!window.confirm('Thoát lượt luyện Đúng/Sai? Tiến độ hiện tại sẽ bị mất.')) return;
    } else if (state.check) {
      if (state.check.mode === 'edit') {
        if (isCheckDirty() && !window.confirm('Thoát mà chưa lưu? Các thay đổi với bộ câu hỏi sẽ bị mất.')) return;
      } else if (state.check.questions.length) {
        if (!window.confirm('Rời màn hình kiểm tra? Các câu hỏi đã tách sẽ bị hủy.')) return;
      }
    }
  }

  clearExamClock();
  clearPracticeClock();
  if (state.session?.mode === 'exam') clearExamDraft();
  if (state.check?.mode === 'create') clearCheckDraft();
  cleanupCheckAddImages();
  state.session = null;
  state.result = null;
  state.check = null;
  renderHome();
  scrollToTop();
}

function retryResult() {
  const result = state.result;
  if (!result || !result.deck) return;
  clearPracticeClock();
  if (result.mode === 'dsdrill') {
    startDungSaiDrill(result.deck);
    return;
  }
  openSessionSetup(result.mode === 'exam' ? 'exam' : 'practice', result.deck);
}

function retryWrongQuestions() {
  const result = state.result;
  if (!result || !result.deck) return;
  clearPracticeClock();
  const wrongIds = new Set(result.wrong.map((item) => item.question.sourceId));
  const pool = result.deck.questions.filter((question) => wrongIds.has(question.id));
  if (!pool.length) {
    toast('Không tìm thấy câu sai để làm lại.', 'warning');
    return;
  }
  openSessionSetup('practice', result.deck, pool);
}

function toggleKeyVisibility(button) {
  const input = document.querySelector('#aiSettingsForm [name="apiKey"]');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  if (button) {
    button.innerHTML = icon(show ? 'eyeOff' : 'eye');
    button.setAttribute('aria-label', show ? 'Ẩn API key' : 'Hiện API key');
  }
  input.focus();
}

function onAppClick(event) {
  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) return;
  const action = actionElement.dataset.action;

  if (state.processing && action !== 'cancel-extraction') {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất hoặc bấm Hủy.', 'warning');
    return;
  }

  switch (action) {
    case 'cancel-extraction':
      cancelExtraction();
      break;

    case 'remove-image':
      removeSelectedImage(Number(actionElement.dataset.index));
      break;

    case 'move-image':
      moveSelectedImage(Number(actionElement.dataset.index), Number(actionElement.dataset.delta));
      break;

    case 'sort-images':
      if (state.processing || state.selectedImages.length < 2) return;
      sortSelectedImagesByName();
      renderHome();
      toast('Đã sắp xếp ảnh theo tên tệp.', 'success', 3000);
      break;

    case 'clear-images':
      cleanupSelectedImages();
      renderHome();
      break;

    case 'start-extract':
      startExtraction().catch((error) => {
        console.error(error);
        state.processing = false;
        state.extractionAbort = null;
        toast(`Không thể hoàn tất quá trình tách ảnh: ${shortError(error)}`, 'error', 8000);
        renderHome();
      });
      break;

    case 'retry-failed-images':
      retryFailedImages().catch((error) => {
        console.error(error);
        state.processing = false;
        state.extractionAbort = null;
        toast(`Không thể thử lại ảnh lỗi: ${shortError(error)}`, 'error', 8000);
        renderCheck({ scroll: false });
      });
      break;

    case 'toggle-key':
      toggleKeyVisibility(actionElement);
      break;

    case 'delete-deck':
      deleteDeck(actionElement.dataset.id);
      break;

    case 'practice-deck': {
      const deck = getDeckById(actionElement.dataset.id);
      if (deck) openSessionSetup('practice', deck);
      else toast('Không tìm thấy bộ câu hỏi.', 'error');
      break;
    }

    case 'ds-deck': {
      const deck = getDeckById(actionElement.dataset.id);
      if (deck) startDungSaiDrill(deck);
      else toast('Không tìm thấy bộ câu hỏi.', 'error');
      break;
    }

    case 'ds-new-round':
      startNewDungSaiRound();
      break;

    case 'ds-submit':
      submitDungSaiDrill();
      break;

    case 'exam-deck': {
      const deck = getDeckById(actionElement.dataset.id);
      if (deck) openSessionSetup('exam', deck);
      else toast('Không tìm thấy bộ câu hỏi.', 'error');
      break;
    }

    case 'review-weak': {
      const deck = getDeckById(actionElement.dataset.id);
      if (!deck) {
        toast('Không tìm thấy bộ câu hỏi.', 'error');
        break;
      }
      const weakIds = getWeakQuestionIdsFromHistory(getHistoryForDeck(deck.id));
      const questionsById = new Map(deck.questions.map((question) => [question.id, question]));
      const pool = weakIds.map((id) => questionsById.get(id)).filter(Boolean);
      if (!pool.length) {
        toast('Chưa có câu sai nào trong lịch sử của bộ này.', 'warning');
        break;
      }
      openSessionSetup('practice', deck, pool);
      break;
    }

    case 'setup-count': {
      if (!state.setup) return;
      const mode = actionElement.dataset.mode;
      if (mode !== 'all' && mode !== 'custom' && !SETUP_COUNT_PRESETS.includes(Number(mode))) return;
      const total = state.setup.pool.length;
      state.setup.countMode = mode;
      if (mode === 'all') state.setup.count = total;
      else if (mode === 'custom') state.setup.count = clampSetupCount(state.setup.count, total);
      else state.setup.count = Math.min(Number(mode), total);
      if (state.setup.mode === 'exam') {
        state.setup.durationMinutes = recommendedExamMinutes(resolveSetupCount());
      }
      renderSessionSetup();
      break;
    }

    case 'close-setup':
      closeSessionSetup();
      break;

    case 'confirm-setup':
      confirmSessionSetup();
      break;

    case 'edit-deck':
      openDeckEditor(actionElement.dataset.id);
      break;

    case 'export-deck':
      exportDeck(actionElement.dataset.id);
      break;

    case 'export-all':
      exportAllDecks();
      break;

    case 'import-deck': {
      const input = document.getElementById('importInput');
      if (input) input.click();
      break;
    }

    case 'resume-check-draft':
      resumeCheckDraft();
      break;

    case 'discard-check-draft':
      clearCheckDraft();
      renderHome();
      toast('Đã bỏ nháp.', 'success', 2500);
      break;

    case 'resume-exam-draft':
      resumeExamDraft();
      break;

    case 'discard-exam-draft':
      clearExamDraft();
      renderHome();
      toast('Đã bỏ bài thi đang làm dở.', 'success', 2500);
      break;

    case 'cancel-check':
      cancelCheck();
      break;

    case 'check-filter': {
      if (!state.check) return;
      const filter = actionElement.dataset.filter;
      if (!CHECK_FILTERS.includes(filter)) return;
      state.check.filter = filter;
      renderCheck({ scroll: false });
      saveCheckDraft();
      break;
    }

    case 'jump-missing':
      jumpToMissingAnswer();
      break;

    case 'delete-check-q':
      deleteCheckQuestion(actionElement.dataset.qid);
      break;

    case 'remove-check-image':
      removeCheckAddImage(Number(actionElement.dataset.index));
      break;

    case 'clear-check-images':
      cleanupCheckAddImages();
      renderCheck({ scroll: false });
      break;

    case 'add-questions-from-images':
      addQuestionsFromImages().catch((error) => {
        console.error(error);
        state.processing = false;
        state.extractionAbort = null;
        toast(`Không thể thêm câu hỏi từ ảnh: ${shortError(error)}`, 'error', 8000);
        renderCheck({ scroll: false });
      });
      break;

    case 'add-check-q':
      addCheckQuestion();
      break;

    case 'add-check-ds':
      addDungSaiQuestion();
      break;

    case 'add-ds-item':
      addDungSaiItem(actionElement.dataset.qid);
      break;

    case 'remove-ds-item':
      removeDungSaiItem(actionElement.dataset.qid, Number(actionElement.dataset.index));
      break;

    case 'jump-incomplete': {
      if (!state.check) return;
      const analysis = getCheckAnalysis();
      if (!analysis.firstIncompleteId) return;
      const findCard = () => Array.from(app.querySelectorAll('.check-card[data-qid]'))
        .find((card) => card.dataset.qid === analysis.firstIncompleteId) || null;
      let card = findCard();
      if (!card) {
        state.check.filter = 'all';
        renderCheck({ scroll: false });
        card = findCard();
      }
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const emptyField = Array.from(card.querySelectorAll('[data-field="q"], [data-field="o"], [data-field="item-t"]'))
        .find((field) => !String(field.value || '').trim());
      if (emptyField) emptyField.focus({ preventScroll: true });
      break;
    }

    case 'save-check':
      savePendingCheck();
      break;

    case 'practice-answer':
      choosePracticeAnswer(Number(actionElement.dataset.index));
      break;

    case 'practice-ds-set':
      setPracticeDungSaiItem(Number(actionElement.dataset.index), actionElement.dataset.value === 'true');
      break;

    case 'practice-check-ds':
      revealPracticeDungSai();
      break;

    case 'practice-prev':
      goPrevPractice();
      break;

    case 'practice-next':
      goNextPractice();
      break;

    case 'practice-timer-toggle':
      togglePracticePause();
      break;

    case 'quit-session':
      goHome();
      break;

    case 'exam-answer':
      chooseExamAnswer(Number(actionElement.dataset.index));
      break;

    case 'exam-ds-set':
      chooseExamDungSaiItem(Number(actionElement.dataset.index), actionElement.dataset.value === 'true');
      break;

    case 'exam-jump': {
      const session = state.session;
      if (!session || session.mode !== 'exam') return;
      const index = Number(actionElement.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index >= session.questions.length) return;
      session.current = index;
      saveExamDraft();
      renderExam();
      scrollToTop();
      break;
    }

    case 'exam-prev':
      moveExamQuestion(-1);
      break;

    case 'exam-next':
      moveExamQuestion(1);
      break;

    case 'exam-submit':
      submitExam(false);
      break;

    case 'result-retry':
      retryResult();
      break;

    case 'result-retry-wrong':
      retryWrongQuestions();
      break;

    case 'result-home':
      goHome(true);
      break;

    default:
      break;
  }
}

function onAppChange(event) {
  const target = event.target;

  if (state.processing) {
    if (['imageInput', 'importInput', 'checkAddImageInput'].includes(target.id)) target.value = '';
    return;
  }

  if (target.id === 'imageInput') {
    const files = target.files;
    handleImageSelection(files);
    target.value = '';
    return;
  }

  if (target.id === 'checkAddImageInput') {
    const files = target.files;
    target.value = '';
    handleCheckImageSelection(files);
    return;
  }

  if (target.id === 'importInput') {
    const file = target.files && target.files[0];
    target.value = '';
    if (file) importDeckFile(file);
    return;
  }

  if (target.id === 'checkAddAllowAI' && state.check) {
    state.check.addAllowAI = Boolean(target.checked);
    return;
  }

  if (target.id === 'autoAnswerToggle') {
    state.allowAIAnswer = Boolean(target.checked);
    return;
  }

  if (state.setup && target.id === 'setupShuffleQuestions') {
    state.setup.shuffleQuestions = Boolean(target.checked);
    return;
  }

  if (state.setup && target.id === 'setupShuffleAnswers') {
    state.setup.shuffleAnswers = Boolean(target.checked);
    return;
  }

  if (target.classList.contains('correct-radio') && state.check) {
    const card = target.closest('.check-card');
    if (!card) return;
    const question = state.check.questions.find((item) => item.id === card.dataset.qid);
    if (!question) return;
    question.a = Number(target.value);
    question.ai_chon = false;
    question.aiAnswers = false;
    question.do_tin_cay = '';
    const keepScroll = state.check.filter === 'missing' ? window.scrollY : null;
    renderCheck({ scroll: false });
    saveCheckDraft();
    if (keepScroll !== null) window.scrollTo({ top: keepScroll, behavior: 'auto' });
    return;
  }

  if (target.classList.contains('ds-answer-radio') && state.check) {
    const card = target.closest('.check-card');
    if (!card) return;
    const question = state.check.questions.find((item) => item.id === card.dataset.qid);
    if (!question || !isDungSaiQuestion(question)) return;
    const index = Number(target.dataset.index);
    const items = getQuestionItems(question);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
    const answer = normalizeTruthAnswer(target.value);
    if (typeof answer !== 'boolean') return;
    items[index].a = answer;
    items[index].ai_chon = false;
    items[index].do_tin_cay = '';
    question.aiAnswers = false;
    const keepScroll = state.check.filter === 'missing' ? window.scrollY : null;
    renderCheck({ scroll: false });
    saveCheckDraft();
    if (keepScroll !== null) window.scrollTo({ top: keepScroll, behavior: 'auto' });
  }
}

function onAppInput(event) {
  const target = event.target;

  if (target.name === 'apiKey') {
    updateSettingsStatus();
    return;
  }

  if (state.setup && target.id === 'setupCustomCount') {
    state.setup.countMode = 'custom';
    state.setup.count = Number(target.value);
    updateSetupDurationHint();
    return;
  }

  if (state.setup && target.id === 'setupDuration') {
    state.setup.durationMinutes = Number(target.value);
    return;
  }

  if (!state.check) return;

  if (target.id === 'checkName') {
    state.check.name = target.value;
    saveCheckDraft();
    return;
  }

  const card = target.closest('.check-card');
  if (!card) return;
  const question = state.check.questions.find((item) => item.id === card.dataset.qid);
  if (!question) return;

  const field = target.dataset.field;
  if (field === 'q') {
    question.q = target.value;
  } else if (field === 'o') {
    const index = Number(target.dataset.index);
    if (isValidAnswer(index)) question.o[index] = target.value;
  } else if (field === 'e') {
    question.e = target.value;
  } else if (field === 'topic') {
    question.topic = target.value;
  } else if (field === 'item-t' || field === 'item-e') {
    const index = Number(target.dataset.index);
    const items = getQuestionItems(question);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
    if (field === 'item-t') items[index].t = target.value;
    else items[index].e = target.value;
  }
  updateCheckStatus();
  saveCheckDraft();
}

function onAppSubmit(event) {
  if (event.target.id !== 'aiSettingsForm') return;
  event.preventDefault();
  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return;
  }
  const config = persistSettingsFromForm(true);
  if (config) closeAISettings();
}

function onDragOver(event) {
  const zone = event.target.closest('#uploadZone, #checkAddZone');
  if (!zone || state.processing) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  zone.classList.add('is-dragover');
}

function onDragLeave(event) {
  const zone = event.target.closest('#uploadZone, #checkAddZone');
  if (!zone) return;
  if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
  zone.classList.remove('is-dragover');
}

function onDrop(event) {
  const zone = event.target.closest('#uploadZone, #checkAddZone');
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove('is-dragover');
  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return;
  }
  if (!event.dataTransfer || !event.dataTransfer.files.length) return;
  if (zone.id === 'checkAddZone') {
    handleCheckImageSelection(event.dataTransfer.files);
    return;
  }
  handleImageSelection(event.dataTransfer.files);
}

function bindEvents() {
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
  });

  brandHome.addEventListener('click', () => goHome());

  app.addEventListener('click', onAppClick);
  app.addEventListener('change', onAppChange);
  app.addEventListener('input', onAppInput);
  app.addEventListener('submit', onAppSubmit);
  app.addEventListener('dragover', onDragOver);
  app.addEventListener('dragleave', onDragLeave);
  app.addEventListener('drop', onDrop);

  document.addEventListener('paste', onPaste);

  if (aiBubbleToggle) {
    aiBubbleToggle.addEventListener('click', (event) => {
      if (isAISettingsOpen()) closeAISettings();
      else openAISettings(event.detail === 0 ? 'apiKey' : null);
    });
  }
  if (aiBubble) {
    aiBubble.addEventListener('input', onAppInput);
    aiBubble.addEventListener('submit', onAppSubmit);
    aiBubble.addEventListener('click', (event) => {
      const actionElement = event.target.closest('[data-action="toggle-key"]');
      if (actionElement) toggleKeyVisibility(actionElement);
    });
  }

  document.addEventListener('click', (event) => {
    if (!isAISettingsOpen()) return;
    if (aiBubble && !aiBubble.contains(event.target)) closeAISettings();
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      if (state.setup) {
        event.preventDefault();
        closeSessionSetup();
        return;
      }
      if (isAISettingsOpen()) {
        event.preventDefault();
        closeAISettings();
      }
      return;
    }

    if (state.setup || isAISettingsOpen()) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat) return;

    const target = event.target;
    if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    if (!state.session) return;

    const key = String(event.key || '');
    const upper = key.toUpperCase();

    if (state.session.mode === 'practice') {
      const question = state.session.questions[state.session.current];
      const isDs = isDungSaiQuestion(question);
      if (!isDs) {
        const letterIndex = LETTERS.indexOf(upper);
        const digitIndex = /^[1-4]$/.test(key) ? Number(key) - 1 : -1;
        const index = letterIndex >= 0 ? letterIndex : digitIndex;
        if (index >= 0) {
          event.preventDefault();
          choosePracticeAnswer(index);
          return;
        }
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        goPrevPractice();
        return;
      }
      if (key === 'Enter' || key === 'ArrowRight') {
        if (key === 'Enter' && target && target.closest && target.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        if (isDs && !state.session.revealed?.[state.session.current]) revealPracticeDungSai();
        else goNextPractice();
      }
      return;
    }

    if (state.session.mode === 'dsdrill') {
      const question = state.session.questions[state.session.current];
      if (key === 'ArrowLeft') {
        event.preventDefault();
        goPrevPractice();
        return;
      }
      if (key === 'Enter' || key === 'ArrowRight') {
        if (key === 'Enter' && target && target.closest && target.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        if (!state.session.revealed?.[state.session.current]) revealPracticeDungSai();
        else goNextPractice();
      }
      return;
    }

    if (state.session.mode === 'exam') {
      const question = state.session.questions[state.session.current];
      const isDs = isDungSaiQuestion(question);
      const letterIndex = LETTERS.indexOf(upper);
      if (!isDs && letterIndex >= 0) {
        event.preventDefault();
        chooseExamAnswer(letterIndex);
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        moveExamQuestion(-1);
      } else if (key === 'ArrowRight') {
        event.preventDefault();
        moveExamQuestion(1);
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Tự dừng đồng hồ luyện tập khi rời tab: cộng dồn giờ đang chạy.
      setPracticePaused(true, false);
      saveCheckDraft({ immediate: true });
      saveExamDraft();
      return;
    }
    // Tab hiện lại: chạy tiếp nếu người dùng không chủ động tạm dừng.
    if (isPracticeMode(state.session) && !state.session.pausedByUser) {
      setPracticePaused(false, false);
    }
    checkExamDeadline();
  });

  window.addEventListener('pagehide', () => {
    setPracticePaused(true, false);
    saveCheckDraft({ immediate: true });
    saveExamDraft();
  });

  // Khôi phục từ bfcache: chạy tiếp nếu người dùng không chủ động tạm dừng.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    if (isPracticeMode(state.session) && !state.session.pausedByUser && !document.hidden) {
      setPracticePaused(false, false);
    }
  });

  window.addEventListener('beforeunload', (event) => {
    const examNeedsWarning = state.session?.mode === 'exam' && examDraftSaveFailed;
    const hasUnsavedDeckEdit = state.check?.mode === 'edit' && isCheckDirty();
    if (state.processing || examNeedsWarning || hasUnsavedDeckEdit) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/* =========================================================
   12. Khởi động ứng dụng
   ========================================================= */
function init() {
  state.cfg = getConfig();
  hydrateSettingsForm(state.cfg);
  applyTheme(getSavedTheme(), false);
  bindEvents();
  state.checkDraft = loadCheckDraft();
  state.examDraft = loadExamDraft();
  if (state.examDraft && Date.now() >= state.examDraft.session.endAt) {
    autoSubmitExamDraft(state.examDraft);
    return;
  }
  renderHome();
}

init();
