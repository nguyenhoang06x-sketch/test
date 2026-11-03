'use strict';
/* =========================================================
   9. Chuẩn bị phiên làm bài, luyện tập và kết quả
   ========================================================= */
const SETUP_COUNT_PRESETS = [10, 20, 50];

function recommendedExamMinutes(questionCount) {
  return Math.max(10, questionCount * 0.75);
}

function clampSetupCount(value, total) {
  const number = Number(value);
  if (!Number.isFinite(number)) return total;
  return Math.min(total, Math.max(1, Math.round(number)));
}

function resolveSetupCount() {
  const setup = state.setup;
  if (!setup) return 0;
  const total = setup.pool.length;
  if (setup.countMode === 'all') return total;
  if (setup.countMode === 'custom') {
    const custom = Number(setup.count);
    return Number.isFinite(custom) && custom > 0 ? clampSetupCount(custom, total) : total;
  }
  return clampSetupCount(Number(setup.countMode), total);
}

function openSessionSetup(mode, deck, sourceQuestions = null) {
  if (!deck || !Array.isArray(deck.questions) || !deck.questions.length) {
    toast(mode === 'exam' ? 'Bộ câu hỏi không có dữ liệu để thi thử.' : 'Bộ câu hỏi không có dữ liệu để luyện tập.', 'error');
    return;
  }
  const pool = Array.isArray(sourceQuestions) && sourceQuestions.length ? sourceQuestions : deck.questions;
  if (!pool.length) {
    toast('Không có câu hỏi nào để làm.', 'warning');
    return;
  }

  if (isAISettingsOpen()) closeAISettings();

  state.setup = {
    mode,
    deck,
    pool,
    countMode: 'all',
    count: pool.length,
    shuffleQuestions: true,
    shuffleAnswers: true,
    durationMinutes: mode === 'exam' ? recommendedExamMinutes(pool.length) : null
  };
  renderSessionSetup();
}

function closeSessionSetup() {
  state.setup = null;
  const modal = document.getElementById('sessionSetup');
  if (modal) modal.remove();
}

function renderSessionSetupModal() {
  const setup = state.setup;
  const total = setup.pool.length;
  const count = resolveSetupCount();
  const dsCount = setup.pool.filter(isDungSaiQuestion).length;
  const dsItemCount = setup.pool.reduce((sum, question) => (
    isDungSaiQuestion(question) ? sum + getQuestionItems(question).length : sum
  ), 0);

  return `
    <div class="session-setup" id="sessionSetup" role="dialog" aria-modal="true" aria-labelledby="sessionSetupTitle">
      <button class="session-setup__backdrop" type="button" data-action="close-setup" aria-label="Đóng hộp chọn"></button>
      <div class="card session-setup__panel" tabindex="-1">
        <button class="session-setup__close" type="button" data-action="close-setup" aria-label="Đóng">${icon('x')}</button>
        <div class="session-setup__head">
          <span class="eyebrow">${icon(setup.mode === 'exam' ? 'clock' : 'play')} ${setup.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}</span>
          <h2 id="sessionSetupTitle">${esc(setup.deck.name)}</h2>
          <p>Bộ này có ${total} câu${dsCount ? ` (${dsCount} câu Đúng/Sai · ${dsItemCount} ý)` : ''}. Chọn số câu muốn làm và cách xáo trộn trước khi bắt đầu.</p>
        </div>

        <section class="setup-section" aria-labelledby="setupCountLabel">
          <h3 id="setupCountLabel">Số câu hỏi</h3>
          <div class="setup-chips" role="group" aria-labelledby="setupCountLabel">
            <button class="setup-chip ${setup.countMode === 'all' ? 'is-active' : ''}" type="button" data-action="setup-count" data-mode="all" aria-pressed="${setup.countMode === 'all'}">Tất cả (${total})</button>
            ${SETUP_COUNT_PRESETS.map((preset) => `
              <button class="setup-chip ${setup.countMode === String(preset) ? 'is-active' : ''}" type="button" data-action="setup-count" data-mode="${preset}" aria-pressed="${setup.countMode === String(preset)}" ${preset > total ? 'disabled' : ''}>${preset} câu</button>
            `).join('')}
            <button class="setup-chip ${setup.countMode === 'custom' ? 'is-active' : ''}" type="button" data-action="setup-count" data-mode="custom" aria-pressed="${setup.countMode === 'custom'}">Tự nhập</button>
          </div>
          <div class="setup-custom ${setup.countMode === 'custom' ? '' : 'is-hidden'}">
            <label for="setupCustomCount">Số câu (1–${total})</label>
            <input id="setupCustomCount" type="number" min="1" max="${total}" step="1" value="${esc(count)}" ${setup.countMode === 'custom' ? '' : 'disabled'}>
          </div>
        </section>

        <section class="setup-section" aria-labelledby="setupOrderLabel">
          <h3 id="setupOrderLabel">Thứ tự</h3>
          <label class="setup-toggle">
            <input id="setupShuffleQuestions" type="checkbox" ${setup.shuffleQuestions ? 'checked' : ''}>
            <span>
              <strong>Xáo thứ tự câu hỏi</strong>
              <small>Tắt để giữ đúng thứ tự trong bộ.</small>
            </span>
          </label>
          <label class="setup-toggle">
            <input id="setupShuffleAnswers" type="checkbox" ${setup.shuffleAnswers ? 'checked' : ''}>
            <span>
              <strong>Xáo thứ tự đáp án / các ý</strong>
              <small>Tắt để giữ nguyên vị trí A–D và thứ tự ý a, b, c, d.</small>
            </span>
          </label>
        </section>

        ${setup.mode === 'exam' ? `
          <section class="setup-section" aria-labelledby="setupDurationLabel">
            <h3 id="setupDurationLabel">Thời gian làm bài</h3>
            <div class="setup-duration">
              <input id="setupDuration" type="number" min="0.5" step="0.5" value="${esc(setup.durationMinutes)}" aria-describedby="setupDurationHint">
              <span>phút</span>
            </div>
            <p class="setup-hint" id="setupDurationHint">Mặc định ${formatMinutes(recommendedExamMinutes(count))} phút cho ${count} câu. Bạn có thể tự chỉnh.</p>
          </section>
        ` : ''}

        <div class="session-setup__actions">
          <button class="btn btn--ghost" type="button" data-action="close-setup">Hủy</button>
          <button class="btn btn--primary" type="button" data-action="confirm-setup">
            ${icon(setup.mode === 'exam' ? 'clock' : 'play')} ${setup.mode === 'exam' ? 'Bắt đầu thi' : 'Bắt đầu luyện tập'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderSessionSetup() {
  const existing = document.getElementById('sessionSetup');
  if (existing) existing.remove();
  if (!state.setup) return;
  app.insertAdjacentHTML('beforeend', renderSessionSetupModal());
  const panel = app.querySelector('.session-setup__panel');
  if (panel) panel.focus({ preventScroll: true });
  if (state.setup.countMode === 'custom') {
    const customInput = document.getElementById('setupCustomCount');
    if (customInput) {
      customInput.focus({ preventScroll: true });
      if (typeof customInput.select === 'function') customInput.select();
    }
  }
}

function updateSetupDurationHint() {
  if (!state.setup || state.setup.mode !== 'exam') return;
  const hint = document.getElementById('setupDurationHint');
  if (!hint) return;
  const count = resolveSetupCount();
  hint.textContent = `Mặc định ${formatMinutes(recommendedExamMinutes(count))} phút cho ${count} câu. Bạn có thể tự chỉnh.`;
}

function confirmSessionSetup() {
  const setup = state.setup;
  if (!setup) return;
  const count = resolveSetupCount();
  if (!count) {
    toast('Số câu không hợp lệ.', 'warning');
    return;
  }

  const options = {
    count,
    shuffleQuestions: setup.shuffleQuestions !== false,
    shuffleAnswers: setup.shuffleAnswers !== false
  };
  if (setup.mode === 'exam') {
    const typed = Number(setup.durationMinutes);
    options.durationMinutes = Number.isFinite(typed) && typed > 0
      ? Math.max(0.5, Math.round(typed * 100) / 100)
      : recommendedExamMinutes(count);
  }

  const { mode, deck, pool } = setup;
  closeSessionSetup();
  if (mode === 'exam') startExam(deck, options);
  else startPractice(deck, pool === deck.questions ? null : pool, options);
}

function prepareSessionQuestion(question, shuffleAnswers = true) {
  if (isDungSaiQuestion(question)) {
    const sourceItems = getQuestionItems(question).map((item) => ({
      t: String(item.t || '').trim(),
      a: item.a === true,
      e: String(item.e || '').trim(),
      ai_chon: Boolean(item.ai_chon),
      do_tin_cay: normalizeItemConfidence(item.do_tin_cay, Boolean(item.ai_chon))
    }));
    const items = shuffleAnswers ? shuffle(sourceItems) : sourceItems;
    return {
      type: 'dungsai',
      sourceId: question.id,
      q: String(question.q || '').trim(),
      topic: String(question.topic || '').trim(),
      items,
      imageIndex: question.imageIndex
    };
  }

  const options = Array.isArray(question.o)
    ? question.o.slice(0, 4).map((option) => String(option || '').trim())
    : [];
  while (options.length < 4) options.push('');
  const correctIndex = isValidAnswer(question.a) ? question.a : 0;
  const order = shuffleAnswers ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3];

  return {
    type: 'tracnghiem',
    sourceId: question.id,
    q: String(question.q || '').trim(),
    o: order.map((index) => options[index]),
    a: order.indexOf(correctIndex),
    e: String(question.e || '').trim(),
    aiAnswers: Boolean(question.ai_chon),
    ai_chon: Boolean(question.ai_chon),
    do_tin_cay: normalizeConfidence(question.do_tin_cay),
    imageIndex: question.imageIndex
  };
}

function createEmptySessionAnswer(question) {
  return isDungSaiQuestion(question) ? getQuestionItems(question).map(() => null) : null;
}

function isSessionAnswerComplete(question, answer) {
  if (isDungSaiQuestion(question)) {
    const items = getQuestionItems(question);
    return Array.isArray(answer)
      && answer.length === items.length
      && answer.every((value) => typeof value === 'boolean');
  }
  return isValidAnswer(answer);
}

function countAnsweredSessionItems(question, answer) {
  if (isDungSaiQuestion(question)) {
    return Array.isArray(answer) ? answer.filter((value) => typeof value === 'boolean').length : 0;
  }
  return isValidAnswer(answer) ? 1 : 0;
}

function getSessionQuestionItemCount(question) {
  return isDungSaiQuestion(question) ? getQuestionItems(question).length : 1;
}

// Thang điểm Đúng/Sai kiểu đề THPT: 1/4 ý → 0.1; 2/4 → 0.25; 3/4 → 0.5; 4/4 → 1.
// Với câu có số ý khác 4, nội suy tuyến tính theo tỷ lệ ý đúng giữa các mốc này.
const DS_SCORE_CURVE = [[0, 0], [0.25, 0.1], [0.5, 0.25], [0.75, 0.5], [1, 1]];

function scoreDungSaiByRatio(correctItems, totalItems) {
  if (!totalItems) return 0;
  const ratio = clamp(correctItems / totalItems, 0, 1);
  for (let index = 1; index < DS_SCORE_CURVE.length; index += 1) {
    const [x1, y1] = DS_SCORE_CURVE[index - 1];
    const [x2, y2] = DS_SCORE_CURVE[index];
    if (ratio <= x2) {
      const value = x1 === x2 ? y2 : y1 + ((ratio - x1) / (x2 - x1)) * (y2 - y1);
      return Math.round(value * 100) / 100;
    }
  }
  return 1;
}

function gradeSessionQuestion(question, answer) {
  if (isDungSaiQuestion(question)) {
    const items = getQuestionItems(question);
    const itemResults = items.map((item, index) => {
      const chosen = Array.isArray(answer) ? answer[index] : null;
      return {
        index,
        item,
        chosen: typeof chosen === 'boolean' ? chosen : null,
        isCorrect: typeof chosen === 'boolean' && chosen === item.a
      };
    });
    const correctItems = itemResults.filter((result) => result.isCorrect).length;
    return {
      type: 'dungsai',
      fullyCorrect: items.length > 0 && correctItems === items.length,
      correctItems,
      totalItems: items.length,
      scoreFraction: scoreDungSaiByRatio(correctItems, items.length),
      itemResults
    };
  }

  const correct = isValidAnswer(answer) && answer === question.a;
  return {
    type: 'tracnghiem',
    fullyCorrect: correct,
    correctItems: correct ? 1 : 0,
    totalItems: 1,
    scoreFraction: correct ? 1 : 0,
    itemResults: []
  };
}

function clearExamClock() {
  if (examClock) {
    window.clearInterval(examClock);
    examClock = null;
  }
}

/* ---------- Đồng hồ đếm thời gian luyện tập (chế độ practice/dsdrill) ---------- */
function clearPracticeClock() {
  if (practiceClock) {
    window.clearInterval(practiceClock);
    practiceClock = null;
  }
}

function isPracticeMode(session) {
  return Boolean(session) && (session.mode === 'practice' || session.mode === 'dsdrill');
}

// Thời gian hiện tại = elapsedMs + (runningSince ? Date.now() - runningSince : 0)
function getPracticeElapsedMs(session) {
  if (!session) return 0;
  const elapsed = Number(session.elapsedMs);
  const base = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
  const since = Number(session.runningSince);
  const running = Number.isFinite(since) && since > 0 ? Date.now() - since : 0;
  return base + Math.max(0, running);
}

// mm:ss, quá 1 giờ thì h:mm:ss
function formatPracticeClock(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// "12 phút 05 giây" – dùng cho aria-label và dòng thời gian ở màn kết quả
function describePracticeDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours} giờ ${String(minutes).padStart(2, '0')} phút ${String(secs).padStart(2, '0')} giây`;
  if (minutes > 0) return `${minutes} phút ${String(secs).padStart(2, '0')} giây`;
  return `${secs} giây`;
}

// "1 giờ 25 phút", "12 phút", "dưới 1 phút" – dùng cho dòng tóm tắt của deck-card
function formatShortDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total <= 0) return '';
  if (total < 60) return 'dưới 1 phút';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (!hours) return `${minutes} phút`;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

// Chỉ cập nhật textContent/aria-label của chip, không dựng lại màn hình.
function updatePracticeTimer() {
  const session = state.session;
  if (!isPracticeMode(session)) return false;
  const timer = document.getElementById('practiceTimer');
  if (!timer) return false;
  const ms = getPracticeElapsedMs(session);
  const timeElement = timer.querySelector('[data-time]');
  if (timeElement) timeElement.textContent = formatPracticeClock(ms);
  timer.setAttribute('aria-label', `Đã luyện tập ${describePracticeDuration(ms / 1000)}`);
  const paused = !(Number(session.runningSince) > 0);
  timer.classList.toggle('practice-timer--paused', paused);
  let chipLabel = timer.querySelector('[data-chip-label]');
  if (paused && !chipLabel) {
    chipLabel = document.createElement('span');
    chipLabel.className = 'practice-timer__label';
    chipLabel.setAttribute('data-chip-label', '');
    chipLabel.textContent = 'Tạm dừng';
    timer.appendChild(chipLabel);
  } else if (!paused && chipLabel) {
    chipLabel.remove();
  }
  const toggle = document.querySelector('[data-action="practice-timer-toggle"]');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Tiếp tục tính thời gian luyện tập' : 'Tạm dừng tính thời gian luyện tập');
    const label = toggle.querySelector('[data-label]');
    const iconHost = toggle.querySelector('[data-icon]');
    if (iconHost) iconHost.innerHTML = icon(paused ? 'play' : 'pause');
    if (label) label.textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
  }
  return true;
}

function startPracticeClock() {
  clearPracticeClock();
  practiceClock = window.setInterval(() => {
    const session = state.session;
    const timer = document.getElementById('practiceTimer');
    if (!timer || !isPracticeMode(session) || !(Number(session.runningSince) > 0)) {
      clearPracticeClock();
      return;
    }
    updatePracticeTimer();
  }, 1000);
}

// Gọi ở cuối renderPractice và sau mỗi lần đổi trạng thái tạm dừng.
function syncPracticeClock() {
  const session = state.session;
  if (!isPracticeMode(session)) {
    clearPracticeClock();
    return;
  }
  updatePracticeTimer();
  if (!(Number(session.runningSince) > 0)) {
    clearPracticeClock();
    return;
  }
  if (!practiceClock) startPracticeClock();
}

function setPracticePaused(paused, byUser = false) {
  const session = state.session;
  if (!isPracticeMode(session)) return;
  const running = Number(session.runningSince) > 0;
  if (paused && running) {
    session.elapsedMs = getPracticeElapsedMs(session);
    session.runningSince = null;
  } else if (!paused && !running) {
    session.runningSince = Date.now();
  }
  if (byUser) session.pausedByUser = paused;
  syncPracticeClock();
}

function togglePracticePause() {
  const session = state.session;
  if (!isPracticeMode(session)) return;
  setPracticePaused(Number(session.runningSince) > 0, true);
}

// Chốt thời gian khi kết thúc phiên (cộng dồn phần đang chạy vào elapsedMs).
function finalizePracticeTime(session) {
  if (!isPracticeMode(session)) return 0;
  const ms = getPracticeElapsedMs(session);
  session.elapsedMs = ms;
  session.runningSince = null;
  clearPracticeClock();
  return Math.round(ms / 1000);
}

function selectSessionQuestions(pool, options = {}) {
  const total = pool.length;
  const requested = Number(options.count);
  const count = Number.isFinite(requested) && requested > 0
    ? Math.min(total, Math.max(1, Math.round(requested)))
    : total;
  const ordered = options.shuffleQuestions === false ? pool.slice() : shuffle(pool);
  return ordered.slice(0, count);
}

function startPractice(deck, sourceQuestions = null, options = {}) {
  if (!deck || !Array.isArray(deck.questions) || !deck.questions.length) {
    toast('Bộ câu hỏi không có dữ liệu để luyện tập.', 'error');
    return;
  }
  const pool = sourceQuestions || deck.questions;
  if (!pool.length) {
    toast('Không có câu hỏi nào để làm.', 'warning');
    return;
  }

  clearExamClock();
  clearPracticeClock();
  const questions = selectSessionQuestions(pool, options)
    .map((question) => prepareSessionQuestion(question, options.shuffleAnswers !== false));
  state.result = null;
  state.session = {
    mode: 'practice',
    deck,
    questions,
    answers: questions.map(createEmptySessionAnswer),
    revealed: questions.map(() => false),
    current: 0,
    elapsedMs: 0,
    runningSince: Date.now(),
    pausedByUser: false
  };
  renderPractice();
  scrollToTop();
}

function startExam(deck, options = {}) {
  if (!deck || !Array.isArray(deck.questions) || !deck.questions.length) {
    toast('Bộ câu hỏi không có dữ liệu để thi thử.', 'error');
    return;
  }

  if (state.examDraft || loadExamDraft()) {
    if (!window.confirm('Có bài thi đang làm dở. Bắt đầu bài thi mới sẽ thay thế bài cũ, tiếp tục?')) return;
  }
  clearExamDraft();

  clearExamClock();
  clearPracticeClock();
  const questions = selectSessionQuestions(deck.questions, options)
    .map((question) => prepareSessionQuestion(question, options.shuffleAnswers !== false));
  const typedDuration = Number(options.durationMinutes);
  const durationMinutes = Number.isFinite(typedDuration) && typedDuration > 0
    ? typedDuration
    : recommendedExamMinutes(questions.length);
  state.result = null;
  state.session = {
    mode: 'exam',
    deck,
    questions,
    answers: questions.map(createEmptySessionAnswer),
    current: 0,
    endAt: Date.now() + durationMinutes * 60 * 1000,
    durationMinutes,
    submitted: false
  };
  saveExamDraft();
  renderExam();
  scrollToTop();
}

/* Luyện riêng các câu Đúng/Sai theo từng lượt 10 câu. */
function startDungSaiDrill(deck) {
  if (!deck || !Array.isArray(deck.questions)) {
    toast('Không tìm thấy bộ câu hỏi.', 'error');
    return;
  }
  const dsPool = deck.questions.filter(isDungSaiQuestion);
  if (!dsPool.length) {
    toast('Bộ câu hỏi này không có câu Đúng/Sai.', 'warning');
    return;
  }

  clearExamClock();
  clearPracticeClock();
  const roundSize = Math.min(10, dsPool.length);
  const shuffled = shuffle(dsPool);
  const round = shuffled.slice(0, roundSize);
  const questions = round.map((question) => prepareSessionQuestion(question, true));
  state.result = null;
  state.session = {
    mode: 'dsdrill',
    deck,
    questions,
    answers: questions.map(createEmptySessionAnswer),
    revealed: questions.map(() => false),
    current: 0,
    elapsedMs: 0,
    runningSince: Date.now(),
    pausedByUser: false,
    drillSourceQuestions: dsPool,
    drillRoundSize: roundSize,
    drillRoundNumber: 1
  };
  renderPractice();
  scrollToTop();
}

function startNewDungSaiRound() {
  const session = state.session;
  if (!session || session.mode !== 'dsdrill') return;
  const pool = Array.isArray(session.drillSourceQuestions) ? session.drillSourceQuestions : [];
  if (!pool.length) {
    toast('Không còn câu Đúng/Sai để tạo lượt mới.', 'warning');
    return;
  }

  const roundSize = Math.min(session.drillRoundSize || 10, pool.length);
  let shuffled = shuffle(pool);
  if (pool.length > roundSize) {
    const currentIds = new Set(session.questions.map((question) => question.sourceId));
    const sameRound = shuffled.slice(0, roundSize).every((question) => currentIds.has(question.id));
    if (sameRound) shuffled = shuffled.slice(1).concat(shuffled[0]);
  }

  const questions = shuffled.slice(0, roundSize).map((question) => prepareSessionQuestion(question, true));
  session.questions = questions;
  session.answers = questions.map(createEmptySessionAnswer);
  session.revealed = questions.map(() => false);
  session.current = 0;
  session.drillRoundNumber = (Number(session.drillRoundNumber) || 1) + 1;
  session.elapsedMs = 0;
  session.runningSince = Date.now();
  session.pausedByUser = false;
  clearPracticeClock();
  renderPractice();
  scrollToTop();
  toast(`Đã xáo lượt mới: ${questions.length} câu Đúng/Sai.`, 'success', 3000);
}

function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatMinutes(minutes) {
  const rounded = Math.round(minutes * 100) / 100;
  return String(rounded).replace('.', ',');
}

function renderDungSaiPracticeItem(question, item, index, chosen, revealed) {
  const hasChosen = typeof chosen === 'boolean';
  let className = 'ds-item';
  if (hasChosen) className += ' is-chosen';
  if (revealed) className += item.a === chosen ? ' is-correct' : ' is-wrong';

  const choiceClass = (value) => {
    let classes = `ds-choice ${chosen === value ? 'is-selected' : ''}`;
    if (revealed) {
      if (value === item.a) classes += ' is-answer';
      else if (value === chosen) classes += ' is-picked-wrong';
    }
    return classes;
  };

  return `
    <article class="${className}" data-item-index="${index}">
      <div class="ds-item__head">
        <span class="ds-item__letter" aria-hidden="true">${itemLetter(index)}</span>
        <div class="ds-item__body">
          <div class="ds-item__text">${esc(item.t)}</div>
          <div class="ds-item__tags">
            ${item.ai_chon ? `<span class="tag tag--ai tag--sm">${icon('sparkles')} Đáp án do AI chọn</span>` : ''}
            ${item.do_tin_cay ? renderConfidenceTag(item.do_tin_cay) : ''}
          </div>
        </div>
        ${hasChosen ? `<span class="ds-item__tick" title="Đã chọn">${icon('check')}</span>` : ''}
      </div>

      <div class="ds-item__choices" role="radiogroup" aria-label="Chọn Đúng hoặc Sai cho ý ${itemLetter(index)}">
        <button class="${choiceClass(true)}" type="button" role="radio" aria-checked="${chosen === true}" data-action="practice-ds-set" data-index="${index}" data-value="true" ${revealed ? 'disabled' : ''}>
          ${chosen === true ? icon('check') : ''}<span>Đúng</span>
        </button>
        <button class="${choiceClass(false)}" type="button" role="radio" aria-checked="${chosen === false}" data-action="practice-ds-set" data-index="${index}" data-value="false" ${revealed ? 'disabled' : ''}>
          ${chosen === false ? icon('check') : ''}<span>Sai</span>
        </button>
      </div>

      ${revealed ? `
        <div class="ds-item__result">
          <div class="ds-item__answer-row">
            <span class="ds-item__your ${item.a === chosen ? 'is-correct' : 'is-wrong'}">Bạn chọn: <strong>${truthLabel(chosen)}</strong></span>
            <span class="ds-item__truth">Đáp án đúng: <strong>${truthLabel(item.a)}</strong></span>
          </div>
          ${item.e ? `<p class="ds-item__explain"><strong>${item.ai_chon ? 'Giải thích của AI' : 'Giải thích'}:</strong> ${esc(item.e)}</p>` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

function renderPractice() {
  const session = state.session;
  if (!session || !['practice', 'dsdrill'].includes(session.mode)) {
    renderHome();
    return;
  }
  state.view = 'practice';

  const isDrill = session.mode === 'dsdrill';
  const question = session.questions[session.current];
  const selected = session.answers[session.current];
  const questionIsDs = isDungSaiQuestion(question);
  const revealed = questionIsDs ? Boolean(session.revealed?.[session.current]) : false;
  const answered = isSessionAnswerComplete(question, selected);
  const isCorrect = !questionIsDs && answered && selected === question.a;
  const progressPercent = ((session.current + 1) / session.questions.length) * 100;
  const isLast = session.current === session.questions.length - 1;
  const totalQuestions = session.questions.length;

  let correctCount = 0;
  let wrongCount = 0;
  let checkedCount = 0;
  let dsItemsTotal = 0;
  let dsItemsAnswered = 0;
  session.questions.forEach((item, index) => {
    const answer = session.answers[index];
    if (isDungSaiQuestion(item)) {
      dsItemsTotal += getQuestionItems(item).length;
      dsItemsAnswered += countAnsweredSessionItems(item, answer);
    }
    const isChecked = isDungSaiQuestion(item)
      ? Boolean(session.revealed?.[index])
      : answer !== null && answer !== undefined;
    if (!isChecked) return;
    checkedCount += 1;
    const grade = gradeSessionQuestion(item, answer);
    if (grade.fullyCorrect) correctCount += 1;
    else wrongCount += 1;
  });
  const remainingCount = Math.max(0, totalQuestions - checkedCount);
  const correctPercent = totalQuestions ? (correctCount / totalQuestions) * 100 : 0;
  const wrongPercent = totalQuestions ? (wrongCount / totalQuestions) * 100 : 0;
  const dsSelectedCount = questionIsDs ? countAnsweredSessionItems(question, selected) : 0;
  const dsItemCount = questionIsDs ? getQuestionItems(question).length : 0;
  const dsGrade = questionIsDs && revealed ? gradeSessionQuestion(question, selected) : null;
  const timerPaused = !(Number(session.runningSince) > 0);
  const timerMs = getPracticeElapsedMs(session);

  app.innerHTML = `
    <div class="quiz-wrap">
      <div class="quiz-top">
        <div class="quiz-top__info">
          <h1>${esc(session.deck.name)}</h1>
          <p>${isDrill
            ? `Luyện Đúng/Sai · Lượt ${Number(session.drillRoundNumber) || 1} · ${totalQuestions} câu • ${dsItemsTotal} ý`
            : 'Luyện tập · Chọn đáp án hoặc Đúng/Sai rồi kiểm tra ngay'}</p>
        </div>
        <div class="quiz-actions-top">
          ${isDrill ? `
            <button class="btn btn--ghost btn--sm" type="button" data-action="ds-new-round">${icon('refresh')} Xáo lượt mới</button>
            <button class="btn btn--soft btn--sm" type="button" data-action="ds-submit">${icon('save')} Chấm bài</button>
          ` : ''}
          <button class="btn btn--ghost btn--sm" type="button" data-action="quit-session">${icon('x')} Thoát</button>
        </div>
      </div>

      <section class="card quiz-progress-card" aria-label="Tiến độ luyện tập">
        <div class="quiz-progress-head">
          <span>${isDrill ? `Lượt ${Number(session.drillRoundNumber) || 1}` : 'Tiến độ'} · Câu <strong>${session.current + 1}</strong> / ${session.questions.length}</span>
          <span>${Math.round(progressPercent)}%</span>
        </div>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progressPercent)}">
          <span class="progress__bar" style="width:${progressPercent}%"></span>
        </div>

        <div class="quiz-score">
          <div class="quiz-score__chips">
            <span class="quiz-score__chip quiz-score__chip--good">${icon('check')} Đúng: ${correctCount} câu</span>
            <span class="quiz-score__chip quiz-score__chip--bad">${icon('x')} Sai: ${wrongCount} câu</span>
            <span class="quiz-score__chip quiz-score__chip--left">Còn lại: ${remainingCount} câu</span>
            ${dsItemsTotal ? `<span class="quiz-score__chip quiz-score__chip--left">${dsItemsAnswered}/${dsItemsTotal} ý đã trả lời</span>` : ''}
            <span class="practice-timer ${timerPaused ? 'practice-timer--paused' : ''}" id="practiceTimer" role="timer" aria-live="off" title="Thời gian đã luyện tập" aria-label="Đã luyện tập ${esc(describePracticeDuration(timerMs / 1000))}">
              ${icon('clock')}
              <span class="practice-timer__time" data-time>${esc(formatPracticeClock(timerMs))}</span>
              ${timerPaused ? '<span class="practice-timer__label" data-chip-label>Tạm dừng</span>' : ''}
            </span>
            <button class="btn btn--ghost btn--sm practice-timer__toggle" type="button" data-action="practice-timer-toggle"
              aria-pressed="${timerPaused}" aria-label="${timerPaused ? 'Tiếp tục tính thời gian luyện tập' : 'Tạm dừng tính thời gian luyện tập'}">
              <span data-icon>${icon(timerPaused ? 'play' : 'pause')}</span>
              <span data-label>${timerPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>
          </div>
          <div class="quiz-score__bar" role="img" aria-label="Đúng ${correctCount}, sai ${wrongCount}, còn ${remainingCount} câu">
            <span class="quiz-score__seg quiz-score__seg--good" style="width:${correctPercent}%"></span>
            <span class="quiz-score__seg quiz-score__seg--bad" style="width:${wrongPercent}%"></span>
          </div>
        </div>
      </section>

      <section class="card quiz-question-card" aria-labelledby="practiceQuestion">
        <div class="quiz-progress-head">
          <span>Câu ${session.current + 1}/${session.questions.length}</span>
          ${questionIsDs && question.topic ? `<span class="tag tag--topic">${icon('layers')} ${esc(question.topic)}</span>` : ''}
          ${questionIsDs ? `<span class="tag tag--sm">${icon('check')} ${dsSelectedCount}/${dsItemCount} ý đã trả lời</span>` : ''}
          ${!questionIsDs && question.ai_chon ? `<span class="tag tag--ai tag--sm">${icon('sparkles')} Đáp án do AI chọn</span>` : ''}
        </div>

        ${question.q
          ? `<h2 class="quiz-question" id="practiceQuestion">${esc(question.q)}</h2>`
          : `<p class="quiz-question ds-lead-empty" id="practiceQuestion">Chọn Đúng hoặc Sai cho từng ý dưới đây.</p>`}

        ${questionIsDs ? `
          <div class="ds-item-list">
            ${getQuestionItems(question).map((item, itemIndex) => renderDungSaiPracticeItem(
              question,
              item,
              itemIndex,
              Array.isArray(selected) ? selected[itemIndex] : null,
              revealed
            )).join('')}
          </div>

          <p class="quiz-shortcut">${icon('info')} Chọn Đúng hoặc Sai cho từng ý, sau đó bấm “Kiểm tra câu này”.</p>

          ${dsGrade ? `
            <div class="explanation" role="status" aria-live="polite">
              <span class="explanation__icon">${icon(dsGrade.fullyCorrect ? 'check' : 'info')}</span>
              <div>
                <strong>${dsGrade.fullyCorrect ? 'Chính xác toàn bộ!' : `Đúng ${dsGrade.correctItems}/${dsGrade.totalItems} ý.`}</strong>
                <p>Điểm câu này: <strong>${esc(formatScore(dsGrade.scoreFraction))}</strong> / 1. Xem đáp án và giải thích ở từng ý phía trên.</p>
              </div>
            </div>
          ` : ''}
        ` : `
          <div class="quiz-options">
            ${question.o.map((option, index) => {
              let className = 'quiz-option';
              if (answered) {
                if (index === question.a) className += ' is-correct';
                else if (index === selected) className += ' is-wrong';
                else className += ' is-dimmed';
              }
              return `
                <button class="${className}" type="button" data-action="practice-answer" data-index="${index}" ${answered ? 'disabled' : ''} aria-pressed="${selected === index}">
                  <span class="quiz-option__letter">${LETTERS[index]}</span>
                  <span class="quiz-option__text">${esc(option)}</span>
                </button>
              `;
            }).join('')}
          </div>

          <p class="quiz-shortcut">${icon('info')} Phím tắt: A–D hoặc 1–4 chọn đáp án · Enter/→ sang câu tiếp.</p>

          ${answered ? `
            <div class="explanation" role="status" aria-live="polite">
              <span class="explanation__icon">${icon(isCorrect ? 'check' : 'info')}</span>
              <div>
                <strong>${isCorrect ? 'Chính xác!' : `Chưa chính xác. Đáp án đúng là ${LETTERS[question.a]}.`}</strong>
                <p>${question.e
                  ? `${question.ai_chon ? '<strong>Giải thích của AI:</strong> ' : ''}${esc(question.e)}`
                  : esc(isCorrect ? 'Bạn đã chọn đúng đáp án của câu này.' : 'Hãy xem lại đáp án được viền xanh ở trên.')}</p>
              </div>
            </div>
          ` : ''}
        `}

        <div class="quiz-footer">
          <span class="quiz-footer__hint">${questionIsDs
            ? (revealed
              ? 'Đáp án đã được khóa cho câu này.'
              : (answered ? 'Đã chọn đủ các ý, bấm Kiểm tra câu này.' : `Còn ${Math.max(0, dsItemCount - dsSelectedCount)} ý chưa trả lời.`))
            : (answered ? 'Đáp án đã được khóa cho câu này.' : 'Chọn một đáp án để tiếp tục.')}</span>
          <div class="quiz-footer__actions">
            <button class="btn btn--ghost" type="button" data-action="practice-prev" ${session.current === 0 ? 'disabled' : ''}>${icon('arrowLeft')} Trước</button>
            ${questionIsDs && !revealed ? `
              <button class="btn btn--primary" type="button" data-action="practice-check-ds" ${answered ? '' : 'disabled'}>${icon('check')} Kiểm tra câu này</button>
            ` : `
              <button class="btn btn--primary" type="button" data-action="practice-next" ${(questionIsDs ? revealed : answered) ? '' : 'disabled'}>
                ${isLast ? 'Xem kết quả' : 'Câu tiếp'} ${icon('arrowRight')}
              </button>
            `}
          </div>
        </div>
      </section>
    </div>
  `;

  syncPracticeClock();
}

function choosePracticeAnswer(index) {
  const session = state.session;
  if (!session || !['practice', 'dsdrill'].includes(session.mode)) return;
  const question = session.questions[session.current];
  if (isDungSaiQuestion(question)) return;
  const current = session.answers[session.current];
  if (current !== null && current !== undefined) return;
  if (!isValidAnswer(index)) return;
  session.answers[session.current] = index;
  renderPractice();
}

function setPracticeDungSaiItem(itemIndex, value) {
  const session = state.session;
  if (!session || !['practice', 'dsdrill'].includes(session.mode)) return;
  const question = session.questions[session.current];
  if (!isDungSaiQuestion(question)) return;
  if (session.revealed?.[session.current]) return;
  const items = getQuestionItems(question);
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) return;
  const currentAnswer = Array.isArray(session.answers[session.current])
    ? session.answers[session.current].slice()
    : items.map(() => null);
  currentAnswer[itemIndex] = value === true;
  session.answers[session.current] = currentAnswer;
  const scrollY = window.scrollY;
  renderPractice();
  window.scrollTo({ top: scrollY, behavior: 'auto' });
}

function revealPracticeDungSai() {
  const session = state.session;
  if (!session || !['practice', 'dsdrill'].includes(session.mode)) return;
  const question = session.questions[session.current];
  if (!isDungSaiQuestion(question)) return;
  if (!isSessionAnswerComplete(question, session.answers[session.current])) {
    toast('Hãy chọn Đúng hoặc Sai cho tất cả các ý trước khi kiểm tra.', 'warning');
    return;
  }
  if (!Array.isArray(session.revealed)) session.revealed = session.questions.map(() => false);
  session.revealed[session.current] = true;
  const scrollY = window.scrollY;
  renderPractice();
  window.scrollTo({ top: scrollY, behavior: 'auto' });
}

function goPrevPractice() {
  const session = state.session;
  if (!session || !['practice', 'dsdrill'].includes(session.mode)) return;
  if (session.current <= 0) return;
  session.current -= 1;
  renderPractice();
  scrollToTop();
}

function goNextPractice() {
  const session = state.session;
  if (!session || !['practice', 'dsdrill'].includes(session.mode)) return;
  const question = session.questions[session.current];
  const answer = session.answers[session.current];
  if (isDungSaiQuestion(question)) {
    if (!session.revealed?.[session.current]) return;
  } else if (answer === null || answer === undefined) {
    return;
  }
  if (session.current >= session.questions.length - 1) {
    finishSession();
  } else {
    session.current += 1;
    renderPractice();
    scrollToTop();
  }
}

function submitDungSaiDrill() {
  const session = state.session;
  if (!session || session.mode !== 'dsdrill') return;
  const unanswered = session.questions.filter((question, index) => (
    !isSessionAnswerComplete(question, session.answers[index])
  )).length;
  if (unanswered) {
    const message = `Còn ${unanswered} câu chưa trả lời đủ các ý. Vẫn chấm bài? Các ý chưa trả lời sẽ tính là sai.`;
    if (!window.confirm(message)) return;
  }
  finishSession();
}

function chooseExamAnswer(index) {
  const session = state.session;
  if (!session || session.mode !== 'exam') return;
  const question = session.questions[session.current];
  if (isDungSaiQuestion(question)) return;
  if (!isValidAnswer(index)) return;
  session.answers[session.current] = index;
  saveExamDraft();
  renderExam();
}

function chooseExamDungSaiItem(itemIndex, value) {
  const session = state.session;
  if (!session || session.mode !== 'exam') return;
  const question = session.questions[session.current];
  if (!isDungSaiQuestion(question)) return;
  const items = getQuestionItems(question);
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) return;
  const answer = Array.isArray(session.answers[session.current])
    ? session.answers[session.current].slice()
    : items.map(() => null);
  answer[itemIndex] = value === true;
  session.answers[session.current] = answer;
  saveExamDraft();
  const scrollY = window.scrollY;
  renderExam();
  window.scrollTo({ top: scrollY, behavior: 'auto' });
}

function moveExamQuestion(delta) {
  const session = state.session;
  if (!session || session.mode !== 'exam') return;
  const next = session.current + delta;
  if (next < 0 || next >= session.questions.length) return;
  session.current = next;
  saveExamDraft();
  renderExam();
  scrollToTop();
}

function finishSession() {
  const session = state.session;
  if (!session) return;
  clearExamClock();
  const durationSeconds = finalizePracticeTime(session);
  const result = buildResult(session, false);
  if (isPracticeMode(session)) result.durationSeconds = durationSeconds;
  saveSessionHistory(result);
  state.result = result;
  state.session = null;
  clearPracticeClock();
  renderResult();
  scrollToTop();
}

function buildResult(session, autoSubmitted = false) {
  const wrong = [];
  let correctCount = 0;
  let itemsCorrect = 0;
  let totalItems = 0;
  let scoreSum = 0;
  const parts = {
    tracnghiem: { total: 0, correct: 0, itemsTotal: 0, itemsCorrect: 0, scoreSum: 0 },
    dungsai: { total: 0, correct: 0, itemsTotal: 0, itemsCorrect: 0, scoreSum: 0 }
  };

  session.questions.forEach((question, index) => {
    const chosen = session.answers[index];
    const grade = gradeSessionQuestion(question, chosen);
    const part = grade.type === 'dungsai' ? parts.dungsai : parts.tracnghiem;

    part.total += 1;
    part.itemsTotal += grade.totalItems;
    part.itemsCorrect += grade.correctItems;
    part.scoreSum += grade.scoreFraction;
    if (grade.fullyCorrect) part.correct += 1;

    itemsCorrect += grade.correctItems;
    totalItems += grade.totalItems;
    scoreSum += grade.scoreFraction;

    if (grade.fullyCorrect) {
      correctCount += 1;
    } else {
      wrong.push({
        index,
        chosen,
        question,
        grade
      });
    }
  });

  const total = session.questions.length;
  const score = total ? Math.round((scoreSum / total) * 100) / 10 : 0;
  const scorePct = total ? Math.round(score * 10) : 0;
  const partScore = (part) => (part.total ? Math.round((part.scoreSum / part.total) * 100) / 10 : 0);

  return {
    mode: session.mode,
    deck: session.deck,
    autoSubmitted,
    total,
    correctCount,
    wrongCount: total - correctCount,
    itemsCorrect,
    totalItems,
    score,
    scorePct,
    wrong,
    breakdown: {
      tracnghiem: { ...parts.tracnghiem, score: partScore(parts.tracnghiem) },
      dungsai: { ...parts.dungsai, score: partScore(parts.dungsai) }
    }
  };
}

function renderWrongDungSaiItem(wrongItem) {
  const { grade, question } = wrongItem;
  const items = grade && Array.isArray(grade.itemResults) ? grade.itemResults : [];
  const aiCount = items.filter((result) => result.item && result.item.ai_chon).length;
  return `
    <article class="wrong-item wrong-item--ds">
      <div class="check-card__head">
        <span class="tag">Câu ${wrongItem.index + 1}</span>
        <span class="tag">${icon('check')} Đúng/Sai · ${grade ? `${grade.correctItems}/${grade.totalItems} ý đúng` : ''}</span>
        ${aiCount ? `<span class="tag tag--ai tag--sm">${icon('sparkles')} ${aiCount} ý do AI chọn</span>` : ''}
      </div>
      ${question.q ? `<h3>${esc(question.q)}</h3>` : '<h3 class="muted">Câu Đúng/Sai không có đoạn dẫn.</h3>'}
      ${question.topic ? `<p class="wrong-topic">${icon('layers')} ${esc(question.topic)}</p>` : ''}
      <div class="wrong-ds-list">
        ${items.map((result) => {
          const item = result.item || {};
          return `
            <div class="wrong-ds-item ${result.isCorrect ? 'is-correct' : 'is-wrong'}">
              <div class="wrong-ds-item__head">
                <span class="answer-badge" aria-hidden="true">${itemLetter(result.index)}</span>
                <span class="wrong-ds-item__text">${esc(item.t || '')}</span>
                ${item.ai_chon ? `<span class="tag tag--ai tag--sm">${icon('sparkles')} Đáp án do AI chọn</span>` : ''}
              </div>
              <p class="is-chosen">Bạn chọn: <strong>${esc(truthLabel(result.chosen))}</strong></p>
              <p class="is-correct">Đáp án đúng: <strong>${esc(truthLabel(item.a))}</strong></p>
              ${item.e ? `<p class="wrong-explanation"><strong>${item.ai_chon ? 'Giải thích của AI' : 'Giải thích'}:</strong> ${esc(item.e)}</p>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </article>
  `;
}

function renderWrongMcqItem(wrongItem) {
  const { question } = wrongItem;
  const chosenText = wrongItem.chosen === null || wrongItem.chosen === undefined
    ? 'Chưa trả lời'
    : `${LETTERS[wrongItem.chosen]}. ${question.o[wrongItem.chosen]}`;
  const correctText = `${LETTERS[question.a]}. ${question.o[question.a]}`;
  return `
    <article class="wrong-item">
      <div class="check-card__head">
        <span class="tag">Câu ${wrongItem.index + 1}</span>
        <span class="tag">${icon('help')} Trắc nghiệm</span>
        ${question.ai_chon ? `<span class="tag tag--ai tag--sm">${icon('sparkles')} Đáp án do AI chọn</span>` : ''}
      </div>
      <h3>${esc(question.q)}</h3>
      <p class="is-chosen">Bạn chọn: <strong>${esc(chosenText)}</strong></p>
      <p class="is-correct">Đáp án đúng: <strong>${esc(correctText)}</strong></p>
      ${question.e ? `<p class="wrong-explanation"><strong>${question.ai_chon ? 'Giải thích của AI' : 'Giải thích'}:</strong> ${esc(question.e)}</p>` : ''}
    </article>
  `;
}

function renderResult() {
  const result = state.result;
  if (!result) {
    renderHome();
    return;
  }
  state.view = 'result';
  clearExamClock();
  clearPracticeClock();

  const isExam = result.mode === 'exam';
  const isDrill = result.mode === 'dsdrill';
  const durationSeconds = Math.max(0, Math.round(Number(result.durationSeconds) || 0));
  const durationLine = !isExam && durationSeconds > 0
    ? `Thời gian luyện: ${describePracticeDuration(durationSeconds)}`
    : '';
  const title = isExam
    ? (result.autoSubmitted ? 'Hết giờ – đã nộp bài' : 'Kết quả thi thử')
    : isDrill
      ? 'Hoàn thành luyện Đúng/Sai'
      : 'Hoàn thành luyện tập';
  const subtitle = isExam
    ? `Bài thi thử · ${esc(result.deck.name)}`
    : isDrill
      ? `Luyện Đúng/Sai · ${esc(result.deck.name)}`
      : `Luyện tập · ${esc(result.deck.name)}`;
  const scoreText = Number.isInteger(result.score) ? String(result.score) : result.score.toFixed(1);
  const mcq = result.breakdown?.tracnghiem || { total: 0 };
  const ds = result.breakdown?.dungsai || { total: 0 };
  const hasMcq = mcq.total > 0;
  const hasDs = ds.total > 0;
  const itemsLine = result.totalItems
    ? ` · ${result.itemsCorrect}/${result.totalItems} ý đúng`
    : '';

  app.innerHTML = `
    <div class="result-wrap">
      <section class="card result-card">
        <div class="result-hero">
          <span class="eyebrow">${icon('award')} ${isExam ? 'Thi thử' : isDrill ? 'Luyện Đúng/Sai' : 'Luyện tập'}</span>
          <h1>${esc(title)}</h1>
          <p>${subtitle} · ${result.correctCount}/${result.total} câu đúng hoàn toàn${itemsLine}</p>

          <div class="score-ring" style="--score-pct:${result.scorePct}%" role="img" aria-label="Điểm ${scoreText} trên 10">
            <span class="score-ring__inner">
              <span class="score-ring__score">${esc(scoreText)}<small>/10</small></span>
              <span class="score-ring__label">Điểm của bạn</span>
            </span>
          </div>

          <div class="result-stats">
            <div class="result-stat">
              <strong>${result.total}</strong>
              <span>Tổng số câu</span>
            </div>
            <div class="result-stat result-stat--good">
              <strong>${result.correctCount}</strong>
              <span>Câu đúng hoàn toàn</span>
            </div>
            <div class="result-stat result-stat--bad">
              <strong>${result.wrongCount}</strong>
              <span>Câu cần xem lại</span>
            </div>
          </div>

          ${durationLine ? `<p class="result-duration">${icon('clock')} <span>${esc(durationLine)}</span></p>` : ''}

          ${(hasMcq || hasDs) ? `
            <div class="result-breakdown" aria-label="Điểm theo từng phần">
              ${hasMcq ? `
                <div class="breakdown-card">
                  <span class="breakdown-card__label">${icon('help')} Trắc nghiệm</span>
                  <strong>${mcq.correct}/${mcq.total} câu đúng</strong>
                  <small>${esc(formatScore(mcq.score))}/10 phần này</small>
                </div>
              ` : ''}
              ${hasDs ? `
                <div class="breakdown-card">
                  <span class="breakdown-card__label">${icon('check')} Đúng/Sai</span>
                  <strong>${ds.itemsCorrect}/${ds.itemsTotal} ý đúng</strong>
                  <small>${ds.correct}/${ds.total} câu đúng hoàn toàn · ${esc(formatScore(ds.score))}/10 phần này</small>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="result-actions">
            <button class="btn btn--primary" type="button" data-action="result-retry">${icon('refresh')} Làm lại</button>
            ${result.wrongCount ? `<button class="btn btn--soft" type="button" data-action="result-retry-wrong">${icon('refresh')} Làm lại câu sai</button>` : ''}
            <button class="btn btn--ghost" type="button" data-action="result-home">${icon('home')} Về trang chủ</button>
          </div>
        </div>

        <div class="wrong-section">
          <h2>${icon(result.wrongCount ? 'warning' : 'check')} ${result.wrongCount ? `Câu cần xem lại (${result.wrongCount})` : 'Không có câu sai'}</h2>
          ${result.wrongCount ? `
            <div class="wrong-list">
              ${result.wrong.map((item) => (
                isDungSaiQuestion(item.question)
                  ? renderWrongDungSaiItem(item)
                  : renderWrongMcqItem(item)
              )).join('')}
            </div>
          ` : `
            <div class="result-perfect">
              ${icon('check')}
              <span>Tuyệt vời, bạn đã trả lời đúng tất cả các câu.</span>
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

/* =========================================================
   10. Thi thử có đồng hồ đếm ngược
   ========================================================= */
function renderDungSaiExamItem(item, index, chosen, prefix = 'exam') {
  const hasChosen = typeof chosen === 'boolean';
  const choiceClass = (value) => `ds-choice ${chosen === value ? 'is-selected' : ''}`;
  return `
    <article class="ds-item ${hasChosen ? 'is-chosen' : ''}" data-item-index="${index}">
      <div class="ds-item__head">
        <span class="ds-item__letter" aria-hidden="true">${itemLetter(index)}</span>
        <div class="ds-item__body">
          <div class="ds-item__text">${esc(item.t)}</div>
          <div class="ds-item__tags">
            ${item.ai_chon ? `<span class="tag tag--ai tag--sm">${icon('sparkles')} Đáp án do AI chọn</span>` : ''}
            ${item.do_tin_cay ? renderConfidenceTag(item.do_tin_cay) : ''}
          </div>
        </div>
        ${hasChosen ? `<span class="ds-item__tick" title="Đã chọn">${icon('check')}</span>` : ''}
      </div>

      <div class="ds-item__choices" role="radiogroup" aria-label="Chọn Đúng hoặc Sai cho ý ${itemLetter(index)}">
        <button class="${choiceClass(true)}" type="button" role="radio" aria-checked="${chosen === true}" data-action="${prefix}-ds-set" data-index="${index}" data-value="true">
          ${chosen === true ? icon('check') : ''}<span>Đúng</span>
        </button>
        <button class="${choiceClass(false)}" type="button" role="radio" aria-checked="${chosen === false}" data-action="${prefix}-ds-set" data-index="${index}" data-value="false">
          ${chosen === false ? icon('check') : ''}<span>Sai</span>
        </button>
      </div>
    </article>
  `;
}

function renderExam() {
  const session = state.session;
  if (!session || session.mode !== 'exam') {
    renderHome();
    return;
  }
  if (Date.now() >= session.endAt) {
    submitExam(true);
    return;
  }

  state.view = 'exam';
  clearPracticeClock();
  const question = session.questions[session.current];
  const selected = session.answers[session.current];
  const questionIsDs = isDungSaiQuestion(question);
  const selectedItems = Array.isArray(selected) ? selected : [];
  const dsItemCount = questionIsDs ? getQuestionItems(question).length : 0;
  const dsSelectedCount = questionIsDs ? countAnsweredSessionItems(question, selected) : 0;
  const answeredCount = session.questions.filter((item, index) => (
    isSessionAnswerComplete(item, session.answers[index])
  )).length;
  const answeredPercent = (answeredCount / session.questions.length) * 100;
  let dsItemsTotal = 0;
  let dsItemsAnswered = 0;
  session.questions.forEach((item, index) => {
    if (isDungSaiQuestion(item)) {
      dsItemsTotal += getQuestionItems(item).length;
      dsItemsAnswered += countAnsweredSessionItems(item, session.answers[index]);
    }
  });
  const remainingSeconds = Math.max(0, Math.ceil((session.endAt - Date.now()) / 1000));

  app.innerHTML = `
    <div class="quiz-wrap">
      <div class="quiz-top">
        <div class="quiz-top__info">
          <h1>${esc(session.deck.name)}</h1>
          <p>Thi thử · ${session.questions.length} câu · Thời lượng ${formatMinutes(session.durationMinutes)} phút</p>
        </div>
        <div class="quiz-actions-top">
          <div class="timer-chip ${remainingSeconds <= 60 ? 'is-urgent' : ''}" id="examTimer" title="Thời gian còn lại">
            ${icon('clock')} <span data-time>${formatClock(remainingSeconds)}</span>
          </div>
          <button class="btn btn--ghost btn--sm" type="button" data-action="quit-session">${icon('x')} Thoát</button>
        </div>
      </div>

      <section class="card quiz-progress-card" aria-label="Tiến độ trả lời">
        <div class="quiz-progress-head">
          <span>Đã trả lời <strong>${answeredCount}</strong> / ${session.questions.length} câu${dsItemsTotal ? ` · ${dsItemsAnswered}/${dsItemsTotal} ý Đúng/Sai` : ''}</span>
          <span>${Math.round(answeredPercent)}%</span>
        </div>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(answeredPercent)}">
          <span class="progress__bar" style="width:${answeredPercent}%"></span>
        </div>
      </section>

      <div class="exam-layout">
        <section class="card exam-main-card" aria-labelledby="examQuestion">
          <div class="quiz-progress-head">
            <span>Câu ${session.current + 1} / ${session.questions.length}</span>
            ${questionIsDs && getQuestionTopic(question) ? `<span class="tag tag--topic">${icon('layers')} ${esc(getQuestionTopic(question))}</span>` : ''}
            ${questionIsDs ? `<span class="tag tag--sm">${icon('check')} ${dsSelectedCount}/${dsItemCount} ý đã trả lời</span>` : ''}
            ${questionHasAiChosen(question) ? `<span class="tag tag--ai tag--sm">${icon('sparkles')} Đáp án do AI chọn</span>` : ''}
          </div>
          ${questionIsDs
            ? (question.q
              ? `<h2 class="quiz-question" id="examQuestion">${esc(question.q)}</h2>`
              : `<p class="quiz-question ds-lead-empty" id="examQuestion">Chọn Đúng hoặc Sai cho từng ý dưới đây.</p>`)
            : `<h2 class="quiz-question" id="examQuestion">${esc(question.q)}</h2>`}

          ${questionIsDs ? `
            <div class="ds-item-list">
              ${getQuestionItems(question).map((item, itemIndex) => renderDungSaiExamItem(
                item,
                itemIndex,
                selectedItems[itemIndex],
                'exam'
              )).join('')}
            </div>

            <p class="quiz-shortcut">${icon('info')} Chọn Đúng hoặc Sai cho từng ý · ←/→ đổi câu.</p>
          ` : `
            <div class="quiz-options">
              ${question.o.map((option, index) => `
                <button class="quiz-option ${selected === index ? 'is-selected' : ''}" type="button" data-action="exam-answer" data-index="${index}" aria-pressed="${selected === index}">
                  <span class="quiz-option__letter">${LETTERS[index]}</span>
                  <span class="quiz-option__text">${esc(option)}</span>
                </button>
              `).join('')}
            </div>

            <p class="quiz-shortcut">${icon('info')} Phím tắt: A–D chọn đáp án · ←/→ đổi câu.</p>
          `}

          <div class="exam-nav">
            <button class="btn btn--ghost" type="button" data-action="exam-prev" ${session.current === 0 ? 'disabled' : ''}>${icon('arrowLeft')} Câu trước</button>
            <button class="btn btn--soft" type="button" data-action="exam-next" ${session.current === session.questions.length - 1 ? 'disabled' : ''}>Câu tiếp ${icon('arrowRight')}</button>
          </div>
        </section>

        <aside class="card exam-side" aria-label="Bảng số câu và nộp bài">
          <h2>${icon('list')} Bảng số câu</h2>
          <div class="exam-grid">
            ${session.questions.map((item, index) => `
              <button class="exam-grid__btn ${index === session.current ? 'is-current' : ''} ${isSessionAnswerComplete(item, session.answers[index]) ? 'is-answered' : ''}" type="button" data-action="exam-jump" data-index="${index}" aria-label="Đến câu ${index + 1}" title="Câu ${index + 1}">${index + 1}</button>
            `).join('')}
          </div>
          <div class="exam-side__divider"></div>
          <div class="exam-side__legend">
            <span><span class="legend-dot legend-dot--answered"></span>Đã trả lời</span>
            <span><span class="legend-dot legend-dot--current"></span>Đang xem</span>
          </div>
          <button class="btn btn--primary" type="button" data-action="exam-submit">${icon('save')} Nộp bài</button>
        </aside>
      </div>
    </div>
  `;

  startExamClock();
}

function startExamClock() {
  clearExamClock();
  updateExamTimer();
  examClock = window.setInterval(() => {
    const session = state.session;
    if (!session || session.mode !== 'exam') {
      clearExamClock();
      return;
    }
    if (Date.now() >= session.endAt) {
      submitExam(true);
      return;
    }
    updateExamTimer();
  }, 1000);
}

function updateExamTimer() {
  const session = state.session;
  if (!session || session.mode !== 'exam') return;
  const timer = document.getElementById('examTimer');
  if (!timer) return;
  const seconds = Math.max(0, Math.ceil((session.endAt - Date.now()) / 1000));
  const timeElement = timer.querySelector('[data-time]');
  if (timeElement) timeElement.textContent = formatClock(seconds);
  timer.classList.toggle('is-urgent', seconds <= 60);
}

function submitExam(auto = false) {
  const session = state.session;
  if (!session || session.mode !== 'exam' || session.submitted) return;

  if (!auto) {
    const unanswered = session.questions.filter((question, index) => (
      !isSessionAnswerComplete(question, session.answers[index])
    )).length;
    const message = unanswered
      ? `Còn ${unanswered} câu chưa trả lời đủ. Bạn vẫn muốn nộp bài? Các ý chưa trả lời sẽ tính là sai.`
      : `Nộp bài thi thử? Bạn đã trả lời ${session.questions.length}/${session.questions.length} câu.`;
    if (!window.confirm(message)) return;
  }

  session.submitted = true;
  clearExamClock();
  const result = buildResult(session, auto);
  saveSessionHistory(result);
  clearExamDraft();
  state.result = result;
  state.session = null;
  renderResult();
  scrollToTop();
  if (auto) {
    toast('Đã hết giờ. Bài thi được nộp tự động và đã chấm điểm.', 'warning', 6000);
  }
}

function checkExamDeadline() {
  const session = state.session;
  if (!session || session.mode !== 'exam') return;
  if (Date.now() >= session.endAt) {
    submitExam(true);
  } else {
    updateExamTimer();
  }
}

