'use strict';
/* =========================================================
   7. Màn hình kiểm tra câu hỏi sau khi AI tách
   ========================================================= */
function isQuestionIncomplete(question) {
  if (!question) return true;
  if (isDungSaiQuestion(question)) {
    const items = getQuestionItems(question);
    if (items.length < 2 || items.length > 6) return true;
    return items.some((item) => !item || !String(item.t || '').trim());
  }
  if (!String(question.q || '').trim()) return true;
  if (!Array.isArray(question.o) || question.o.length !== 4) return true;
  return question.o.some((option) => !String(option || '').trim());
}

function normalizeQuestionForComparison(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function getDuplicateQuestionIds(questions) {
  const groups = new Map();
  questions.forEach((question) => {
    const key = normalizeQuestionForComparison(question.q);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(question);
  });

  const duplicates = new Set();
  groups.forEach((group) => {
    if (group.length < 2) return;
    const imageKeys = new Set();
    group.forEach((question) => {
      if (Number.isInteger(question.imageIndex) && question.imageIndex > 0) {
        imageKeys.add(`image:${question.imageIndex}`);
      } else {
        // Câu nhập tay không có imageIndex vẫn được coi là một nguồn riêng
        // để câu mới tách từ ảnh trùng với câu cũ vẫn bị đánh dấu.
        imageKeys.add('manual');
      }
    });
    if (imageKeys.size < 2) return;
    group.forEach((question) => duplicates.add(question.id));
  });
  return duplicates;
}

function getCheckAnalysis() {
  const questions = state.check?.questions || [];
  const missingList = questions.filter(isQuestionMissingAnswer);
  const unanswered = missingList.length;
  const unansweredItems = questions.reduce((sum, question) => sum + countMissingAnswerItems(question), 0);
  const incompleteList = questions.filter(isQuestionIncomplete);
  const incomplete = incompleteList.length;
  const aiChosen = questions.filter(questionHasAiChosen).length;
  const lowConfidence = questions.filter(questionHasLowConfidence).length;
  const duplicateIds = getDuplicateQuestionIds(questions);
  return {
    total: questions.length,
    unanswered,
    unansweredItems,
    incomplete,
    firstIncompleteId: incompleteList.length ? incompleteList[0].id : null,
    aiChosen,
    lowConfidence,
    duplicates: duplicateIds.size,
    duplicateIds,
    canSave: questions.length > 0 && unanswered === 0 && incomplete === 0
  };
}

function getCheckSignature(check) {
  return JSON.stringify({
    name: String(check.name || ''),
    type: Number(check.type) || 1,
    questions: (check.questions || []).map((question) => {
      if (isDungSaiQuestion(question)) {
        return {
          type: 'dungsai',
          q: String(question.q || ''),
          topic: String(question.topic || ''),
          items: getQuestionItems(question).map((item) => ({
            t: String(item.t || ''),
            a: typeof item.a === 'boolean' ? item.a : null,
            e: String(item.e || ''),
            ai_chon: Boolean(item.ai_chon),
            do_tin_cay: item.do_tin_cay || ''
          })),
          imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
        };
      }
      return {
        type: 'tracnghiem',
        q: String(question.q || ''),
        o: Array.isArray(question.o) ? question.o.map((option) => String(option || '')) : [],
        a: isValidAnswer(question.a) ? question.a : null,
        e: String(question.e || ''),
        ai_chon: Boolean(question.ai_chon),
        do_tin_cay: question.do_tin_cay || '',
        imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
      };
    })
  });
}

function isCheckDirty() {
  if (!state.check || state.check.mode !== 'edit') return false;
  return getCheckSignature(state.check) !== state.check.original;
}

function openDeckEditor(deckId) {
  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return;
  }
  const deck = getDeckById(deckId);
  if (!deck) {
    toast('Không tìm thấy bộ câu hỏi để sửa.', 'error');
    return;
  }

  clearExamClock();
  state.session = null;
  state.result = null;
  cleanupCheckAddImages();
  state.check = {
    mode: 'edit',
    deckId: deck.id,
    createdAt: deck.createdAt,
    name: deck.name,
    type: deck.type,
    questions: deck.questions.map((question) => (isDungSaiQuestion(question)
      ? {
          ...question,
          items: getQuestionItems(question).map((item) => ({ ...item }))
        }
      : {
          ...question,
          o: Array.isArray(question.o) ? [...question.o] : ['', '', '', '']
        })),
    errors: [],
    filter: 'all',
    addImages: [],
    addAllowAI: true
  };
  state.check.original = getCheckSignature(state.check);
  renderCheck();
  scrollToTop();
}

function renderConfidenceTag(confidence) {
  const label = CONFIDENCE_LABELS[confidence];
  if (!label) return '';
  return `<span class="tag tag--confidence tag--confidence--${confidence}" data-ai-badge>${icon('shield')} Độ tin cậy: ${label}</span>`;
}

function renderCheckButtons() {
  const disabled = getCheckAnalysis().canSave && !state.processing ? '' : 'disabled';
  const isEdit = state.check?.mode === 'edit';
  return `
    <button class="btn btn--ghost" type="button" data-action="cancel-check">${icon('x')} ${isEdit ? 'Hủy thay đổi' : 'Hủy'}</button>
    <button class="btn btn--primary" type="button" data-action="save-check" ${disabled}>${icon('save')} ${isEdit ? 'Lưu thay đổi' : 'Lưu bộ câu hỏi'}</button>
  `;
}

function renderCheckAddImages(check) {
  const items = Array.isArray(check.addImages) ? check.addImages : [];
  const canExtract = items.length > 0 && !state.processing;
  const disabled = state.processing ? 'disabled' : '';
  return `
    <section class="card check-add-images" aria-labelledby="checkAddImagesTitle">
      <div class="check-add-images__head">
        <div>
          <h2 id="checkAddImagesTitle">${icon('image')} Thêm câu hỏi bằng ảnh</h2>
          <p>Chọn ảnh đề cương mới để AI tách và thêm trực tiếp vào bộ đang sửa.</p>
        </div>
        <span class="tag">${icon('sparkles')} Không cần nhập tay</span>
      </div>

      <input class="file-input" id="checkAddImageInput" type="file" accept="image/*" multiple ${disabled}>
      <label class="upload-zone upload-zone--compact" id="checkAddZone" for="checkAddImageInput">
        <span class="upload-zone__icon">${icon('upload')}</span>
        <strong>Chọn ảnh</strong>
        <span>hoặc kéo thả ảnh vào đây · dán bằng Ctrl+V</span>
        <small>Có thể chọn nhiều ảnh; ảnh lỗi sẽ được giữ lại để tách lại.</small>
      </label>

      ${items.length ? `
        <div class="preview-area preview-area--compact">
          <div class="preview-area__head">
            <span>${items.length} ảnh chờ tách · ảnh lỗi được giữ lại</span>
            <div class="preview-area__actions">
              <button class="btn btn--ghost btn--sm" type="button" data-action="clear-check-images" ${disabled}>${icon('trash')} Bỏ tất cả</button>
            </div>
          </div>
          <div class="preview-grid preview-grid--compact">
            ${items.map((item, index) => `
              <article class="preview-item preview-item--compact${item.error ? ' preview-item--error' : ''}">
                <span class="preview-item__order">Ảnh ${index + 1}</span>
                <img src="${esc(item.url)}" alt="Xem trước ${esc(item.file.name)}" loading="lazy">
                <button class="preview-remove" type="button" data-action="remove-check-image" data-index="${index}" aria-label="Bỏ ảnh ${esc(item.file.name)}" title="Bỏ ảnh" ${disabled}>${icon('x')}</button>
                <div class="preview-item__meta">
                  <span class="preview-item__name" title="${esc(item.file.name)}">${esc(item.file.name)}</span>
                  <span class="preview-item__size">${formatFileSize(item.file.size)}</span>
                </div>
                ${item.error ? `
                  <p class="check-add-images__error" title="${esc(item.error)}">${icon('warning')}<span>${esc(item.error)}</span></p>
                ` : ''}
              </article>
            `).join('')}
          </div>
        </div>
      ` : `<p class="check-add-images__hint muted">${icon('image')} Chưa chọn ảnh nào. Bạn có thể chọn nhiều ảnh cùng lúc.</p>`}

      <label class="type-option type-option--check auto-answer-option">
        <input id="checkAddAllowAI" type="checkbox" ${check.addAllowAI !== false ? 'checked' : ''} ${disabled}>
        <span class="type-option__body">
          <span class="type-option__title">Nếu ảnh chưa có đáp án, để AI tự chọn</span>
          <span class="type-option__desc">Khi ảnh không có dấu hiệu đáp án, AI sẽ tự chọn đáp án đúng nhất. Tắt để giữ trống và tự chọn ở màn hình này.</span>
        </span>
      </label>

      <div class="check-add-images__actions">
        <button class="btn btn--primary" type="button" data-action="add-questions-from-images" ${canExtract ? '' : 'disabled'}>
          ${icon('sparkles')} ${state.processing ? 'Đang tách câu hỏi…' : 'Tách và thêm vào bộ này'}
        </button>
      </div>
    </section>
  `;
}

function renderCheck({ scroll = true } = {}) {
  if (!state.check) {
    renderHome();
    return;
  }
  clearExamClock();
  state.view = 'check';
  const check = state.check;
  const isEdit = check.mode === 'edit';
  const questions = check.questions;
  const typeInfo = getTypeInfo(check.type);
  const analysis = getCheckAnalysis();
  const newCount = questions.filter((question) => question.isNew).length;
  const requestedFilter = CHECK_FILTERS.includes(check.filter) ? check.filter : 'all';
  const filter = requestedFilter === 'new' && !newCount ? 'all' : requestedFilter;
  check.filter = filter;
  const indexed = questions.map((question, index) => ({ question, index }));
  const visible = filter === 'ai'
    ? indexed.filter((item) => questionHasAiChosen(item.question))
    : filter === 'low'
      ? indexed.filter((item) => questionHasLowConfidence(item.question))
      : filter === 'missing'
        ? indexed.filter((item) => isQuestionMissingAnswer(item.question))
        : filter === 'new'
          ? indexed.filter((item) => Boolean(item.question.isNew))
          : indexed;
  const filterEmptyText = filter === 'ai'
    ? 'Không có câu nào do AI tự chọn đáp án.'
    : filter === 'low'
      ? 'Không có câu nào có độ tin cậy thấp.'
      : filter === 'missing'
        ? 'Tất cả câu hỏi và các ý đã có đáp án.'
        : filter === 'new'
          ? 'Không còn câu mới nào chưa lưu.'
          : 'Không có câu hỏi nào để hiển thị.';
  const retryableErrors = check.errors.filter((error) => (
    error && error.url && state.selectedImages.some((item) => item.url === error.url)
  ));

  app.innerHTML = `
    <button class="btn btn--ghost back-button" type="button" data-action="cancel-check">${icon('arrowLeft')} Quay lại</button>
    <div class="view-head">
      <div>
        <h1>${isEdit ? 'Chỉnh sửa bộ câu hỏi' : 'Kiểm tra lại câu hỏi'}</h1>
        <p>${isEdit
          ? `Cập nhật tên bộ, nội dung câu hỏi và đáp án đúng. Bộ này hiện có ${questions.length} câu.`
          : `${questions.length ? `AI đã tách ${questions.length} câu từ ${new Set(questions.map((q) => q.imageIndex)).size} ảnh.` : 'Chưa có câu hỏi nào được tách thành công.'} Chỉnh sửa nội dung và chọn đáp án đúng trước khi lưu.${analysis.aiChosen ? ` Có ${analysis.aiChosen} câu do AI tự chọn đáp án.` : ''}${analysis.duplicates ? ` Có ${analysis.duplicates} câu có thể trùng giữa các ảnh.` : ''}`
        }</p>
      </div>
      <span class="tag">${icon('sparkles')} ${esc(typeInfo.short)}</span>
    </div>

    <div class="check-layout">
      <section class="card check-toolbar" aria-label="Đặt tên và lưu bộ câu hỏi">
        <div class="field">
          <label for="checkName">Tên bộ câu hỏi</label>
          <input id="checkName" name="checkName" type="text" value="${esc(check.name)}" placeholder="${esc(makeDefaultDeckName())}" autocomplete="off">
        </div>
        <div class="check-toolbar__actions">
          ${renderCheckButtons()}
        </div>
      </section>

      <p class="check-status check-status--warn" id="checkStatus" role="status" aria-live="polite"></p>

      ${state.processing ? renderProcessing() : ''}

      ${check.errors.length ? `
        <section class="error-list" aria-labelledby="errorListTitle">
          <h2 id="errorListTitle">${icon('warning')} Ảnh không xử lý được (${check.errors.length})</h2>
          <ul>
            ${check.errors.map((error) => `<li><strong>${esc(error.file)}:</strong> ${esc(error.message)}</li>`).join('')}
          </ul>
          ${retryableErrors.length ? `
            <div class="error-list__actions">
              <button class="btn btn--soft btn--sm" type="button" data-action="retry-failed-images" ${state.processing ? 'disabled' : ''}>${icon('refresh')} Thử lại các ảnh lỗi</button>
            </div>
          ` : (!isEdit ? `
            <p class="error-list__hint">Ảnh gốc không còn để thử lại. Chọn lại ảnh ở trang chủ nếu cần.</p>
          ` : '')}
        </section>
      ` : ''}

      ${isEdit ? `
        ${renderCheckAddImages(check)}
        <section class="card check-add-bar">
          <div>
            <strong>Thêm câu hỏi thủ công</strong><br>
            <span class="muted">Câu trắc nghiệm có 4 đáp án trống; câu Đúng/Sai có sẵn 4 ý để bạn tự nhập.</span>
          </div>
          <div class="check-add-bar__actions">
            <button class="btn btn--soft btn--sm" type="button" data-action="add-check-q" ${state.processing ? 'disabled' : ''}>${icon('plus')} Thêm câu trắc nghiệm</button>
            <button class="btn btn--soft btn--sm" type="button" data-action="add-check-ds" ${state.processing ? 'disabled' : ''}>${icon('plus')} Thêm câu Đúng/Sai</button>
          </div>
        </section>
      ` : ''}

      ${questions.length ? `
        <section class="card check-filters" aria-label="Lọc câu hỏi">
          <span class="check-filters__label">${icon('list')} Lọc câu hỏi</span>
          <div class="check-filters__buttons">
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'all' ? 'is-active' : ''}" type="button" data-action="check-filter" data-filter="all" ${state.processing ? 'disabled' : ''}>Tất cả (${questions.length})</button>
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'ai' ? 'is-active' : ''}" type="button" data-action="check-filter" data-filter="ai" ${state.processing ? 'disabled' : ''}>Chỉ hiện câu AI chọn (${analysis.aiChosen})</button>
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'low' ? 'is-active' : ''}" type="button" data-action="check-filter" data-filter="low" ${state.processing ? 'disabled' : ''}>Chỉ hiện câu độ tin cậy thấp (${analysis.lowConfidence})</button>
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'missing' ? 'is-active' : ''} ${analysis.unanswered ? 'check-filter-btn--alert' : ''}" type="button" data-action="check-filter" data-filter="missing" ${state.processing ? 'disabled' : ''}>${icon('warning')} Chưa có đáp án (${analysis.unanswered}${analysis.unansweredItems > analysis.unanswered ? ` câu · ${analysis.unansweredItems} ý` : ''})</button>
            ${newCount ? `<button class="btn btn--ghost btn--sm check-filter-btn check-filter-btn--new ${filter === 'new' ? 'is-active' : ''}" type="button" data-action="check-filter" data-filter="new" ${state.processing ? 'disabled' : ''}>${icon('sparkles')} Chỉ hiện câu mới (${newCount})</button>` : ''}
          </div>
        </section>

        ${visible.length ? `
          <div class="check-list">
            ${visible.map(({ question, index }) => renderCheckQuestion(question, index, analysis.duplicateIds.has(question.id))).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <span class="empty-state__icon">${icon('list')}</span>
            <h3>Không có câu phù hợp bộ lọc</h3>
            <p>${filterEmptyText}</p>
          </div>
        `}

        <section class="card check-toolbar" aria-label="Lưu bộ câu hỏi">
          <div>
            <strong>${questions.length} câu hỏi</strong><br>
            <span class="muted">Kiểm tra kỹ nội dung do AI tách, đáp án AI tự chọn (kể cả từng ý Đúng/Sai) và phần giải thích.</span>
          </div>
          <div class="check-toolbar__actions">
            ${renderCheckButtons()}
          </div>
        </section>
      ` : `
        <div class="empty-state">
          <span class="empty-state__icon">${icon('image')}</span>
          <h3>${isEdit ? 'Bộ câu hỏi đang trống' : 'Không có câu hỏi để lưu'}</h3>
          <p>${isEdit
            ? 'Bấm “Thêm câu trắc nghiệm” hoặc “Thêm câu Đúng/Sai” ở phía trên để tạo câu mới.'
            : 'Hãy quay lại, kiểm tra API key/model và thử tải ảnh rõ nét hơn. Các lỗi chi tiết nằm ở phía trên.'
          }</p>
        </div>
      `}
    </div>
  `;

  updateCheckStatus();
  if (scroll) scrollToTop();
}

function renderCheckQuestion(question, index, isDuplicate = false) {
  return isDungSaiQuestion(question)
    ? renderCheckDungSaiQuestion(question, index, isDuplicate)
    : renderCheckMcqQuestion(question, index, isDuplicate);
}

function renderCheckMcqQuestion(question, index, isDuplicate = false) {
  const answerOptions = Array.isArray(question.o) ? question.o : ['', '', '', ''];
  const incompleteClass = isQuestionIncomplete(question) ? ' check-card--incomplete' : '';
  return `
    <article class="check-card card${incompleteClass}" data-qid="${esc(question.id)}" data-kind="tracnghiem">
      <div class="check-card__head">
        <span class="tag">Câu ${index + 1}</span>
        <span class="tag">${icon('help')} Trắc nghiệm</span>
        ${question.isNew ? `<span class="tag tag--new">${icon('sparkles')} Mới</span>` : ''}
        ${Number.isInteger(question.imageIndex) && question.imageIndex > 0 ? `<span class="tag tag--image">${icon('image')} Ảnh ${question.imageIndex}</span>` : ''}
        ${isDuplicate ? `
          <span class="tag tag--duplicate">
            ${icon('warning')} Có thể trùng
            <button class="tag__delete" type="button" data-action="delete-check-q" data-qid="${esc(question.id)}" aria-label="Xóa nhanh câu ${index + 1} vì có thể trùng" title="Xóa nhanh câu này">${icon('x')}</button>
          </span>
        ` : ''}
        ${question.ai_chon ? `<span class="tag tag--ai" data-ai-badge>${icon('sparkles')} AI chọn đáp án</span>${renderConfidenceTag(question.do_tin_cay)}` : ''}
        <span class="check-card__spacer"></span>
        <button class="btn btn--danger btn--sm check-card__delete" type="button" data-action="delete-check-q" data-qid="${esc(question.id)}">${icon('trash')} Xóa câu</button>
      </div>

      <div class="check-field">
        <label for="question-${esc(question.id)}">Nội dung câu hỏi</label>
        <textarea class="check-question-input" id="question-${esc(question.id)}" data-field="q" aria-label="Nội dung câu hỏi ${index + 1}">${esc(question.q)}</textarea>
      </div>

      <div class="check-field">
        <span class="field__label">Bốn đáp án · bấm nút tròn để chọn đáp án đúng</span>
        <div class="check-answer-list">
          ${LETTERS.map((letter, optionIndex) => `
            <div class="check-answer">
              <input class="correct-radio" type="radio" name="correct-${esc(question.id)}" value="${optionIndex}" data-field="a" aria-label="Chọn đáp án ${letter} là đáp án đúng" ${question.a === optionIndex ? 'checked' : ''}>
              <span class="answer-badge" aria-hidden="true">${letter}</span>
              <textarea data-field="o" data-index="${optionIndex}" aria-label="Đáp án ${letter}" placeholder="Nhập đáp án ${letter}…">${esc(answerOptions[optionIndex] || '')}</textarea>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="check-field check-field--explanation">
        <label for="explanation-${esc(question.id)}">Giải thích (1–2 câu, có thể sửa)</label>
        <textarea class="check-explanation-input" id="explanation-${esc(question.id)}" data-field="e" aria-label="Giải thích cho câu ${index + 1}" placeholder="Chưa có giải thích cho câu này…">${esc(question.e)}</textarea>
      </div>
    </article>
  `;
}

function renderCheckDungSaiQuestion(question, index, isDuplicate = false) {
  const items = getQuestionItems(question);
  const incompleteClass = isQuestionIncomplete(question) ? ' check-card--incomplete' : '';
  const aiCount = items.filter((item) => item.ai_chon).length;
  return `
    <article class="check-card card${incompleteClass}" data-qid="${esc(question.id)}" data-kind="dungsai">
      <div class="check-card__head">
        <span class="tag">Câu ${index + 1}</span>
        <span class="tag">${icon('check')} Đúng/Sai · ${items.length} ý</span>
        ${question.isNew ? `<span class="tag tag--new">${icon('sparkles')} Mới</span>` : ''}
        ${Number.isInteger(question.imageIndex) && question.imageIndex > 0 ? `<span class="tag tag--image">${icon('image')} Ảnh ${question.imageIndex}</span>` : ''}
        ${isDuplicate ? `
          <span class="tag tag--duplicate">
            ${icon('warning')} Có thể trùng
            <button class="tag__delete" type="button" data-action="delete-check-q" data-qid="${esc(question.id)}" aria-label="Xóa nhanh câu ${index + 1} vì có thể trùng" title="Xóa nhanh câu này">${icon('x')}</button>
          </span>
        ` : ''}
        ${aiCount ? `<span class="tag tag--ai" data-ai-badge>${icon('sparkles')} AI chọn ${aiCount}/${items.length} ý</span>` : ''}
        <span class="check-card__spacer"></span>
        <button class="btn btn--danger btn--sm check-card__delete" type="button" data-action="delete-check-q" data-qid="${esc(question.id)}">${icon('trash')} Xóa câu</button>
      </div>

      <div class="check-field">
        <label for="question-${esc(question.id)}">Đoạn dẫn / dữ kiện của câu</label>
        <textarea class="check-question-input" id="question-${esc(question.id)}" data-field="q" aria-label="Đoạn dẫn của câu ${index + 1}" placeholder="Có thể để trống nếu câu không có đoạn dẫn…">${esc(question.q)}</textarea>
      </div>

      <div class="check-field">
        <label for="topic-${esc(question.id)}">Chủ đề (tùy chọn)</label>
        <input class="check-topic-input" id="topic-${esc(question.id)}" type="text" data-field="topic" value="${esc(question.topic || '')}" placeholder="Ví dụ: Chương 1 – Cơ học…" autocomplete="off">
      </div>

      <div class="check-field">
        <span class="field__label">Các ý · chọn Đúng hoặc Sai cho từng ý</span>
        <div class="ds-editor-list">
          ${items.map((item, itemIndex) => `
            <div class="ds-editor${typeof item.a !== 'boolean' ? ' ds-editor--missing' : ''}" data-index="${itemIndex}">
              <div class="ds-editor__head">
                <span class="answer-badge" aria-hidden="true">${itemLetter(itemIndex)}</span>
                <strong class="ds-editor__label">Ý ${itemLetter(itemIndex)}</strong>
                ${item.ai_chon ? `<span class="tag tag--ai tag--sm" data-ai-badge>${icon('sparkles')} AI chọn</span>` : ''}
                ${item.do_tin_cay ? renderConfidenceTag(item.do_tin_cay) : ''}
                <span class="check-card__spacer"></span>
                <button class="btn btn--ghost btn--sm ds-editor__remove" type="button" data-action="remove-ds-item" data-qid="${esc(question.id)}" data-index="${itemIndex}" title="Xóa ý này" ${items.length <= 2 ? 'disabled' : ''}>${icon('trash')} Xóa ý</button>
              </div>
              <textarea data-field="item-t" data-index="${itemIndex}" aria-label="Nội dung ý ${itemLetter(itemIndex)}" placeholder="Nhập nội dung ý ${itemLetter(itemIndex)}…">${esc(item.t)}</textarea>
              <div class="ds-editor__row">
                <div class="ds-radio-group" role="radiogroup" aria-label="Đáp án ý ${itemLetter(itemIndex)}">
                  <label class="ds-radio ${item.a === true ? 'is-checked' : ''}">
                    <input class="ds-answer-radio" type="radio" name="ds-${esc(question.id)}-${itemIndex}" value="true" data-field="item-a" data-index="${itemIndex}" ${item.a === true ? 'checked' : ''}>
                    <span>Đúng</span>
                  </label>
                  <label class="ds-radio ${item.a === false ? 'is-checked' : ''}">
                    <input class="ds-answer-radio" type="radio" name="ds-${esc(question.id)}-${itemIndex}" value="false" data-field="item-a" data-index="${itemIndex}" ${item.a === false ? 'checked' : ''}>
                    <span>Sai</span>
                  </label>
                </div>
                <span class="ds-editor__status ${typeof item.a === 'boolean' ? 'is-ready' : ''}">
                  ${typeof item.a === 'boolean' ? `${icon('check')} Đã có đáp án` : `${icon('warning')} Chưa có đáp án`}
                </span>
              </div>
              <textarea data-field="item-e" data-index="${itemIndex}" aria-label="Giải thích cho ý ${itemLetter(itemIndex)}" placeholder="Giải thích ngắn cho ý ${itemLetter(itemIndex)}…">${esc(item.e)}</textarea>
            </div>
          `).join('')}
        </div>
        <div class="ds-editor-add">
          <button class="btn btn--soft btn--sm" type="button" data-action="add-ds-item" data-qid="${esc(question.id)}" ${items.length >= 6 ? 'disabled' : ''}>${icon('plus')} Thêm ý</button>
          <span class="muted">Mỗi câu cho phép 2–6 ý.</span>
        </div>
      </div>
    </article>
  `;
}

function updateCheckStatus() {
  if (!state.check) return;
  const analysis = getCheckAnalysis();
  const status = document.getElementById('checkStatus');
  const saveButtons = app.querySelectorAll('[data-action="save-check"]');
  saveButtons.forEach((button) => {
    button.disabled = !analysis.canSave || state.processing;
  });

  app.querySelectorAll('.check-card[data-qid]').forEach((card) => {
    const question = state.check.questions.find((item) => item.id === card.dataset.qid);
    card.classList.toggle('check-card--incomplete', isQuestionIncomplete(question));
  });

  if (!status) return;

  let message = '';
  let mode = 'ok';

  if (!analysis.total) {
    mode = 'warn';
    message = state.check.mode === 'edit'
      ? 'Bộ câu hỏi đang trống. Hãy thêm ít nhất một câu trước khi lưu.'
      : 'Chưa có câu hỏi nào để lưu. Hãy quay lại và tải ảnh khác.';
  } else if (!analysis.canSave) {
    mode = 'warn';
    const problems = [];
    if (analysis.incomplete) problems.push(`${analysis.incomplete} câu còn nội dung hoặc đáp án trống`);
    if (analysis.unanswered) {
      const suffix = analysis.unansweredItems > analysis.unanswered ? ` (${analysis.unansweredItems} ý)` : '';
      problems.push(`${analysis.unanswered} câu chưa có đáp án đúng${suffix}`);
    }
    message = `Chưa thể lưu: còn ${problems.join(' và ')}.`;
  } else {
    message = `Đã sẵn sàng lưu ${analysis.total} câu hỏi.`;
  }

  status.className = `check-status check-status--${mode}`;
  const jumpActions = [];
  if (analysis.incomplete) {
    jumpActions.push(`<button class="btn btn--ghost btn--sm check-status__jump" type="button" data-action="jump-incomplete">${icon('arrowDown')} Chuyển đến câu lỗi đầu tiên</button>`);
  }
  if (analysis.unanswered) {
    jumpActions.push(`<button class="btn btn--ghost btn--sm check-status__jump" type="button" data-action="jump-missing">${icon('arrowDown')} Nhảy tới câu thiếu đáp án</button>`);
  }
  const jumpMarkup = jumpActions.length
    ? `<span class="check-status__actions">${jumpActions.join('')}</span>`
    : '';
  status.innerHTML = `${icon(mode === 'ok' ? 'check' : 'warning')}<span>${esc(message)}</span>${jumpMarkup}`;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getViewedCheckCard() {
  const cards = Array.from(app.querySelectorAll('.check-card[data-qid]'));
  if (!cards.length) return null;
  const middle = window.innerHeight / 2;
  let viewed = null;
  let bestDistance = Infinity;
  cards.forEach((card) => {
    const distance = Math.abs(card.getBoundingClientRect().top - middle);
    if (distance < bestDistance) {
      viewed = card;
      bestDistance = distance;
    }
  });
  return viewed;
}

function jumpToMissingAnswer() {
  if (!state.check) return;
  const questions = state.check.questions;
  const hasMissing = questions.some(isQuestionMissingAnswer);
  if (!hasMissing) {
    toast('Tất cả câu hỏi và các ý đã có đáp án.', 'success', 3000);
    return;
  }

  const viewed = getViewedCheckCard();
  const currentIndex = viewed
    ? questions.findIndex((question) => question.id === viewed.dataset.qid)
    : -1;

  let target = null;
  for (let offset = 1; offset <= questions.length; offset += 1) {
    const question = questions[(currentIndex + offset) % questions.length];
    if (question && isQuestionMissingAnswer(question)) {
      target = question;
      break;
    }
  }
  if (!target) return;

  const findCard = () => Array.from(app.querySelectorAll('.check-card[data-qid]'))
    .find((card) => card.dataset.qid === target.id) || null;

  let card = findCard();
  if (!card) {
    state.check.filter = 'all';
    renderCheck({ scroll: false });
    card = findCard();
  }
  if (!card) return;

  const reducedMotion = prefersReducedMotion();
  const topbar = document.querySelector('.topbar');
  const offset = (topbar ? topbar.getBoundingClientRect().height : 72) + 20;
  const top = window.scrollY + card.getBoundingClientRect().top - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });

  if (!reducedMotion) {
    card.classList.add('check-card--highlight');
    window.setTimeout(() => card.classList.remove('check-card--highlight'), 1600);
  }

  const radio = isDungSaiQuestion(target)
    ? Array.from(card.querySelectorAll('.ds-answer-radio')).find((input) => !input.checked)
    : card.querySelector('.correct-radio');
  if (radio) radio.focus({ preventScroll: true });
}

function scrollToFirstNewQuestion(questionId) {
  if (!questionId) return;
  const card = Array.from(app.querySelectorAll('.check-card[data-qid]'))
    .find((item) => item.dataset.qid === questionId);
  if (!card) return;

  const reducedMotion = prefersReducedMotion();
  const topbar = document.querySelector('.topbar');
  const offset = (topbar ? topbar.getBoundingClientRect().height : 72) + 20;
  const top = window.scrollY + card.getBoundingClientRect().top - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });

  if (!reducedMotion) {
    card.classList.add('check-card--highlight');
    window.setTimeout(() => card.classList.remove('check-card--highlight'), 1600);
  }
}

function buildQuestionsForSave(questions) {
  // Chỉ chép các trường của định dạng đã lưu; cờ tạm isNew của câu mới bị loại bỏ.
  return questions.map((question) => {
    if (isDungSaiQuestion(question)) {
      return {
        id: typeof question.id === 'string' && question.id ? question.id : uid('q'),
        type: 'dungsai',
        q: String(question.q || '').trim(),
        topic: String(question.topic || '').trim(),
        items: getQuestionItems(question).map((item) => ({
          t: String(item.t || '').trim(),
          a: item.a === true,
          e: String(item.e || '').trim(),
          ai_chon: Boolean(item.ai_chon),
          do_tin_cay: normalizeItemConfidence(item.do_tin_cay, Boolean(item.ai_chon))
        })),
        imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
      };
    }
    return {
      id: typeof question.id === 'string' && question.id ? question.id : uid('q'),
      type: 'tracnghiem',
      q: String(question.q || '').trim(),
      o: Array.isArray(question.o)
        ? question.o.map((option) => String(option || '').trim())
        : ['', '', '', ''],
      a: question.a,
      e: String(question.e || '').trim(),
      aiAnswers: Boolean(question.ai_chon),
      ai_chon: Boolean(question.ai_chon),
      do_tin_cay: normalizeConfidence(question.do_tin_cay),
      imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
    };
  });
}

function savePendingCheck() {
  if (!state.check) return;
  const analysis = getCheckAnalysis();
  if (!analysis.total) {
    toast('Không có câu hỏi nào để lưu.', 'warning');
    return;
  }
  if (analysis.unanswered) {
    const suffix = analysis.unansweredItems > analysis.unanswered ? ` (${analysis.unansweredItems} ý)` : '';
    toast(`Còn ${analysis.unanswered} câu chưa chọn đáp án đúng${suffix}.`, 'error');
    return;
  }
  if (analysis.incomplete) {
    toast(`Còn ${analysis.incomplete} câu chưa đủ nội dung hoặc đáp án trống.`, 'error');
    return;
  }

  const check = state.check;
  const name = String(check.name || '').trim() || makeDefaultDeckName();
  const questions = buildQuestionsForSave(check.questions);
  const type = resolveDeckType(check.type, questions);
  const decks = getDecks();

  if (check.mode === 'edit') {
    const index = decks.findIndex((deck) => deck.id === check.deckId);
    if (index === -1) {
      toast('Không tìm thấy bộ câu hỏi cần sửa. Có thể bộ đã bị xóa.', 'error', 6000);
      return;
    }

    // Giữ nguyên id và createdAt của bộ câu hỏi đã lưu.
    decks[index] = {
      ...decks[index],
      name,
      type,
      questions
    };
    if (!writeJSON(STORAGE_KEYS.decks, decks)) return;

    cleanupCheckAddImages();
    state.check = null;
    state.session = null;
    state.result = null;
    renderHome();
    scrollToTop();
    toast(`Đã cập nhật bộ "${name}" với ${questions.length} câu hỏi.`, 'success', 5000);
    return;
  }

  const deck = {
    id: uid('deck'),
    name,
    createdAt: new Date().toISOString(),
    type,
    questions
  };
  if (!writeJSON(STORAGE_KEYS.decks, [deck, ...decks])) return;

  clearCheckDraft();
  cleanupCheckAddImages();
  state.check = null;
  state.session = null;
  state.result = null;
  renderHome();
  scrollToTop();
  toast(`Đã lưu bộ "${deck.name}" với ${questions.length} câu hỏi.`, 'success', 5000);
}

function cancelCheck() {
  if (!state.check) {
    renderHome();
    return;
  }

  if (state.check.mode === 'edit') {
    if (isCheckDirty() && !window.confirm('Thoát mà chưa lưu? Các thay đổi với bộ câu hỏi sẽ bị mất.')) return;
  } else {
    const hasData = state.check.questions.length || state.check.errors.length;
    if (hasData && !window.confirm('Hủy kết quả đã tách? Các chỉnh sửa hiện tại sẽ bị mất.')) return;
    clearCheckDraft();
  }

  cleanupCheckAddImages();
  state.check = null;
  renderHome();
  scrollToTop();
}

function deleteCheckQuestion(questionId) {
  if (!state.check) return;
  const index = state.check.questions.findIndex((question) => question.id === questionId);
  if (index === -1) return;
  state.check.questions.splice(index, 1);
  renderCheck();
  saveCheckDraft();
}

function addCheckQuestion() {
  if (!state.check) return;
  const id = uid('q');
  state.check.questions.push({
    id,
    type: 'tracnghiem',
    q: '',
    o: ['', '', '', ''],
    a: null,
    e: '',
    aiAnswers: false,
    ai_chon: false,
    do_tin_cay: '',
    imageIndex: null
  });
  state.check.filter = 'all';
  renderCheck({ scroll: false });
  saveCheckDraft();

  const field = document.getElementById(`question-${id}`);
  if (!field) return;
  field.focus();
  const card = field.closest('.check-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function addDungSaiQuestion() {
  if (!state.check) return;
  const id = uid('q');
  state.check.questions.push({
    id,
    type: 'dungsai',
    q: '',
    topic: '',
    items: [0, 1, 2, 3].map(() => ({
      t: '',
      a: null,
      e: '',
      ai_chon: false,
      do_tin_cay: ''
    })),
    imageIndex: null
  });
  state.check.filter = 'all';
  renderCheck({ scroll: false });
  saveCheckDraft();

  const field = document.getElementById(`question-${id}`);
  if (!field) return;
  field.focus();
  const card = field.closest('.check-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function addDungSaiItem(questionId) {
  if (!state.check) return;
  const question = state.check.questions.find((item) => item.id === questionId);
  if (!question || !isDungSaiQuestion(question)) return;
  const items = getQuestionItems(question);
  if (items.length >= 6) {
    toast('Mỗi câu Đúng/Sai chỉ cho phép tối đa 6 ý.', 'warning');
    return;
  }
  items.push({ t: '', a: null, e: '', ai_chon: false, do_tin_cay: '' });
  renderCheck({ scroll: false });
  saveCheckDraft();
  const field = app.querySelector(`.check-card[data-qid="${questionId}"] .ds-editor[data-index="${items.length - 1}"] [data-field="item-t"]`);
  if (field) {
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function removeDungSaiItem(questionId, itemIndex) {
  if (!state.check) return;
  const question = state.check.questions.find((item) => item.id === questionId);
  if (!question || !isDungSaiQuestion(question)) return;
  const items = getQuestionItems(question);
  if (items.length <= 2) {
    toast('Mỗi câu Đúng/Sai cần ít nhất 2 ý.', 'warning');
    return;
  }
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) return;
  items.splice(itemIndex, 1);
  renderCheck({ scroll: false });
  saveCheckDraft();
}

