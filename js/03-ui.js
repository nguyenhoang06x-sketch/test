'use strict';
/* =========================================================
   4. Lưu trữ localStorage, giao diện và thông báo
   ========================================================= */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Không đọc được localStorage[${key}]`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Không ghi được localStorage[${key}]`, error);
    const isQuota = error && (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    );
    if (isQuota) {
      toast('Bộ nhớ localStorage đã đầy. Hãy xóa bớt bộ câu hỏi rồi thử lại.', 'error', 7000);
    } else {
      toast('Không thể lưu dữ liệu vào trình duyệt. Kiểm tra quyền lưu trữ của trang.', 'error', 7000);
    }
    return false;
  }
}

/* =========================================================
   Nháp chống mất dữ liệu khi tải lại hoặc đóng tab
   ========================================================= */
function isQuotaExceededError(error) {
  return Boolean(error) && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

function readDraft(key) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    console.warn(`Không đọc được nháp localStorage[${key}]`, error);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null) {
      removeDraftKey(key);
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn(`Nháp localStorage[${key}] bị hỏng, đã xóa`, error);
    removeDraftKey(key);
    return null;
  }
}

function removeDraftKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Không xóa được nháp localStorage[${key}]`, error);
  }
}

// Ghi nháp im lặng: không dùng writeJSON để tránh toast lỗi lặp lại.
function writeDraftJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Không lưu nháp vào localStorage[${key}]`, error);
    if (isQuotaExceededError(error) && !draftQuotaWarned) {
      draftQuotaWarned = true;
      toast('Không lưu nháp được, đừng tải lại trang', 'warning', 8000);
    }
    return false;
  }
}

function cloneDraftQuestions(questions) {
  return questions.map((question) => (
    isDungSaiQuestion(question)
      ? { ...question, items: getQuestionItems(question).map((item) => ({ ...item })) }
      : { ...question, o: Array.isArray(question.o) ? question.o.slice() : question.o }
  ));
}

function normalizeDraftCheckQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type === 'dungsai' ? 'dungsai' : (raw.type === 'tracnghiem' ? 'tracnghiem' : '');
  if (!type) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid('q');
  const q = typeof raw.q === 'string' ? raw.q : '';
  const imageIndex = Number.isInteger(raw.imageIndex) && raw.imageIndex > 0 ? raw.imageIndex : null;

  if (type === 'dungsai') {
    if (!Array.isArray(raw.items) || raw.items.length < 2 || raw.items.length > 6) return null;
    const items = [];
    for (const item of raw.items) {
      if (!item || typeof item !== 'object') return null;
      items.push({
        t: typeof item.t === 'string' ? item.t : '',
        a: item.a === true || item.a === false ? item.a : null,
        e: typeof item.e === 'string' ? item.e : '',
        ai_chon: item.ai_chon === true,
        do_tin_cay: normalizeConfidence(item.do_tin_cay)
      });
    }
    return {
      id,
      type,
      q,
      topic: typeof raw.topic === 'string' ? raw.topic : '',
      items,
      imageIndex
    };
  }

  if (!Array.isArray(raw.o) || raw.o.length !== 4) return null;
  let answer = null;
  if (raw.a !== null && raw.a !== undefined && raw.a !== '') {
    answer = normalizeAnswerIndex(raw.a);
    if (!isValidAnswer(answer)) return null;
  }
  return {
    id,
    type,
    q,
    o: raw.o.map((option) => (typeof option === 'string' ? option : '')),
    a: answer,
    e: typeof raw.e === 'string' ? raw.e : '',
    aiAnswers: raw.aiAnswers === true || raw.ai_chon === true,
    ai_chon: raw.ai_chon === true,
    do_tin_cay: normalizeConfidence(raw.do_tin_cay),
    imageIndex
  };
}

function loadCheckDraft() {
  const raw = readDraft(STORAGE_KEYS.draftCheck);
  if (!raw) return null;
  const savedAt = Number(raw.savedAt);
  if (
    typeof raw !== 'object'
    || raw.version !== CHECK_DRAFT_VERSION
    || !Number.isFinite(savedAt)
    || savedAt <= 0
    || !Array.isArray(raw.questions)
  ) {
    clearCheckDraft();
    return null;
  }

  const questions = [];
  for (const item of raw.questions) {
    const question = normalizeDraftCheckQuestion(item);
    if (!question) {
      clearCheckDraft();
      return null;
    }
    questions.push(question);
  }
  if (!questions.length) {
    clearCheckDraft();
    return null;
  }

  const errors = Array.isArray(raw.errors)
    ? raw.errors
      .filter((error) => error && typeof error === 'object'
        && typeof error.file === 'string' && typeof error.message === 'string')
      .map((error) => ({ file: error.file, message: error.message }))
    : [];
  const type = [1, 2, 3, 4, 5].includes(Number(raw.type)) ? Number(raw.type) : 5;

  return {
    version: CHECK_DRAFT_VERSION,
    savedAt,
    questions,
    name: typeof raw.name === 'string' ? raw.name : '',
    filter: CHECK_FILTERS.includes(raw.filter) ? raw.filter : 'all',
    type,
    allowAIAnswer: typeof raw.allowAIAnswer === 'boolean' ? raw.allowAIAnswer : true,
    errors
  };
}

function saveCheckDraft({ immediate = false } = {}) {
  if (!state.check || state.check.mode !== 'create') return false;
  if (checkDraftTimer) {
    window.clearTimeout(checkDraftTimer);
    checkDraftTimer = null;
  }
  if (immediate) return writeCheckDraftNow();
  checkDraftTimer = window.setTimeout(() => {
    checkDraftTimer = null;
    writeCheckDraftNow();
  }, CHECK_DRAFT_DEBOUNCE_MS);
  return true;
}

function writeCheckDraftNow() {
  const check = state.check;
  if (!check || check.mode !== 'create') return false;
  const payload = {
    version: CHECK_DRAFT_VERSION,
    savedAt: Date.now(),
    questions: cloneDraftQuestions(check.questions),
    name: String(check.name || ''),
    filter: CHECK_FILTERS.includes(check.filter) ? check.filter : 'all',
    type: [1, 2, 3, 4, 5].includes(Number(check.type)) ? Number(check.type) : 5,
    allowAIAnswer: check.allowAIAnswer !== false,
    // Bỏ url vì blob URL và File không còn sau khi tải lại trang.
    errors: (Array.isArray(check.errors) ? check.errors : [])
      .filter((error) => error && typeof error === 'object'
        && typeof error.file === 'string' && typeof error.message === 'string')
      .map((error) => ({ file: error.file, message: error.message }))
  };
  const saved = writeDraftJSON(STORAGE_KEYS.draftCheck, payload);
  if (saved) state.checkDraft = payload;
  return saved;
}

function clearCheckDraft() {
  if (checkDraftTimer) {
    window.clearTimeout(checkDraftTimer);
    checkDraftTimer = null;
  }
  removeDraftKey(STORAGE_KEYS.draftCheck);
  state.checkDraft = null;
}

function normalizeDraftPreparedQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type === 'dungsai' ? 'dungsai' : (raw.type === 'tracnghiem' ? 'tracnghiem' : '');
  if (!type) return null;
  const sourceId = typeof raw.sourceId === 'string' ? raw.sourceId : '';
  const q = typeof raw.q === 'string' ? raw.q : '';
  const imageIndex = Number.isInteger(raw.imageIndex) && raw.imageIndex > 0 ? raw.imageIndex : null;

  if (type === 'dungsai') {
    if (!Array.isArray(raw.items) || raw.items.length < 2 || raw.items.length > 6) return null;
    const items = [];
    for (const item of raw.items) {
      if (!item || typeof item !== 'object' || (item.a !== true && item.a !== false)) return null;
      items.push({
        t: typeof item.t === 'string' ? item.t : '',
        a: item.a,
        e: typeof item.e === 'string' ? item.e : '',
        ai_chon: item.ai_chon === true,
        do_tin_cay: normalizeConfidence(item.do_tin_cay)
      });
    }
    return {
      type,
      sourceId,
      q,
      topic: typeof raw.topic === 'string' ? raw.topic : '',
      items,
      imageIndex
    };
  }

  if (!Array.isArray(raw.o) || raw.o.length !== 4 || !isValidAnswer(raw.a)) return null;
  return {
    type,
    sourceId,
    q,
    o: raw.o.map((option) => (typeof option === 'string' ? option : '')),
    a: raw.a,
    e: typeof raw.e === 'string' ? raw.e : '',
    aiAnswers: raw.aiAnswers === true || raw.ai_chon === true,
    ai_chon: raw.ai_chon === true,
    do_tin_cay: normalizeConfidence(raw.do_tin_cay),
    imageIndex
  };
}

function normalizeDraftSessionAnswer(raw, question) {
  if (isDungSaiQuestion(question)) {
    const items = getQuestionItems(question);
    if (!Array.isArray(raw) || raw.length !== items.length) return undefined;
    if (!raw.every((value) => value === true || value === false || value === null)) return undefined;
    return raw.slice();
  }
  if (raw === null || raw === undefined) return null;
  return isValidAnswer(raw) ? raw : undefined;
}

function loadExamDraft() {
  const raw = readDraft(STORAGE_KEYS.draftExam);
  if (!raw) return null;
  const savedAt = Number(raw.savedAt);
  if (
    typeof raw !== 'object'
    || raw.version !== EXAM_DRAFT_VERSION
    || !Number.isFinite(savedAt)
    || savedAt <= 0
    || !raw.session
    || typeof raw.session !== 'object'
  ) {
    clearExamDraft();
    return null;
  }

  const sessionRaw = raw.session;
  if (!Array.isArray(sessionRaw.questions) || !sessionRaw.questions.length) {
    clearExamDraft();
    return null;
  }
  const questions = [];
  for (const item of sessionRaw.questions) {
    const question = normalizeDraftPreparedQuestion(item);
    if (!question) {
      clearExamDraft();
      return null;
    }
    questions.push(question);
  }

  if (!Array.isArray(sessionRaw.answers) || sessionRaw.answers.length !== questions.length) {
    clearExamDraft();
    return null;
  }
  const answers = [];
  for (let index = 0; index < questions.length; index += 1) {
    const answer = normalizeDraftSessionAnswer(sessionRaw.answers[index], questions[index]);
    if (answer === undefined) {
      clearExamDraft();
      return null;
    }
    answers.push(answer);
  }

  const current = Number(sessionRaw.current);
  const endAt = Number(sessionRaw.endAt);
  const durationMinutes = Number(sessionRaw.durationMinutes);
  if (
    !Number.isInteger(current)
    || current < 0
    || current >= questions.length
    || !Number.isFinite(endAt)
    || endAt <= 0
    || !Number.isFinite(durationMinutes)
    || durationMinutes <= 0
    || sessionRaw.submitted === true
  ) {
    clearExamDraft();
    return null;
  }

  return {
    version: EXAM_DRAFT_VERSION,
    savedAt,
    deckId: typeof raw.deckId === 'string' ? raw.deckId : '',
    deckName: typeof raw.deckName === 'string' ? raw.deckName : '',
    session: {
      questions,
      answers,
      current,
      endAt,
      durationMinutes,
      submitted: false
    }
  };
}

function saveExamDraft() {
  const session = state.session;
  if (!session || session.mode !== 'exam' || session.submitted) return false;
  const payload = {
    version: EXAM_DRAFT_VERSION,
    savedAt: Date.now(),
    deckId: session.deck && typeof session.deck.id === 'string' ? session.deck.id : '',
    deckName: session.deck && typeof session.deck.name === 'string' ? session.deck.name : '',
    session: {
      questions: cloneDraftQuestions(session.questions),
      answers: session.answers.map((answer) => (Array.isArray(answer) ? answer.slice() : answer)),
      current: session.current,
      endAt: session.endAt,
      durationMinutes: session.durationMinutes,
      submitted: false
    }
  };
  const saved = writeDraftJSON(STORAGE_KEYS.draftExam, payload);
  examDraftSaveFailed = !saved;
  if (saved) state.examDraft = payload;
  return saved;
}

function clearExamDraft() {
  removeDraftKey(STORAGE_KEYS.draftExam);
  state.examDraft = null;
  examDraftSaveFailed = false;
}

function resolveDraftDeck(draft) {
  const stored = draft.deckId ? getDeckById(draft.deckId) : null;
  if (stored) return stored;
  return {
    id: '',
    name: String(draft.deckName || '').trim() || 'Bài thi',
    createdAt: '',
    type: 5,
    questions: []
  };
}

function formatDraftSavedAt(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return 'không rõ';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function countExamDraftAnswered(draft) {
  return draft.session.questions.reduce((sum, question, index) => (
    sum + (isSessionAnswerComplete(question, draft.session.answers[index]) ? 1 : 0)
  ), 0);
}

function renderResumeCards() {
  const cards = [];
  const checkDraft = state.checkDraft;
  if (checkDraft) {
    cards.push(`
      <section class="card resume-card" aria-labelledby="resumeCheckTitle">
        <span class="resume-card__icon" aria-hidden="true">${icon('sparkles')}</span>
        <div class="resume-card__body">
          <h2 id="resumeCheckTitle">Có kết quả tách chưa lưu</h2>
          <p>${checkDraft.questions.length} câu · lưu lúc ${esc(formatDraftSavedAt(checkDraft.savedAt))}</p>
        </div>
        <div class="resume-card__actions">
          <button class="btn btn--primary btn--sm" type="button" data-action="resume-check-draft">Khôi phục</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="discard-check-draft">Bỏ nháp</button>
        </div>
      </section>
    `);
  }

  const examDraft = state.examDraft;
  if (examDraft) {
    const total = examDraft.session.questions.length;
    const answered = countExamDraftAnswered(examDraft);
    const remaining = Math.max(0, Math.ceil((examDraft.session.endAt - Date.now()) / 1000));
    cards.push(`
      <section class="card resume-card" aria-labelledby="resumeExamTitle">
        <span class="resume-card__icon" aria-hidden="true">${icon('clock')}</span>
        <div class="resume-card__body">
          <h2 id="resumeExamTitle">Bài thi đang làm dở: ${esc(examDraft.deckName || 'Bài thi')}</h2>
          <p>Đã làm ${answered}/${total} câu · còn ${esc(formatClock(remaining))}</p>
        </div>
        <div class="resume-card__actions">
          <button class="btn btn--primary btn--sm" type="button" data-action="resume-exam-draft">Tiếp tục thi</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="discard-exam-draft">Bỏ bài</button>
        </div>
      </section>
    `);
  }

  return cards.length ? `<div class="resume-cards">${cards.join('')}</div>` : '';
}

function resumeCheckDraft() {
  const draft = state.checkDraft || loadCheckDraft();
  if (!draft) {
    state.checkDraft = null;
    toast('Nháp không còn khả dụng.', 'warning');
    renderHome();
    return;
  }
  clearExamClock();
  state.session = null;
  state.result = null;
  state.setup = null;
  state.check = {
    mode: 'create',
    questions: cloneDraftQuestions(draft.questions),
    errors: draft.errors.map((error) => ({ file: error.file, message: error.message })),
    type: draft.type,
    allowAIAnswer: draft.allowAIAnswer,
    name: draft.name,
    filter: draft.filter
  };
  state.checkDraft = draft;
  renderCheck();
  toast('Đã khôi phục kết quả tách. Ảnh gốc không còn nên không thể thử lại ảnh lỗi.', 'info', 6000);
}

function resumeExamDraft() {
  const draft = state.examDraft || loadExamDraft();
  if (!draft) {
    state.examDraft = null;
    toast('Bài thi đang làm dở không còn khả dụng.', 'warning');
    renderHome();
    return;
  }
  if (Date.now() >= draft.session.endAt) {
    autoSubmitExamDraft(draft);
    return;
  }
  clearExamClock();
  state.result = null;
  state.check = null;
  state.setup = null;
  state.session = {
    mode: 'exam',
    deck: resolveDraftDeck(draft),
    questions: cloneDraftQuestions(draft.session.questions),
    answers: draft.session.answers.map((answer) => (Array.isArray(answer) ? answer.slice() : answer)),
    current: draft.session.current,
    endAt: draft.session.endAt,
    durationMinutes: draft.session.durationMinutes,
    submitted: false
  };
  state.examDraft = null;
  renderExam();
  scrollToTop();
}

function autoSubmitExamDraft(draft) {
  const session = {
    mode: 'exam',
    deck: resolveDraftDeck(draft),
    questions: cloneDraftQuestions(draft.session.questions),
    answers: draft.session.answers.map((answer) => (Array.isArray(answer) ? answer.slice() : answer)),
    current: draft.session.current,
    endAt: draft.session.endAt,
    durationMinutes: draft.session.durationMinutes,
    submitted: false
  };
  clearExamClock();
  const result = buildResult(session, true);
  saveSessionHistory(result);
  state.result = result;
  state.session = null;
  state.examDraft = null;
  renderResult();
  clearExamDraft();
  scrollToTop();
  toast('Bài thi đã hết giờ khi bạn không có mặt, đã tự nộp.', 'warning', 7000);
}

function toast(message, type = 'info', duration = 4500) {
  if (!toastContainer) return;
  const safeTypes = ['success', 'error', 'warning', 'info'];
  const toastType = safeTypes.includes(type) ? type : 'info';
  const element = document.createElement('div');
  element.className = `toast toast--${toastType}`;
  element.setAttribute('role', toastType === 'error' ? 'alert' : 'status');
  element.textContent = String(message);

  while (toastContainer.children.length >= 4) {
    toastContainer.firstElementChild.remove();
  }
  toastContainer.appendChild(element);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    element.classList.add('is-leaving');
    window.setTimeout(() => element.remove(), 220);
  };

  const timer = window.setTimeout(remove, duration);
  element.addEventListener('click', () => {
    window.clearTimeout(timer);
    remove();
  }, { once: true });
}

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (error) {
    console.warn('Không đọc được giao diện đã lưu', error);
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, persist = false) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    } catch (error) {
      toast('Không lưu được lựa chọn giao diện.', 'warning');
    }
  }

  if (themeIcon) {
    themeIcon.innerHTML = icon(nextTheme === 'dark' ? 'sun' : 'moon');
  }
  if (themeToggle) {
    const label = nextTheme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', nextTheme === 'dark' ? '#0b1022' : '#6366f1');
}

function getConfig() {
  const raw = readJSON(STORAGE_KEYS.config, {}) || {};
  const modelsValue = Array.isArray(raw.models) ? raw.models.join(', ') : raw.models;
  return {
    baseUrl: typeof raw.baseUrl === 'string' && raw.baseUrl.trim()
      ? raw.baseUrl.trim()
      : DEFAULT_CONFIG.baseUrl,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
    models: typeof modelsValue === 'string' && modelsValue.trim()
      ? modelsValue.trim()
      : DEFAULT_CONFIG.models
  };
}

function parseModelList(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const models = [];
  source.forEach((item) => {
    const model = String(item || '').trim();
    if (model && !models.includes(model)) models.push(model);
  });
  return models.length ? models : DEFAULT_CONFIG.models.split(',').map((item) => item.trim());
}

function buildEndpoint(baseUrl) {
  let base = String(baseUrl || DEFAULT_CONFIG.baseUrl).trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

/* Giữ lại nội dung người dùng đang gõ trong form cài đặt trước khi render lại. */
function captureSettingsForm() {
  const form = document.getElementById('aiSettingsForm');
  if (!form) return;
  const baseInput = form.querySelector('[name="baseUrl"]');
  const keyInput = form.querySelector('[name="apiKey"]');
  const modelsInput = form.querySelector('[name="models"]');
  if (!baseInput && !keyInput && !modelsInput) return;
  state.cfg = {
    baseUrl: baseInput ? baseInput.value : (state.cfg?.baseUrl || DEFAULT_CONFIG.baseUrl),
    apiKey: keyInput ? keyInput.value : (state.cfg?.apiKey || ''),
    models: modelsInput ? modelsInput.value : (state.cfg?.models || DEFAULT_CONFIG.models)
  };
}

function isAISettingsOpen() {
  return Boolean(aiBubble && aiBubble.classList.contains('is-open'));
}

function setAISettingsOpen(open, { focusToggle = false } = {}) {
  if (!aiBubble || !aiBubbleToggle || !aiSettingsPanel) return;
  const shouldOpen = Boolean(open);
  aiBubble.classList.toggle('is-open', shouldOpen);
  aiBubbleToggle.setAttribute('aria-expanded', String(shouldOpen));
  aiBubbleToggle.setAttribute('aria-label', shouldOpen ? 'Đóng cài đặt AI' : 'Mở cài đặt AI');
  aiBubbleToggle.setAttribute('title', shouldOpen ? 'Đóng cài đặt AI' : 'Cài đặt AI');
  aiSettingsPanel.setAttribute('aria-hidden', String(!shouldOpen));
  if (shouldOpen) {
    aiSettingsPanel.removeAttribute('inert');
  } else {
    aiSettingsPanel.setAttribute('inert', '');
    if (focusToggle) aiBubbleToggle.focus({ preventScroll: true });
  }
}

function openAISettings(focusName = null) {
  setAISettingsOpen(true);
  const field = focusName
    ? document.querySelector(`#aiSettingsForm [name="${focusName}"]`)
    : aiSettingsPanel;
  if (field) {
    window.setTimeout(() => {
      if (isAISettingsOpen()) field.focus({ preventScroll: true });
    }, 90);
  }
}

function closeAISettings() {
  if (!isAISettingsOpen()) return;
  setAISettingsOpen(false, { focusToggle: true });
}

function updateSettingsStatus() {
  const keyInput = document.querySelector('#aiSettingsForm [name="apiKey"]');
  const hasKey = Boolean((keyInput ? keyInput.value : state.cfg?.apiKey || '').trim());
  const pill = document.getElementById('settingsStatus');
  if (pill) {
    pill.textContent = hasKey ? 'Đã có key' : 'Chưa có key';
    pill.className = `status-pill ${hasKey ? 'status-pill--ready' : 'status-pill--missing'}`;
  }
  if (aiBubbleDot) {
    aiBubbleDot.classList.toggle('is-ready', hasKey);
    aiBubbleDot.classList.toggle('is-missing', !hasKey);
    aiBubbleDot.title = hasKey ? 'Đã có API key' : 'Chưa có API key';
  }
}

function hydrateSettingsForm(cfg) {
  const form = document.getElementById('aiSettingsForm');
  if (!form) return;
  const baseInput = form.querySelector('[name="baseUrl"]');
  const keyInput = form.querySelector('[name="apiKey"]');
  const modelsInput = form.querySelector('[name="models"]');
  if (baseInput) baseInput.value = cfg.baseUrl;
  if (keyInput) keyInput.value = cfg.apiKey;
  if (modelsInput) modelsInput.value = cfg.models;
  updateSettingsStatus();
}

function persistSettingsFromForm(announce = false) {
  captureSettingsForm();
  const raw = state.cfg || getConfig();
  const baseUrl = String(raw.baseUrl || '').trim() || DEFAULT_CONFIG.baseUrl;
  const apiKey = String(raw.apiKey || '').trim();
  const models = String(raw.models || '').trim() || DEFAULT_CONFIG.models;

  if (!/^https?:\/\/\S+/i.test(baseUrl)) {
    toast('Địa chỉ API phải bắt đầu bằng http:// hoặc https://', 'error');
    openAISettings('baseUrl');
    return null;
  }

  const config = { baseUrl, apiKey, models };
  state.cfg = config;

  // Đồng bộ lại form để lần render sau không ghi đè cấu hình đã chuẩn hóa.
  const form = document.getElementById('aiSettingsForm');
  if (form) {
    const baseInput = form.querySelector('[name="baseUrl"]');
    const keyInput = form.querySelector('[name="apiKey"]');
    const modelsInput = form.querySelector('[name="models"]');
    if (baseInput) baseInput.value = config.baseUrl;
    if (keyInput) keyInput.value = config.apiKey;
    if (modelsInput) modelsInput.value = config.models;
  }

  const saved = writeJSON(STORAGE_KEYS.config, config);
  updateSettingsStatus();

  if (announce && saved) {
    if (apiKey) {
      toast('Đã lưu cài đặt AI.', 'success');
    } else {
      toast('Đã lưu cài đặt. Bạn vẫn cần nhập API key để đọc ảnh.', 'warning', 5500);
    }
  }
  return config;
}

function getTypeInfo(type) {
  return TYPE_INFO[Number(type)] || TYPE_INFO[1];
}

/* =========================================================
   5. Trang chủ
   ========================================================= */
function renderHome() {
  captureSettingsForm();
  clearExamClock();
  clearPracticeClock();
  state.view = 'home';
  state.setup = null;

  const decks = getDecks();
  const totalQuestions = decks.reduce((sum, deck) => sum + deck.questions.length, 0);
  const canStart = state.selectedImages.length > 0 && !state.processing;
  const historyByDeck = new Map();
  getHistory().forEach((entry) => {
    if (!historyByDeck.has(entry.deckId)) historyByDeck.set(entry.deckId, []);
    historyByDeck.get(entry.deckId).push(entry);
  });

  app.innerHTML = `
    <section class="hero">
      <span class="eyebrow">${icon('sparkles')} AI đọc ảnh đề cương</span>
      <h1>Biến ảnh đề cương thành <span class="gradient-text">bài trắc nghiệm</span> để ôn tập</h1>
      <p>Tải ảnh đề cương, để AI tự nhận dạng từng câu và tách đáp án, rồi luyện tập hoặc thi thử ngay trên trình duyệt. Mọi dữ liệu được lưu trên máy của bạn.</p>
      <div class="hero__stats">
        <span class="hero__stat">${icon('layers')} Tự nhận dạng mọi kiểu câu</span>
        <span class="hero__stat">${icon('play')} Luyện tập tức thì</span>
        <span class="hero__stat">${icon('clock')} Thi thử có hẹn giờ</span>
        <span class="hero__stat">${icon('shield')} Lưu bằng localStorage</span>
      </div>
    </section>

    ${renderResumeCards()}

    <div class="home-grid">
      <section class="card upload-card" aria-labelledby="uploadTitle">
        <div class="upload-card__head">
          <div>
            <h2 id="uploadTitle">Tải ảnh đề cương</h2>
            <p>Chọn một hoặc nhiều ảnh chụp trang đề cương.</p>
          </div>
          <span class="step-label">Bước 1</span>
        </div>

        <input class="file-input" id="imageInput" type="file" accept="image/*" multiple ${state.processing ? 'disabled' : ''}>
        <label class="upload-zone" id="uploadZone" for="imageInput">
          <span class="upload-zone__icon">${icon('upload')}</span>
          <strong>Bấm để chọn ảnh</strong>
          <span>hoặc kéo thả ảnh vào đây · dán bằng Ctrl+V</span>
          <small>Hỗ trợ JPG, PNG, WEBP… · nên chụp rõ nét, đủ sáng</small>
        </label>

        ${renderPreviewArea()}

        <label class="type-option type-option--check auto-answer-option">
          <input id="autoAnswerToggle" type="checkbox" ${state.allowAIAnswer ? 'checked' : ''} ${state.processing ? 'disabled' : ''}>
          <span class="type-option__body">
            <span class="type-option__title">Nếu ảnh chưa có đáp án, để AI tự chọn</span>
            <span class="type-option__desc">Áp dụng cho mọi câu: khi ảnh không có dấu hiệu đáp án, AI sẽ tự chọn đáp án đúng nhất theo kiến thức. Tắt để giữ trống và tự chọn ở màn hình kiểm tra.</span>
          </span>
        </label>

        <p class="upload-lead">${icon('sparkles')} <span>AI tự nhận dạng từng câu: trắc nghiệm A–D, hỏi–đáp, chỉ có câu hỏi hoặc Đúng/Sai. Một ảnh có thể chứa nhiều dạng.</span></p>

        <div class="upload-actions">
          <button class="btn btn--primary btn--large" type="button" data-action="start-extract" ${canStart ? '' : 'disabled'}>
            ${icon('sparkles')} ${state.processing ? 'Đang tách câu hỏi…' : 'Tách câu hỏi bằng AI'}
          </button>
        </div>
        <p class="upload-note">Ảnh được thu nhỏ còn tối đa 1600px trước khi gửi để tiết kiệm token.</p>
        ${renderProcessing()}
      </section>
    </div>

    <section class="card usage-note home-note" aria-labelledby="usageNoteTitle">
      <h3 id="usageNoteTitle">${icon('shield')} Lưu ý khi sử dụng</h3>
      <ul>
        <li>API key chỉ được lưu trong localStorage của trình duyệt này, không nằm trong mã nguồn.</li>
        <li>AI tự nhận dạng từng câu nên một ảnh có thể trộn trắc nghiệm A–D, hỏi–đáp, câu chỉ có câu hỏi và Đúng/Sai.</li>
        <li>AI có thể đọc sai hoặc tự soạn đáp án; hãy kiểm tra kỹ ở màn hình xác nhận trước khi lưu.</li>
        <li>Đề cương được lưu trên máy. Xóa dữ liệu trình duyệt sẽ xóa các bộ câu hỏi.</li>
      </ul>
    </section>

    <section class="decks-section" aria-labelledby="decksTitle">
      <div class="section-heading">
        <div>
          <h2 id="decksTitle">Bộ câu hỏi đã lưu</h2>
          <p>${decks.length ? `${decks.length} bộ · ${totalQuestions} câu hỏi` : 'Chưa có bộ câu hỏi nào trên máy này.'}</p>
        </div>
        <div class="decks-toolbar">
          <input class="file-input" id="importInput" type="file" accept=".json,application/json">
          <button class="btn btn--ghost" type="button" data-action="export-all" ${decks.length ? '' : 'disabled'}>${icon('download')} Xuất tất cả</button>
          <button class="btn btn--soft" type="button" data-action="import-deck">${icon('import')} Nhập bộ câu hỏi</button>
        </div>
      </div>
      ${decks.length
        ? `<div class="deck-list">${decks.map((deck) => renderDeckCard(deck, historyByDeck.get(deck.id) || [])).join('')}</div>`
        : `<div class="empty-state">
            <span class="empty-state__icon">${icon('layers')}</span>
            <h3>Chưa có bộ câu hỏi nào</h3>
            <p>Hãy chọn ảnh đề cương ở phía trên để AI tách câu hỏi, hoặc nhập một tệp .json đã xuất từ ứng dụng.</p>
          </div>`}
    </section>
  `;

  updateSettingsStatus();
}

function renderPreviewArea() {
  if (!state.selectedImages.length) return '';
  return `
    <div class="preview-area">
      <div class="preview-area__head">
        <span>${state.selectedImages.length} ảnh đã chọn · thứ tự từ trái sang phải</span>
        <div class="preview-area__actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="sort-images" ${state.processing || state.selectedImages.length < 2 ? 'disabled' : ''}>${icon('list')} Sắp xếp theo tên</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="clear-images" ${state.processing ? 'disabled' : ''}>Bỏ tất cả</button>
        </div>
      </div>
      <div class="preview-grid">
        ${state.selectedImages.map((item, index) => `
          <article class="preview-item">
            <span class="preview-item__order">Ảnh ${index + 1}</span>
            <img src="${esc(item.url)}" alt="Xem trước ${esc(item.file.name)}" loading="lazy">
            <button class="preview-remove" type="button" data-action="remove-image" data-index="${index}" aria-label="Bỏ ảnh ${esc(item.file.name)}" title="Bỏ ảnh" ${state.processing ? 'disabled' : ''}>${icon('x')}</button>
            <div class="preview-item__meta">
              <span class="preview-item__name" title="${esc(item.file.name)}">${esc(item.file.name)}</span>
              <span class="preview-item__size">${formatFileSize(item.file.size)}</span>
            </div>
            <div class="preview-item__move">
              <button class="preview-move" type="button" data-action="move-image" data-index="${index}" data-delta="-1" aria-label="Đưa ảnh ${index + 1} lên trước" title="Đưa lên trước" ${index === 0 || state.processing ? 'disabled' : ''}>${icon('arrowLeft')}</button>
              <button class="preview-move" type="button" data-action="move-image" data-index="${index}" data-delta="1" aria-label="Đưa ảnh ${index + 1} ra sau" title="Đưa ra sau" ${index === state.selectedImages.length - 1 || state.processing ? 'disabled' : ''}>${icon('arrowRight')}</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderProcessing() {
  if (!state.processing) return '';
  const percent = clamp(Math.round(state.progress.percent || 0), 0, 100);
  return `
    <div class="processing" id="processingBox" role="status" aria-live="polite">
      <div class="processing__row">
        <span class="spinner" aria-hidden="true"></span>
        <div>
          <strong id="processingText">${esc(state.progress.text || 'Đang xử lý…')}</strong>
          <p id="processingDetail">${esc(state.progress.detail || '')}</p>
        </div>
      </div>
      <div class="progress" id="processingTrack" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <span class="progress__bar" id="processingBar" style="width:${percent}%"></span>
      </div>
      <div class="processing__actions">
        <button class="btn btn--danger btn--sm" type="button" data-action="cancel-extraction">${icon('x')} Hủy</button>
      </div>
    </div>
  `;
}

function renderDeckCard(deck, historyEntries = []) {
  const typeInfo = getTypeInfo(deck.type);
  const historySummary = summarizeDeckHistory(historyEntries);
  const totalDuration = formatShortDuration(historySummary ? historySummary.totalDurationSeconds : 0);
  const weakCount = getWeakQuestionIdsFromHistory(historyEntries).length;
  const dsQuestions = deck.questions.filter(isDungSaiQuestion);
  const dsItemCount = dsQuestions.reduce((sum, question) => sum + getQuestionItems(question).length, 0);
  return `
    <article class="deck-card">
      <div class="deck-card__head">
        <span class="deck-card__icon">${icon('layers')}</span>
        <div class="deck-card__title">
          <h3>${esc(deck.name)}</h3>
          <div class="deck-card__meta">
            <span>${icon('help')} ${deck.questions.length} câu</span>
            ${dsQuestions.length ? `<span>${icon('check')} ${dsQuestions.length} câu Đ/S · ${dsItemCount} ý</span>` : ''}
            <span>${icon('calendar')} ${esc(formatDate(deck.createdAt))}</span>
            <span>${icon('sparkles')} ${esc(typeInfo.short)}</span>
          </div>
        </div>
      </div>
      ${historySummary ? `
        <div class="deck-card__history">
          <span>${icon('award')} Cao nhất <strong>${esc(formatScore(historySummary.best.score))}/10</strong></span>
          <span>${icon('clock')} Gần nhất <strong>${esc(formatScore(historySummary.last.score))}/10</strong> · ${esc(formatDate(historySummary.last.date))}</span>
          ${totalDuration ? `<span>${icon('clock')} Đã luyện <strong>${esc(totalDuration)}</strong></span>` : ''}
        </div>
      ` : ''}
      <div class="deck-card__actions">
        <button class="btn btn--primary btn--sm" type="button" data-action="practice-deck" data-id="${esc(deck.id)}">${icon('play')} Luyện tập</button>
        <button class="btn btn--soft btn--sm" type="button" data-action="exam-deck" data-id="${esc(deck.id)}">${icon('clock')} Thi thử</button>
        ${dsQuestions.length ? `<button class="btn btn--soft btn--sm" type="button" data-action="ds-deck" data-id="${esc(deck.id)}">${icon('check')} Luyện Đúng/Sai (${dsQuestions.length})</button>` : ''}
        ${weakCount ? `<button class="btn btn--soft btn--sm" type="button" data-action="review-weak" data-id="${esc(deck.id)}">${icon('refresh')} Ôn các câu hay sai (${weakCount})</button>` : ''}
        <button class="btn btn--soft btn--sm" type="button" data-action="edit-deck" data-id="${esc(deck.id)}">${icon('edit')} Sửa</button>
        <button class="btn btn--ghost btn--sm" type="button" data-action="export-deck" data-id="${esc(deck.id)}">${icon('download')} Xuất .json</button>
        <button class="btn btn--danger btn--sm" type="button" data-action="delete-deck" data-id="${esc(deck.id)}">${icon('trash')} Xóa</button>
      </div>
    </article>
  `;
}

function setProcessing(text, detail, percent) {
  state.progress = {
    text,
    detail,
    percent: clamp(Number(percent) || 0, 0, 100)
  };
  const title = document.getElementById('processingText');
  const description = document.getElementById('processingDetail');
  const bar = document.getElementById('processingBar');
  const track = document.getElementById('processingTrack');
  if (title) title.textContent = text;
  if (description) description.textContent = detail;
  if (bar) bar.style.width = `${state.progress.percent}%`;
  if (track) track.setAttribute('aria-valuenow', String(Math.round(state.progress.percent)));
}

