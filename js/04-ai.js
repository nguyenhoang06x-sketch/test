'use strict';
/* =========================================================
   6. Chọn ảnh, thu nhỏ ảnh và gọi AI
   ========================================================= */
function isImageFile(file) {
  if (!file) return false;
  return /^image\//i.test(file.type || '') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
}

function compareSelectedImagesByName(a, b) {
  return a.file.name.localeCompare(b.file.name, 'vi', { numeric: true, sensitivity: 'base' });
}

function reindexSelectedImages() {
  state.selectedImages.forEach((item, index) => {
    item.imageIndex = index + 1;
  });
}

function sortSelectedImagesByName() {
  if (state.selectedImages.length < 2) return;
  state.selectedImages.sort(compareSelectedImagesByName);
  reindexSelectedImages();
}

function moveSelectedImage(index, delta) {
  if (state.processing) return;
  const target = index + delta;
  if (!Number.isInteger(index) || !Number.isInteger(target)) return;
  if (index < 0 || index >= state.selectedImages.length) return;
  if (target < 0 || target >= state.selectedImages.length) return;
  const [item] = state.selectedImages.splice(index, 1);
  state.selectedImages.splice(target, 0, item);
  reindexSelectedImages();
  renderHome();
}

function clipboardFileName(file, index) {
  if (file && file.name && file.name.trim()) return file;
  const type = (file && file.type) || 'image/png';
  const ext = type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
  const name = `clipboard-${String(index + 1).padStart(2, '0')}.${ext}`;
  try {
    return new File([file], name, {
      type,
      lastModified: file && file.lastModified ? file.lastModified : Date.now()
    });
  } catch (error) {
    console.warn('Không đặt được tên cho ảnh dán từ clipboard', error);
    return file;
  }
}

function getClipboardImageFiles(clipboardData) {
  if (!clipboardData) return [];

  const files = [];
  const seen = new Set();
  const push = (file) => {
    if (!file || !isImageFile(file)) return;
    const key = `${file.name || ''}|${file.size || 0}|${file.type || ''}|${file.lastModified || 0}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(clipboardFileName(file, files.length));
  };

  const items = clipboardData.items ? Array.from(clipboardData.items) : [];
  items.forEach((item) => {
    if (item.kind !== 'file' || !/^image\//i.test(item.type || '')) return;
    push(item.getAsFile());
  });

  if (!files.length && clipboardData.files) {
    Array.from(clipboardData.files).forEach(push);
  }

  return files;
}

function handleImageSelection(fileList) {
  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return;
  }
  const incoming = Array.from(fileList || []);
  const images = incoming.filter(isImageFile);
  if (!images.length) {
    toast('Không tìm thấy ảnh hợp lệ trong lựa chọn.', 'error');
    return;
  }
  if (images.length < incoming.length) {
    toast(`Đã bỏ qua ${incoming.length - images.length} tệp không phải ảnh.`, 'warning');
  }

  cleanupSelectedImages();
  state.selectedImages = images.map((file, index) => ({
    file,
    url: URL.createObjectURL(file),
    imageIndex: index + 1
  }));
  sortSelectedImagesByName();
  renderHome();
}

function onPaste(event) {
  if (state.setup || isAISettingsOpen()) return;
  const isCheckEdit = state.view === 'check' && state.check?.mode === 'edit';
  if (!isCheckEdit && state.view !== 'home') return;
  const target = event.target;
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

  const files = getClipboardImageFiles(event.clipboardData);
  if (!files.length) return;

  if (isCheckEdit) {
    if (state.processing) {
      toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
      return;
    }
    event.preventDefault();
    if (handleCheckImageSelection(files)) {
      toast(`Đã dán ${files.length} ảnh vào danh sách chờ tách.`, 'success', 3500);
    }
    return;
  }

  event.preventDefault();
  const wasProcessing = state.processing;
  handleImageSelection(files);
  if (!wasProcessing && state.selectedImages.length) {
    toast(`Đã dán ${files.length} ảnh từ clipboard.`, 'success', 3500);
  }
}

function releaseSuccessfulImages(urls) {
  if (!urls || !urls.size) return;
  state.selectedImages = state.selectedImages.filter((item) => {
    if (!urls.has(item.url)) return true;
    try {
      URL.revokeObjectURL(item.url);
    } catch (error) {
      console.warn('Không giải phóng được URL ảnh đã xử lý', error);
    }
    return false;
  });
}

function cleanupSelectedImages() {
  state.selectedImages.forEach((item) => {
    try {
      URL.revokeObjectURL(item.url);
    } catch (error) {
      console.warn('Không giải phóng được URL ảnh xem trước', error);
    }
  });
  state.selectedImages = [];
}

function removeSelectedImage(index) {
  if (state.processing) return;
  const item = state.selectedImages[index];
  if (!item) return;
  URL.revokeObjectURL(item.url);
  state.selectedImages.splice(index, 1);
  reindexSelectedImages();
  renderHome();
}

/* Ảnh chờ tách riêng cho màn sửa bộ, không dùng chung state.selectedImages. */
function cleanupCheckAddImages() {
  const check = state.check;
  if (!check || !Array.isArray(check.addImages)) return;
  check.addImages.forEach((item) => {
    try {
      URL.revokeObjectURL(item.url);
    } catch (error) {
      console.warn('Không giải phóng được URL ảnh chờ tách', error);
    }
  });
  check.addImages = [];
}

function releaseCheckAddImageUrls(urls) {
  const check = state.check;
  if (!check || !Array.isArray(check.addImages) || !urls || !urls.size) return;
  check.addImages = check.addImages.filter((item) => {
    if (!urls.has(item.url)) return true;
    try {
      URL.revokeObjectURL(item.url);
    } catch (error) {
      console.warn('Không giải phóng được URL ảnh đã tách', error);
    }
    return false;
  });
}

function handleCheckImageSelection(fileList) {
  const check = state.check;
  if (!check || check.mode !== 'edit') return false;
  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return false;
  }
  const incoming = Array.from(fileList || []);
  const images = incoming.filter(isImageFile);
  if (!images.length) {
    toast('Không tìm thấy ảnh hợp lệ trong lựa chọn.', 'error');
    return false;
  }
  if (images.length < incoming.length) {
    toast(`Đã bỏ qua ${incoming.length - images.length} tệp không phải ảnh.`, 'warning');
  }

  if (!Array.isArray(check.addImages)) check.addImages = [];
  images.forEach((file) => {
    check.addImages.push({
      file,
      url: URL.createObjectURL(file),
      error: ''
    });
  });
  renderCheck({ scroll: false });
  return true;
}

function removeCheckAddImage(index) {
  if (state.processing || !state.check) return;
  const item = state.check.addImages && state.check.addImages[index];
  if (!item) return;
  try {
    URL.revokeObjectURL(item.url);
  } catch (error) {
    console.warn('Không giải phóng được URL ảnh chờ tách', error);
  }
  state.check.addImages.splice(index, 1);
  renderCheck({ scroll: false });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Trình duyệt không đọc được tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không giải mã được ảnh. Hãy thử ảnh JPG hoặc PNG.'));
    image.src = src;
  });
}

async function compressImage(file) {
  const source = await readFileAsDataURL(file);
  const image = await loadImageElement(source);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error('Ảnh không có kích thước hợp lệ.');

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không tạo được canvas để xử lý ảnh.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Không chuyển được ảnh sang JPEG.');
  }
  return dataUrl;
}

function parseAIJSON(content) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('AI không trả về đối tượng JSON hợp lệ.');
  }
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch (error) {
    throw new Error(`Không đọc được JSON do AI trả về: ${error.message}`);
  }
}

function extractMessageContent(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      return '';
    }).join('');
  }
  return '';
}

function isRateLimitError(error) {
  if (!error) return false;
  if (error.status === 429) return true;
  return /rate.?limit|too many requests|429|quota exceeded|try again later/i.test(error.message || '');
}

function createAbortError(message = 'Đã hủy tác vụ.') {
  if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function isAbortError(error) {
  return Boolean(error) && (error.name === 'AbortError' || error.code === 20);
}

async function callModelAPI(config, model, dataUrl, prompt, signal) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromOuter = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortFromOuter, { once: true });
  }
  try {
    const response = await fetch(buildEndpoint(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }]
      }),
      signal: controller.signal
    });

    const rawText = await response.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const detail = data?.error?.message
        ? String(data.error.message)
        : String(rawText || `HTTP ${response.status}`).slice(0, 400);
      const error = new Error(`HTTP ${response.status}: ${detail}`);
      error.status = response.status;
      error.isRateLimit = isRateLimitError(error);
      throw error;
    }

    if (!data) throw new Error('API trả về dữ liệu không phải JSON.');
    const content = extractMessageContent(data);
    if (!content.trim()) throw new Error('API không trả về nội dung đọc ảnh.');
    return parseAIJSON(content);
  } finally {
    window.clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', abortFromOuter);
  }
}

function waitWithCountdown(seconds, onTick, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let remaining = Math.max(1, Math.ceil(seconds));
    if (onTick) onTick(remaining);

    const cleanup = () => {
      window.clearInterval(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    const timer = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        cleanup();
        if (onTick) onTick(0);
        resolve();
      } else if (onTick) {
        onTick(remaining);
      }
    }, 1000);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function getPrompt(allowAIAnswer = true) {
  return allowAIAnswer ? PROMPT_AUTO : PROMPT_AUTO_NO_AI;
}

async function extractQuestionsFromImage(dataUrl, config, onStatus, allowAIAnswer = true, signal = null) {
  const models = parseModelList(config.models);
  const prompt = getPrompt(allowAIAnswer);
  const failures = [];

  for (const model of models) {
    if (signal?.aborted) throw createAbortError();
    if (onStatus) onStatus(`Đang đọc bằng model ${model}…`);
    let retries = 0;

    while (true) {
      if (signal?.aborted) throw createAbortError();
      try {
        const parsed = await callModelAPI(config, model, dataUrl, prompt, signal);
        if (!Array.isArray(parsed) && !Array.isArray(parsed?.questions)) {
          throw new Error('Model trả về JSON thiếu mảng "questions".');
        }
        return parsed;
      } catch (error) {
        if (isAbortError(error) && signal?.aborted) throw error;
        if (isRateLimitError(error) && retries < RATE_LIMIT_RETRIES) {
          const waitSeconds = RATE_LIMIT_WAITS[retries] ?? 30;
          retries += 1;
          await waitWithCountdown(waitSeconds, (remaining) => {
            if (onStatus) {
              onStatus(`Model ${model} bị giới hạn tốc độ (429). Thử lại sau ${Math.max(1, remaining)} giây…`);
            }
          }, signal);
          if (onStatus) {
            onStatus(`Đang thử lại model ${model} (lần ${retries}/${RATE_LIMIT_RETRIES})…`);
          }
          continue;
        }

        if (isRateLimitError(error)) {
          failures.push(`${model}: đã hết ${RATE_LIMIT_RETRIES} lần thử lại vì lỗi 429`);
        } else {
          failures.push(`${model}: ${shortError(error)}`);
        }
        break;
      }
    }
  }

  const error = new Error(`Không model nào đọc được ảnh. ${failures.join(' | ')}`);
  error.failures = failures;
  throw error;
}

function normalizeExtractedDsItems(rawItems, allowAIAnswer = true) {
  const source = Array.isArray(rawItems) ? rawItems : [];
  const items = [];
  source.slice(0, 6).forEach((raw) => {
    if (!raw) return;
    const item = typeof raw === 'object' ? raw : { t: raw };
    const text = String(item.t ?? item.text ?? item.content ?? '').trim();
    if (!text) return;
    const answer = normalizeTruthAnswer(item.a ?? item.answer);
    const aiChosen = allowAIAnswer
      ? normalizeAiChosen(item.ai_chon ?? item.aiChosen, true)
      : false;
    const confidence = normalizeConfidence(item.do_tin_cay)
      || (allowAIAnswer
        ? (aiChosen ? 'vua' : '')
        : (typeof answer === 'boolean' ? 'cao' : 'thap'));
    items.push({
      t: text,
      a: answer,
      e: String(item.e ?? item.explanation ?? '').trim(),
      ai_chon: aiChosen,
      do_tin_cay: confidence
    });
  });
  return items;
}

function normalizeExtractedQuestions(parsed, imageIndex, allowAIAnswer = true) {
  const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new Error('AI không trả về mảng "questions" đúng định dạng.');
  }

  const result = [];
  rawQuestions.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const questionText = String(item.q ?? item.question ?? '').trim();
    const kind = normalizeQuestionType(item.type, item);

    if (kind === 'dungsai') {
      const items = normalizeExtractedDsItems(item.items, allowAIAnswer);
      if (!items.length) return;
      result.push({
        id: uid('q'),
        type: 'dungsai',
        q: questionText,
        topic: String(item.topic ?? item.chu_de ?? '').trim(),
        items,
        imageIndex
      });
      return;
    }

    const rawOptions = Array.isArray(item.o) ? item.o : (Array.isArray(item.options) ? item.options : []);
    const options = rawOptions.slice(0, 4).map((option) => String(option ?? '').trim());
    while (options.length < 4) options.push('');

    if (!questionText && options.every((option) => !option)) return;

    const answer = normalizeAnswerIndex(item.a);
    const aiChosen = allowAIAnswer
      ? normalizeAiChosen(item.ai_chon ?? item.aiChosen ?? item.aiAnswers, false)
      : false;
    const confidence = allowAIAnswer
      ? resolveConfidence(item.do_tin_cay, 5, aiChosen)
      : (normalizeConfidence(item.do_tin_cay) || (isValidAnswer(answer) ? 'cao' : 'thap'));

    result.push({
      id: uid('q'),
      type: 'tracnghiem',
      q: questionText,
      o: options,
      a: answer,
      e: String(item.e ?? item.explanation ?? '').trim(),
      aiAnswers: aiChosen,
      ai_chon: aiChosen,
      do_tin_cay: confidence,
      imageIndex
    });
  });
  return result;
}

function describeImageError(error) {
  if (error && Array.isArray(error.failures) && error.failures.length) {
    return `Không đọc được ảnh: ${error.failures.join(' | ')}`.slice(0, 900);
  }
  return shortError(error);
}

async function processImageEntries(entries, { allowAIAnswer, config, signal, label = 'Ảnh' }) {
  const allQuestions = [];
  const errors = [];
  const successfulUrls = new Set();
  let stoppedAt = -1;

  const addError = (entry, message) => {
    errors.push({
      file: entry.file.name,
      message,
      url: entry.url,
      imageIndex: entry.imageIndex
    });
  };

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const file = entry.file;
    const imageNo = entry.imageIndex || index + 1;
    const basePercent = (index / entries.length) * 100;

    if (signal?.aborted) {
      stoppedAt = index;
      break;
    }

    setProcessing(`${label} ${index + 1}/${entries.length}…`, 'Đang thu nhỏ và chuyển ảnh sang JPEG…', basePercent + 2);

    let dataUrl;
    try {
      dataUrl = await compressImage(file);
    } catch (error) {
      addError(entry, `Không đọc được ảnh: ${shortError(error)}`);
      setProcessing(
        `${label} ${index + 1}/${entries.length}…`,
        `Bỏ qua ảnh lỗi: ${file.name}`,
        ((index + 1) / entries.length) * 100
      );
      continue;
    }

    if (signal?.aborted) {
      addError(entry, 'Đã hủy xử lý ảnh này.');
      stoppedAt = index + 1;
      break;
    }

    try {
      setProcessing(`${label} ${index + 1}/${entries.length}…`, 'Đang gửi ảnh cho AI…', basePercent + 6);
      const parsed = await extractQuestionsFromImage(dataUrl, config, (detail) => {
        setProcessing(`${label} ${index + 1}/${entries.length}…`, detail, Math.min(96, basePercent + 6));
      }, allowAIAnswer, signal);
      const questions = normalizeExtractedQuestions(parsed, imageNo, allowAIAnswer);
      if (!questions.length) {
        addError(entry, 'AI không tìm thấy câu hỏi nào trong ảnh này.');
      } else {
        allQuestions.push(...questions);
        successfulUrls.add(entry.url);
      }
    } catch (error) {
      if (isAbortError(error) && signal?.aborted) {
        addError(entry, 'Đã hủy xử lý ảnh này.');
        stoppedAt = index + 1;
        break;
      }
      addError(entry, describeImageError(error));
    }

    setProcessing(
      `Đã xử lý ${index + 1}/${entries.length} ảnh…`,
      `Tích lũy ${allQuestions.length} câu hỏi, ${errors.length} ảnh lỗi.`,
      ((index + 1) / entries.length) * 100
    );
  }

  if (stoppedAt !== -1) {
    for (let index = stoppedAt; index < entries.length; index += 1) {
      addError(entries[index], 'Chưa xử lý do đã hủy.');
    }
  }

  return { allQuestions, errors, successfulUrls, aborted: stoppedAt !== -1 };
}

function cancelExtraction() {
  if (!state.processing || !state.extractionAbort || state.extractionAbort.signal.aborted) return;
  state.extractionAbort.abort();
  toast('Đang hủy tác vụ…', 'warning', 2000);
}

async function startExtraction() {
  if (state.processing) return;
  if (!state.selectedImages.length) {
    toast('Hãy chọn ít nhất một ảnh đề cương trước.', 'warning');
    return;
  }

  const config = persistSettingsFromForm(false);
  if (!config) return;
  if (!config.apiKey.trim()) {
    toast('Bạn cần nhập API key trong mục Cài đặt AI trước khi tách câu hỏi.', 'warning', 6000);
    openAISettings('apiKey');
    return;
  }

  if (state.checkDraft || loadCheckDraft()) {
    if (!window.confirm('Nháp cũ chưa lưu sẽ bị thay thế, tiếp tục?')) return;
    clearCheckDraft();
  }

  const entries = state.selectedImages.slice();
  const type = 5;
  const allowAIAnswer = Boolean(state.allowAIAnswer);
  const controller = new AbortController();

  state.extractionAbort = controller;
  state.processing = true;
  state.progress = {
    text: `Ảnh 1/${entries.length}…`,
    detail: 'Đang chuẩn bị xử lý…',
    percent: 0
  };
  renderHome();

  let result = { allQuestions: [], errors: [], successfulUrls: new Set(), aborted: false };
  try {
    result = await processImageEntries(entries, {
      allowAIAnswer,
      config,
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) result.aborted = true;
    else result.errors.push({ file: '—', message: describeImageError(error) });
  } finally {
    state.processing = false;
    state.extractionAbort = null;

    // Chỉ giải phóng các ảnh đã tách được câu hỏi; ảnh lỗi được giữ lại để thử lại.
    releaseSuccessfulImages(result.successfulUrls);

    const { allQuestions, errors, aborted } = result;
    if (!allQuestions.length && !errors.length && !aborted) {
      errors.push({ file: '—', message: 'Không tách được câu hỏi nào.' });
    }

    state.check = {
      mode: 'create',
      questions: allQuestions,
      errors,
      type,
      allowAIAnswer,
      name: makeDefaultDeckName(),
      filter: 'all'
    };
    state.session = null;
    state.result = null;
    renderCheck();
    saveCheckDraft();

    if (aborted) {
      toast(`Đã hủy tách câu hỏi. Giữ lại ${allQuestions.length} câu đã đọc được.`, 'warning', 5000);
    } else if (allQuestions.length) {
      toast(`Đã tách ${allQuestions.length} câu hỏi. Hãy kiểm tra lại trước khi lưu.`, 'success', 5500);
    } else {
      toast('Không tách được câu hỏi nào. Xem lỗi chi tiết ở màn hình kiểm tra.', 'error', 7000);
    }
  }
}

async function retryFailedImages() {
  if (state.processing || !state.check) return;
  const check = state.check;
  const failedUrls = new Set(check.errors.map((error) => error && error.url).filter(Boolean));
  const entries = state.selectedImages.filter((item) => failedUrls.has(item.url));
  if (!entries.length) {
    toast('Không còn ảnh lỗi để thử lại. Hãy quay lại và chọn lại ảnh.', 'warning', 6000);
    return;
  }

  const config = persistSettingsFromForm(false);
  if (!config) return;
  if (!config.apiKey.trim()) {
    toast('Bạn cần nhập API key trong mục Cài đặt AI trước khi thử lại.', 'warning', 6000);
    openAISettings('apiKey');
    return;
  }

  const controller = new AbortController();
  state.extractionAbort = controller;
  state.processing = true;
  state.progress = {
    text: `Thử lại ảnh 1/${entries.length}…`,
    detail: 'Đang chuẩn bị xử lý lại các ảnh lỗi…',
    percent: 0
  };
  renderCheck({ scroll: false });

  let result = { allQuestions: [], errors: [], successfulUrls: new Set(), aborted: false };
  try {
    result = await processImageEntries(entries, {
      allowAIAnswer: check.allowAIAnswer !== false,
      config,
      signal: controller.signal,
      label: 'Ảnh thử lại'
    });
  } catch (error) {
    if (isAbortError(error)) result.aborted = true;
    else result.errors.push({ file: '—', message: describeImageError(error) });
  } finally {
    state.processing = false;
    state.extractionAbort = null;
    releaseSuccessfulImages(result.successfulUrls);

    const retriedUrls = new Set(entries.map((item) => item.url));
    check.errors = check.errors
      .filter((error) => !retriedUrls.has(error && error.url))
      .concat(result.errors);
    check.questions.push(...result.allQuestions);
    check.filter = 'all';
    renderCheck({ scroll: false });
    saveCheckDraft();

    if (result.aborted) {
      toast('Đã hủy thử lại ảnh lỗi.', 'warning', 5000);
    } else if (result.allQuestions.length) {
      toast(`Đã thêm ${result.allQuestions.length} câu hỏi từ ảnh thử lại.`, 'success', 5000);
    } else {
      toast('Vẫn chưa đọc được câu hỏi nào từ các ảnh lỗi.', 'error', 6000);
    }
  }
}

async function addQuestionsFromImages() {
  if (state.processing || !state.check || state.check.mode !== 'edit') return;
  const check = state.check;
  const entries = Array.isArray(check.addImages) ? check.addImages.slice() : [];
  if (!entries.length) {
    toast('Hãy chọn ít nhất một ảnh trước khi tách.', 'warning');
    return;
  }

  const config = persistSettingsFromForm(false);
  if (!config) return;
  if (!config.apiKey.trim()) {
    toast('Bạn cần nhập API key trong mục Cài đặt AI trước khi tách câu hỏi.', 'warning', 6000);
    openAISettings('apiKey');
    return;
  }

  // Ảnh mới đánh số tiếp nối để nhãn "Ảnh N" không trùng với ảnh cũ trong bộ.
  const maxImageIndex = check.questions.reduce((max, question) => (
    Number.isInteger(question.imageIndex) && question.imageIndex > max ? question.imageIndex : max
  ), 0);
  const numberedEntries = entries.map((item, index) => ({
    ...item,
    imageIndex: maxImageIndex + index + 1
  }));
  entries.forEach((item) => {
    item.error = '';
  });

  const allowAIAnswer = check.addAllowAI !== false;
  const controller = new AbortController();
  state.extractionAbort = controller;
  state.processing = true;
  state.progress = {
    text: `Ảnh mới 1/${entries.length}…`,
    detail: 'Đang chuẩn bị tách câu hỏi…',
    percent: 0
  };
  renderCheck({ scroll: false });

  let result = { allQuestions: [], errors: [], successfulUrls: new Set(), aborted: false };
  let fallbackError = '';
  try {
    result = await processImageEntries(numberedEntries, {
      allowAIAnswer,
      config,
      signal: controller.signal,
      label: 'Ảnh mới'
    });
  } catch (error) {
    if (isAbortError(error)) {
      result.aborted = true;
    } else {
      fallbackError = describeImageError(error);
      result.errors.push({ file: '—', message: fallbackError });
    }
  } finally {
    state.processing = false;
    state.extractionAbort = null;

    // Chỉ ảnh tách thành công mới biến mất; ảnh lỗi giữ lại kèm thông báo trong card.
    releaseCheckAddImageUrls(result.successfulUrls);

    const errorByUrl = new Map();
    result.errors.forEach((error) => {
      if (!error || !error.url) return;
      const messages = errorByUrl.get(error.url) || [];
      messages.push(error.message);
      errorByUrl.set(error.url, messages);
    });
    check.addImages.forEach((item) => {
      const messages = errorByUrl.get(item.url);
      item.error = messages && messages.length ? messages.join(' · ') : fallbackError;
    });

    const addedQuestions = result.allQuestions.map((question) => ({ ...question, isNew: true }));
    check.questions.push(...addedQuestions);
    const duplicateIds = getDuplicateQuestionIds(check.questions);
    const newDuplicateCount = addedQuestions.filter((question) => duplicateIds.has(question.id)).length;
    check.filter = 'all';
    renderCheck({ scroll: false });
    if (addedQuestions.length) scrollToFirstNewQuestion(addedQuestions[0].id);
    saveCheckDraft();

    if (result.aborted) {
      let message = addedQuestions.length
        ? `Đã hủy tách ảnh. Giữ lại ${addedQuestions.length} câu mới đã đọc được.`
        : 'Đã hủy tách ảnh. Chưa có câu mới nào được thêm.';
      if (newDuplicateCount) message += ` Có ${newDuplicateCount} câu mới có thể trùng với câu cũ.`;
      toast(message, 'warning', 6500);
      return;
    }

    if (addedQuestions.length) {
      let message = `Đã thêm ${addedQuestions.length} câu từ ảnh. Hãy kiểm tra trước khi lưu.`;
      if (newDuplicateCount) message += ` Có ${newDuplicateCount} câu mới có thể trùng với câu cũ.`;
      if (check.addImages.length) message += ` Còn ${check.addImages.length} ảnh lỗi, có thể tách lại.`;
      toast(message, 'success', 7500);
    } else if (check.addImages.length) {
      toast('Chưa đọc được câu hỏi nào. Ảnh lỗi được giữ lại để thử tách lại.', 'error', 7000);
    } else {
      toast('Không tách được câu hỏi nào từ các ảnh đã chọn.', 'error', 7000);
    }
  }
}

