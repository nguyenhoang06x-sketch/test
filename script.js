'use strict';

/* =========================================================
   1. Hằng số, cấu hình mặc định và trạng thái ứng dụng
   ========================================================= */
const STORAGE_KEYS = Object.freeze({
  decks: 'dc_decks',
  config: 'dc_cfg',
  theme: 'theme' // Khóa giao diện theo yêu cầu, không dùng tiền tố dc_
});

const DEFAULT_CONFIG = Object.freeze({
  baseUrl: 'https://motapis.com/v1',
  apiKey: '',
  models: 'claude-sonnet-5-5, claude-sonnet-5, gpt-6-luna, claude-sonnet-4-6'
});

const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const REQUEST_TIMEOUT_MS = 120000;
const RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_WAITS = [5, 10, 20, 30];

const TYPE_INFO = {
  1: {
    short: 'Có sẵn A–D',
    title: 'Đề đã có lựa chọn A, B, C, D',
    desc: 'AI chép nguyên văn câu hỏi, các lựa chọn và tìm đáp án đúng theo dấu hiệu có trong ảnh.'
  },
  2: {
    short: 'Hỏi – đáp',
    title: 'Đề cương dạng hỏi – đáp',
    desc: 'Mỗi cặp hỏi – đáp thành một câu trắc nghiệm; AI tự soạn thêm 3 đáp án sai hợp lý.'
  },
  3: {
    short: 'AI tạo đáp án',
    title: 'Đề chỉ có câu hỏi',
    desc: 'AI tự soạn 4 đáp án, chọn đáp án đúng theo kiến thức và kèm giải thích ngắn.'
  }
};

const PROMPTS = {
  1: `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Mỗi câu phải có đúng 4 lựa chọn trong mảng "o", không thêm ký hiệu A., B., C., D. ở đầu nội dung lựa chọn.
4. "a" là chỉ số 0, 1, 2 hoặc 3 của đáp án đúng trong mảng "o"; dùng null nếu không thể xác định chắc chắn.
5. "e" là giải thích ngắn gọn bằng tiếng Việt; có thể để chuỗi rỗng nếu không cần thiết.
6. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"q":"câu hỏi","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":0,"e":"giải thích ngắn"}]}

NHIỆM VỤ RIÊNG:
Ảnh là đề cương trắc nghiệm đã có sẵn các lựa chọn A, B, C, D. Hãy chép nguyên văn câu hỏi và nội dung các lựa chọn, bỏ ký hiệu A., B., C., D. ở đầu mỗi lựa chọn. Xác định đáp án đúng dựa vào dấu hiệu trong ảnh như gạch chân, tô đậm, khoanh tròn, đánh dấu tích, tô màu hoặc bảng đáp án. Nếu không thấy dấu hiệu rõ ràng, đặt "a": null. Không tự suy đoán đáp án khi ảnh không có dấu hiệu.`,
  2: `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Mỗi câu phải có đúng 4 lựa chọn trong mảng "o", không thêm ký hiệu A., B., C., D. ở đầu nội dung lựa chọn.
4. "a" là chỉ số 0, 1, 2 hoặc 3 của đáp án đúng trong mảng "o".
5. "e" là giải thích ngắn gọn bằng tiếng Việt; có thể để chuỗi rỗng.
6. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"q":"câu hỏi","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":0,"e":"giải thích ngắn"}]}

NHIỆM VỤ RIÊNG:
Ảnh là đề cương dạng hỏi – đáp. Mỗi cặp câu hỏi và câu trả lời trong ảnh phải trở thành một câu trắc nghiệm. Nội dung "q" là câu hỏi; đáp án đúng lấy từ câu trả lời trong ảnh (rút gọn vừa đủ nếu câu trả lời quá dài, nhưng giữ đúng ý). Hãy tự soạn thêm 3 đáp án sai hợp lý, cùng văn phong và độ dài tương đương, không trùng với đáp án đúng. Đặt đáp án đúng ở vị trí ngẫu nhiên trong 4 lựa chọn và ghi đúng chỉ số vào "a". Chỉ dùng kiến thức trong ảnh để xác định đáp án đúng; không đổi câu trả lời gốc.`,
  3: `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Mỗi câu phải có đúng 4 lựa chọn trong mảng "o", không thêm ký hiệu A., B., C., D. ở đầu nội dung lựa chọn.
4. "a" là chỉ số 0, 1, 2 hoặc 3 của đáp án đúng trong mảng "o".
5. "e" là giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đó đúng.
6. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"q":"câu hỏi","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":0,"e":"giải thích ngắn"}]}

NHIỆM VỤ RIÊNG:
Ảnh chỉ có câu hỏi, chưa có đáp án. Với mỗi câu hỏi trong ảnh, hãy tự soạn 4 đáp án ngắn gọn, rõ ràng, hợp lý; chỉ có một đáp án đúng theo kiến thức. Chọn đáp án đúng, ghi chỉ số vào "a" và viết "e" giải thích ngắn. Các đáp án sai phải có văn phong và độ dài tương đương, không quá dễ loại trừ. Không bịa thêm câu hỏi ngoài ảnh.`
};

const state = {
  view: 'home',
  cfg: null,
  selectedImages: [], // [{ file, url }]
  draftType: 1,
  processing: false,
  progress: { text: '', detail: '', percent: 0 },
  check: null,
  session: null,
  result: null
};

const app = document.getElementById('app');
const toastContainer = document.getElementById('toastContainer');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const brandHome = document.getElementById('brandHome');
const aiBubble = document.getElementById('aiBubble');
const aiBubbleToggle = document.getElementById('aiBubbleToggle');
const aiSettingsPanel = document.getElementById('aiSettingsPanel');
const aiBubbleDot = document.getElementById('aiBubbleDot');

let examClock = null;

/* =========================================================
   2. Biểu tượng SVG dùng lại
   ========================================================= */
const ICONS = {
  sparkles: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/><path d="M5 14l.7 2.1L8 17l-2.3.9L5 20l-.7-2.1L2 17l2.3-.9L5 14Z"/>',
  upload: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 16 5-4 4 3 3-2 6 5"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  shield: '<path d="M12 3l7 3v5c0 4.7-3 8-7 10-4-2-7-5.3-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.5 2c-.8.5-1.3 1-1.3 2M12 17h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5M3 17l9 5 9-5"/>',
  play: '<path d="M8 5v14l11-7L8 5Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5"/><path d="M5 20h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  import: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M5 14v5h14v-5"/>',
  arrowLeft: '<path d="M19 12H5m0 0 6-6m-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
  save: '<path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  warning: '<path d="M10.3 4.2 2.8 17.5A1.8 1.8 0 0 0 4.4 20h15.2a1.8 1.8 0 0 0 1.6-2.5L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8.5A7 7 0 0 1 18.6 7M17.9 15.5A7 7 0 0 1 5.4 17"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18M10.6 6.1A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.7M6.2 6.3C4 7.9 2.5 12 2.5 12S6 18 12 18c1.2 0 2.3-.2 3.3-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  award: '<circle cx="12" cy="8" r="5"/><path d="m9 12-1 9 4-2 4 2-1-9"/>'
};

function icon(name, className = 'icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* =========================================================
   3. Tiện ích chung
   ========================================================= */
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

function uid(prefix = 'id') {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isValidAnswer(value) {
  return Number.isInteger(value) && value >= 0 && value <= 3;
}

function normalizeAnswerIndex(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && isValidAnswer(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().toUpperCase();
    if (/^[0-3]$/.test(trimmed)) return Number(trimmed);
    if (/^[A-D]$/.test(trimmed)) return LETTERS.indexOf(trimmed);
  }
  return null;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không rõ ngày';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function makeDefaultDeckName() {
  return `Đề cương ${new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })}`;
}

function scrollToTop(smooth = false) {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

function shortError(error) {
  let message = error && error.message ? error.message : String(error || 'Lỗi không xác định');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    message = 'Không kết nối được API (kiểm tra mạng, địa chỉ API hoặc CORS của máy chủ).';
  }
  if (error && error.name === 'AbortError') {
    message = 'Máy chủ phản hồi quá lâu nên yêu cầu đã bị dừng.';
  }
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

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
  state.view = 'home';

  const decks = getDecks();
  const totalQuestions = decks.reduce((sum, deck) => sum + deck.questions.length, 0);
  const canStart = state.selectedImages.length > 0 && !state.processing;

  app.innerHTML = `
    <section class="hero">
      <span class="eyebrow">${icon('sparkles')} AI đọc ảnh đề cương</span>
      <h1>Biến ảnh đề cương thành <span class="gradient-text">bài trắc nghiệm</span> để ôn tập</h1>
      <p>Tải ảnh đề cương, để AI tách câu hỏi và đáp án, rồi luyện tập hoặc thi thử ngay trên trình duyệt. Mọi dữ liệu được lưu trên máy của bạn.</p>
      <div class="hero__stats">
        <span class="hero__stat">${icon('layers')} 3 kiểu đề cương</span>
        <span class="hero__stat">${icon('play')} Luyện tập tức thì</span>
        <span class="hero__stat">${icon('clock')} Thi thử có hẹn giờ</span>
        <span class="hero__stat">${icon('shield')} Lưu bằng localStorage</span>
      </div>
    </section>

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
          <span>hoặc kéo thả ảnh vào đây</span>
          <small>Hỗ trợ JPG, PNG, WEBP… · nên chụp rõ nét, đủ sáng</small>
        </label>

        ${renderPreviewArea()}

        <div class="type-section">
          <h3>Chọn loại đề cương</h3>
          <p>Mỗi loại dùng một cách đọc và tạo đáp án riêng.</p>
          <div class="type-options">
            ${[1, 2, 3].map((type) => `
              <label class="type-option">
                <input type="radio" name="draftType" value="${type}" ${state.draftType === type ? 'checked' : ''} ${state.processing ? 'disabled' : ''}>
                <span class="type-option__body">
                  <span class="type-option__title">${esc(getTypeInfo(type).title)}</span>
                  <span class="type-option__desc">${esc(getTypeInfo(type).desc)}</span>
                </span>
              </label>
            `).join('')}
          </div>
        </div>

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
          <button class="btn btn--soft" type="button" data-action="import-deck">${icon('import')} Nhập bộ câu hỏi</button>
        </div>
      </div>
      ${decks.length
        ? `<div class="deck-list">${decks.map(renderDeckCard).join('')}</div>`
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
        <span>${state.selectedImages.length} ảnh đã chọn</span>
        <button class="btn btn--ghost btn--sm" type="button" data-action="clear-images" ${state.processing ? 'disabled' : ''}>Bỏ tất cả</button>
      </div>
      <div class="preview-grid">
        ${state.selectedImages.map((item, index) => `
          <article class="preview-item">
            <img src="${esc(item.url)}" alt="Xem trước ${esc(item.file.name)}" loading="lazy">
            <button class="preview-remove" type="button" data-action="remove-image" data-index="${index}" aria-label="Bỏ ảnh ${esc(item.file.name)}" title="Bỏ ảnh" ${state.processing ? 'disabled' : ''}>${icon('x')}</button>
            <div class="preview-item__meta">
              <span class="preview-item__name" title="${esc(item.file.name)}">${esc(item.file.name)}</span>
              <span class="preview-item__size">${formatFileSize(item.file.size)}</span>
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
    </div>
  `;
}

function renderDeckCard(deck) {
  const typeInfo = getTypeInfo(deck.type);
  return `
    <article class="deck-card">
      <div class="deck-card__head">
        <span class="deck-card__icon">${icon('layers')}</span>
        <div class="deck-card__title">
          <h3>${esc(deck.name)}</h3>
          <div class="deck-card__meta">
            <span>${icon('help')} ${deck.questions.length} câu</span>
            <span>${icon('calendar')} ${esc(formatDate(deck.createdAt))}</span>
            <span>${icon('sparkles')} ${esc(typeInfo.short)}</span>
          </div>
        </div>
      </div>
      <div class="deck-card__actions">
        <button class="btn btn--primary btn--sm" type="button" data-action="practice-deck" data-id="${esc(deck.id)}">${icon('play')} Luyện tập</button>
        <button class="btn btn--soft btn--sm" type="button" data-action="exam-deck" data-id="${esc(deck.id)}">${icon('clock')} Thi thử</button>
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

/* =========================================================
   6. Chọn ảnh, thu nhỏ ảnh và gọi AI
   ========================================================= */
function isImageFile(file) {
  if (!file) return false;
  return /^image\//i.test(file.type || '') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
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
  state.selectedImages = images.map((file) => ({
    file,
    url: URL.createObjectURL(file)
  }));
  renderHome();
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
  renderHome();
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

async function callModelAPI(config, model, dataUrl, prompt) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
  }
}

function waitWithCountdown(seconds, onTick) {
  return new Promise((resolve) => {
    let remaining = Math.max(1, Math.ceil(seconds));
    if (onTick) onTick(remaining);
    const timer = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(timer);
        if (onTick) onTick(0);
        resolve();
      } else if (onTick) {
        onTick(remaining);
      }
    }, 1000);
  });
}

async function extractQuestionsFromImage(dataUrl, type, config, onStatus) {
  const models = parseModelList(config.models);
  const prompt = PROMPTS[Number(type)] || PROMPTS[1];
  const failures = [];

  for (const model of models) {
    if (onStatus) onStatus(`Đang đọc bằng model ${model}…`);
    let retries = 0;

    while (true) {
      try {
        const parsed = await callModelAPI(config, model, dataUrl, prompt);
        if (!Array.isArray(parsed) && !Array.isArray(parsed?.questions)) {
          throw new Error('Model trả về JSON thiếu mảng "questions".');
        }
        return parsed;
      } catch (error) {
        if (isRateLimitError(error) && retries < RATE_LIMIT_RETRIES) {
          const waitSeconds = RATE_LIMIT_WAITS[retries] ?? 30;
          retries += 1;
          await waitWithCountdown(waitSeconds, (remaining) => {
            if (onStatus) {
              onStatus(`Model ${model} bị giới hạn tốc độ (429). Thử lại sau ${Math.max(1, remaining)} giây…`);
            }
          });
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

function normalizeExtractedQuestions(parsed, type, imageIndex) {
  const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new Error('AI không trả về mảng "questions" đúng định dạng.');
  }

  const result = [];
  rawQuestions.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const questionText = String(item.q ?? item.question ?? '').trim();
    const rawOptions = Array.isArray(item.o) ? item.o : (Array.isArray(item.options) ? item.options : []);
    const options = rawOptions.slice(0, 4).map((option) => String(option ?? '').trim());
    while (options.length < 4) options.push('');

    if (!questionText && options.every((option) => !option)) return;

    result.push({
      id: uid('q'),
      q: questionText,
      o: options,
      a: normalizeAnswerIndex(item.a),
      e: String(item.e ?? item.explanation ?? '').trim(),
      aiAnswers: Number(type) !== 1,
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

  const files = state.selectedImages.map((item) => item.file);
  const type = Number(state.draftType) || 1;
  const allQuestions = [];
  const errors = [];

  state.processing = true;
  state.progress = {
    text: `Ảnh 1/${files.length}…`,
    detail: 'Đang chuẩn bị xử lý…',
    percent: 0
  };
  renderHome();

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const imageNo = index + 1;
      const basePercent = (index / files.length) * 100;
      setProcessing(`Ảnh ${imageNo}/${files.length}…`, 'Đang thu nhỏ và chuyển ảnh sang JPEG…', basePercent + 2);

      let dataUrl;
      try {
        dataUrl = await compressImage(file);
      } catch (error) {
        errors.push({ file: file.name, message: `Không đọc được ảnh: ${shortError(error)}` });
        setProcessing(`Ảnh ${imageNo}/${files.length}…`, `Bỏ qua ảnh lỗi: ${file.name}`, ((index + 1) / files.length) * 100);
        continue;
      }

      try {
        setProcessing(`Ảnh ${imageNo}/${files.length}…`, `Đang gửi ảnh cho AI…`, basePercent + 6);
        const parsed = await extractQuestionsFromImage(dataUrl, type, config, (detail) => {
          setProcessing(`Ảnh ${imageNo}/${files.length}…`, detail, Math.min(96, basePercent + 6));
        });
        const questions = normalizeExtractedQuestions(parsed, type, imageNo);
        if (!questions.length) {
          errors.push({ file: file.name, message: 'AI không tìm thấy câu hỏi nào trong ảnh này.' });
        } else {
          allQuestions.push(...questions);
        }
      } catch (error) {
        errors.push({ file: file.name, message: describeImageError(error) });
      }

      setProcessing(
        `Đã xử lý ${imageNo}/${files.length} ảnh…`,
        `Tích lũy ${allQuestions.length} câu hỏi, ${errors.length} ảnh lỗi.`,
        ((index + 1) / files.length) * 100
      );
    }
  } finally {
    state.processing = false;
    cleanupSelectedImages();

    if (!allQuestions.length && !errors.length) {
      errors.push({ file: '—', message: 'Không tách được câu hỏi nào.' });
    }

    state.check = {
      questions: allQuestions,
      errors,
      type,
      name: makeDefaultDeckName()
    };
    state.session = null;
    state.result = null;
    renderCheck();

    if (allQuestions.length) {
      toast(`Đã tách ${allQuestions.length} câu hỏi. Hãy kiểm tra lại trước khi lưu.`, 'success', 5500);
    } else {
      toast('Không tách được câu hỏi nào. Xem lỗi chi tiết ở màn hình kiểm tra.', 'error', 7000);
    }
  }
}

/* =========================================================
   7. Màn hình kiểm tra câu hỏi sau khi AI tách
   ========================================================= */
function getCheckAnalysis() {
  const questions = state.check?.questions || [];
  const unanswered = questions.filter((question) => !isValidAnswer(question.a)).length;
  const incomplete = questions.filter((question) => {
    if (!String(question.q || '').trim()) return true;
    if (!Array.isArray(question.o) || question.o.length !== 4) return true;
    return question.o.some((option) => !String(option || '').trim());
  }).length;
  return {
    total: questions.length,
    unanswered,
    incomplete,
    canSave: questions.length > 0 && unanswered === 0 && incomplete === 0
  };
}

function renderCheckButtons() {
  const disabled = getCheckAnalysis().canSave ? '' : 'disabled';
  return `
    <button class="btn btn--ghost" type="button" data-action="cancel-check">${icon('x')} Hủy</button>
    <button class="btn btn--primary" type="button" data-action="save-check" ${disabled}>${icon('save')} Lưu bộ câu hỏi</button>
  `;
}

function renderCheck() {
  if (!state.check) {
    renderHome();
    return;
  }
  clearExamClock();
  state.view = 'check';
  const check = state.check;
  const questions = check.questions;
  const typeInfo = getTypeInfo(check.type);

  app.innerHTML = `
    <button class="btn btn--ghost back-button" type="button" data-action="cancel-check">${icon('arrowLeft')} Quay lại</button>
    <div class="view-head">
      <div>
        <h1>Kiểm tra lại câu hỏi</h1>
        <p>${questions.length ? `AI đã tách ${questions.length} câu từ ${new Set(questions.map((q) => q.imageIndex)).size} ảnh.` : 'Chưa có câu hỏi nào được tách thành công.'} Chỉnh sửa nội dung và chọn đáp án đúng trước khi lưu.</p>
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

      ${check.errors.length ? `
        <section class="error-list" aria-labelledby="errorListTitle">
          <h2 id="errorListTitle">${icon('warning')} Ảnh không xử lý được (${check.errors.length})</h2>
          <ul>
            ${check.errors.map((error) => `<li><strong>${esc(error.file)}:</strong> ${esc(error.message)}</li>`).join('')}
          </ul>
        </section>
      ` : ''}

      ${questions.length ? `
        <div class="check-list">
          ${questions.map((question, index) => renderCheckQuestion(question, index)).join('')}
        </div>
        <section class="card check-toolbar" aria-label="Lưu bộ câu hỏi">
          <div>
            <strong>${questions.length} câu hỏi</strong><br>
            <span class="muted">Kiểm tra kỹ nội dung do AI tách và các đáp án tự soạn.</span>
          </div>
          <div class="check-toolbar__actions">
            ${renderCheckButtons()}
          </div>
        </section>
      ` : `
        <div class="empty-state">
          <span class="empty-state__icon">${icon('image')}</span>
          <h3>Không có câu hỏi để lưu</h3>
          <p>Hãy quay lại, kiểm tra API key/model và thử tải ảnh rõ nét hơn. Các lỗi chi tiết nằm ở phía trên.</p>
        </div>
      `}
    </div>
  `;

  updateCheckStatus();
  scrollToTop();
}

function renderCheckQuestion(question, index) {
  const answerOptions = Array.isArray(question.o) ? question.o : ['', '', '', ''];
  return `
    <article class="check-card card" data-qid="${esc(question.id)}">
      <div class="check-card__head">
        <span class="tag">Câu ${index + 1}</span>
        <span class="tag tag--image">${icon('image')} Ảnh ${question.imageIndex || '?'}</span>
        ${question.aiAnswers ? `<span class="tag tag--ai">${icon('sparkles')} AI soạn đáp án</span>` : ''}
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

      <div class="check-field">
        <label for="explanation-${esc(question.id)}">Giải thích (không bắt buộc)</label>
        <textarea id="explanation-${esc(question.id)}" data-field="e" aria-label="Giải thích cho câu ${index + 1}" placeholder="Giải thích ngắn…">${esc(question.e)}</textarea>
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
    button.disabled = !analysis.canSave;
  });
  if (!status) return;

  let message = '';
  let mode = 'ok';

  if (!analysis.total) {
    mode = 'warn';
    message = 'Chưa có câu hỏi nào để lưu. Hãy quay lại và tải ảnh khác.';
  } else if (!analysis.canSave) {
    mode = 'warn';
    const problems = [];
    if (analysis.unanswered) {
      problems.push(`${analysis.unanswered} câu chưa chọn đáp án đúng`);
    }
    if (analysis.incomplete) {
      problems.push(`${analysis.incomplete} câu còn nội dung hoặc đáp án bị trống`);
    }
    message = `Chưa thể lưu: ${problems.join(' và ')}.`;
  } else {
    message = `Đã sẵn sàng lưu ${analysis.total} câu hỏi.`;
  }

  status.className = `check-status check-status--${mode}`;
  status.innerHTML = `${icon(mode === 'ok' ? 'check' : 'warning')}<span>${esc(message)}</span>`;
}

function savePendingCheck() {
  if (!state.check) return;
  const analysis = getCheckAnalysis();
  if (!analysis.total) {
    toast('Không có câu hỏi nào để lưu.', 'warning');
    return;
  }
  if (analysis.unanswered) {
    toast(`Còn ${analysis.unanswered} câu chưa chọn đáp án đúng.`, 'error');
    return;
  }
  if (analysis.incomplete) {
    toast('Còn câu hỏi hoặc đáp án đang để trống. Hãy điền đủ trước khi lưu.', 'error');
    return;
  }

  const questions = state.check.questions.map((question) => ({
    id: uid('q'),
    q: String(question.q || '').trim(),
    o: question.o.map((option) => String(option || '').trim()),
    a: question.a,
    e: String(question.e || '').trim(),
    aiAnswers: Boolean(question.aiAnswers),
    imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
  }));

  const deck = {
    id: uid('deck'),
    name: String(state.check.name || '').trim() || makeDefaultDeckName(),
    createdAt: new Date().toISOString(),
    type: Number(state.check.type) || 1,
    questions
  };

  const decks = getDecks();
  if (!writeJSON(STORAGE_KEYS.decks, [deck, ...decks])) return;

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
  const hasData = state.check.questions.length || state.check.errors.length;
  if (hasData && !window.confirm('Hủy kết quả đã tách? Các chỉnh sửa hiện tại sẽ bị mất.')) return;
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
}

/* =========================================================
   8. Lưu trữ bộ câu hỏi, nhập và xuất JSON
   ========================================================= */
function getDecks() {
  const raw = readJSON(STORAGE_KEYS.decks, []);
  if (!Array.isArray(raw)) return [];

  const decks = [];
  raw.forEach((deck) => {
    if (!deck || typeof deck !== 'object' || !Array.isArray(deck.questions)) return;

    const questions = [];
    deck.questions.forEach((question) => {
      if (!question || typeof question !== 'object') return;
      const text = String(question.q || '').trim();
      const rawOptions = Array.isArray(question.o) ? question.o : [];
      const options = rawOptions.slice(0, 4).map((option) => String(option ?? '').trim());
      while (options.length < 4) options.push('');
      const answer = normalizeAnswerIndex(question.a);
      if (!text || !isValidAnswer(answer) || options.some((option) => !option)) return;

      questions.push({
        id: typeof question.id === 'string' && question.id ? question.id : uid('q'),
        q: text,
        o: options,
        a: answer,
        e: String(question.e || '').trim(),
        aiAnswers: Boolean(question.aiAnswers),
        imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
      });
    });

    if (!questions.length) return;
    const type = [1, 2, 3].includes(Number(deck.type)) ? Number(deck.type) : 1;
    decks.push({
      id: typeof deck.id === 'string' && deck.id ? deck.id : uid('deck'),
      name: String(deck.name || '').trim() || 'Bộ câu hỏi',
      createdAt: deck.createdAt || new Date().toISOString(),
      type,
      questions
    });
  });
  return decks;
}

function getDeckById(deckId) {
  return getDecks().find((deck) => deck.id === deckId) || null;
}

function deleteDeck(deckId) {
  const decks = getDecks();
  const deck = decks.find((item) => item.id === deckId);
  if (!deck) {
    toast('Không tìm thấy bộ câu hỏi.', 'error');
    return;
  }
  if (!window.confirm(`Xóa bộ "${deck.name}"? Thao tác này không thể hoàn tác.`)) return;
  const remaining = decks.filter((item) => item.id !== deckId);
  if (!writeJSON(STORAGE_KEYS.decks, remaining)) return;
  renderHome();
  toast('Đã xóa bộ câu hỏi.', 'success');
}

function safeFileName(name) {
  const safe = String(name || 'de-cuong')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return safe || 'de-cuong';
}

function exportDeck(deckId) {
  const deck = getDeckById(deckId);
  if (!deck) {
    toast('Không tìm thấy bộ câu hỏi để xuất.', 'error');
    return;
  }

  const payload = {
    app: 'on-de-cuong-tu-anh',
    version: 1,
    name: deck.name,
    type: deck.type,
    createdAt: deck.createdAt,
    questions: deck.questions.map((question) => ({
      q: question.q,
      o: question.o,
      a: question.a,
      e: question.e,
      aiAnswers: question.aiAnswers,
      imageIndex: question.imageIndex
    }))
  };

  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(deck.name)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Đã xuất file JSON của bộ câu hỏi.', 'success');
  } catch (error) {
    toast(`Không xuất được file: ${shortError(error)}`, 'error');
  }
}

function normalizeImportedDeck(data, fileName) {
  if (!data || typeof data !== 'object') {
    throw new Error('Nội dung file không phải JSON hợp lệ.');
  }
  const rawQuestions = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(rawQuestions) || !rawQuestions.length) {
    throw new Error('File không có danh sách câu hỏi.');
  }

  const type = [1, 2, 3].includes(Number(data.type)) ? Number(data.type) : 1;
  const fallbackName = String(fileName || 'Bộ câu hỏi').replace(/\.json$/i, '').trim();
  const name = !Array.isArray(data) && String(data.name || '').trim()
    ? String(data.name).trim()
    : (fallbackName || 'Bộ câu hỏi');

  const questions = rawQuestions.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Câu ${index + 1} không hợp lệ.`);
    }
    const text = String(item.q ?? item.question ?? '').trim();
    const rawOptions = item.o ?? item.options;
    if (!text) throw new Error(`Câu ${index + 1} thiếu nội dung câu hỏi.`);
    if (!Array.isArray(rawOptions) || rawOptions.length !== 4) {
      throw new Error(`Câu ${index + 1} phải có đúng 4 đáp án.`);
    }
    const options = rawOptions.map((option) => String(option ?? '').trim());
    if (options.some((option) => !option)) {
      throw new Error(`Câu ${index + 1} có đáp án bị trống.`);
    }
    const answer = normalizeAnswerIndex(item.a ?? item.answer);
    if (!isValidAnswer(answer)) {
      throw new Error(`Câu ${index + 1} chưa có đáp án đúng hợp lệ (0–3).`);
    }
    return {
      id: uid('q'),
      q: text,
      o: options,
      a: answer,
      e: String(item.e ?? item.explanation ?? '').trim(),
      aiAnswers: Boolean(item.aiAnswers) || type !== 1,
      imageIndex: Number.isInteger(item.imageIndex) ? item.imageIndex : null
    };
  });

  const createdAt = !Array.isArray(data) && data.createdAt && !Number.isNaN(new Date(data.createdAt).getTime())
    ? data.createdAt
    : new Date().toISOString();

  return {
    id: uid('deck'),
    name,
    createdAt,
    type,
    questions
  };
}

async function importDeckFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('File JSON quá lớn (giới hạn 10 MB).', 'error');
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text.replace(/^\uFEFF/, ''));
    const deck = normalizeImportedDeck(data, file.name);
    const decks = getDecks();
    if (!writeJSON(STORAGE_KEYS.decks, [deck, ...decks])) return;
    renderHome();
    scrollToTop();
    toast(`Đã nhập bộ "${deck.name}" với ${deck.questions.length} câu hỏi.`, 'success', 5000);
  } catch (error) {
    toast(`Không nhập được bộ câu hỏi: ${shortError(error)}`, 'error', 8000);
  }
}

/* =========================================================
   9. Chuẩn bị phiên làm bài, luyện tập và kết quả
   ========================================================= */
function prepareSessionQuestion(question) {
  const options = Array.isArray(question.o)
    ? question.o.slice(0, 4).map((option) => String(option || '').trim())
    : [];
  while (options.length < 4) options.push('');
  const correctIndex = isValidAnswer(question.a) ? question.a : 0;
  const order = shuffle([0, 1, 2, 3]);

  return {
    sourceId: question.id,
    q: String(question.q || '').trim(),
    o: order.map((index) => options[index]),
    a: order.indexOf(correctIndex),
    e: String(question.e || '').trim(),
    aiAnswers: Boolean(question.aiAnswers),
    imageIndex: question.imageIndex
  };
}

function clearExamClock() {
  if (examClock) {
    window.clearInterval(examClock);
    examClock = null;
  }
}

function startPractice(deck, sourceQuestions = null) {
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
  const questions = shuffle(pool.map(prepareSessionQuestion));
  state.result = null;
  state.session = {
    mode: 'practice',
    deck,
    questions,
    answers: new Array(questions.length).fill(null),
    current: 0
  };
  renderPractice();
  scrollToTop();
}

function startExam(deck) {
  if (!deck || !Array.isArray(deck.questions) || !deck.questions.length) {
    toast('Bộ câu hỏi không có dữ liệu để thi thử.', 'error');
    return;
  }

  clearExamClock();
  const questions = shuffle(deck.questions.map(prepareSessionQuestion));
  const durationMinutes = Math.max(10, questions.length * 0.75);
  state.result = null;
  state.session = {
    mode: 'exam',
    deck,
    questions,
    answers: new Array(questions.length).fill(null),
    current: 0,
    endAt: Date.now() + durationMinutes * 60 * 1000,
    durationMinutes,
    submitted: false
  };
  renderExam();
  scrollToTop();
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

function renderPractice() {
  const session = state.session;
  if (!session || session.mode !== 'practice') {
    renderHome();
    return;
  }
  state.view = 'practice';

  const question = session.questions[session.current];
  const selected = session.answers[session.current];
  const answered = selected !== null && selected !== undefined;
  const isCorrect = answered && selected === question.a;
  const progressPercent = ((session.current + 1) / session.questions.length) * 100;
  const isLast = session.current === session.questions.length - 1;

  app.innerHTML = `
    <div class="quiz-wrap">
      <div class="quiz-top">
        <div class="quiz-top__info">
          <h1>${esc(session.deck.name)}</h1>
          <p>Luyện tập · Chọn đáp án để xem kết quả ngay</p>
        </div>
        <div class="quiz-actions-top">
          <button class="btn btn--ghost btn--sm" type="button" data-action="quit-session">${icon('x')} Thoát</button>
        </div>
      </div>

      <section class="card quiz-progress-card" aria-label="Tiến độ luyện tập">
        <div class="quiz-progress-head">
          <span>Câu <strong>${session.current + 1}</strong> / ${session.questions.length}</span>
          <span>${Math.round(progressPercent)}%</span>
        </div>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progressPercent)}">
          <span class="progress__bar" style="width:${progressPercent}%"></span>
        </div>
      </section>

      <section class="card quiz-question-card" aria-labelledby="practiceQuestion">
        <div class="quiz-progress-head">
          <span>Câu hỏi ${session.current + 1}</span>
          ${question.aiAnswers ? `<span class="tag tag--ai">${icon('sparkles')} AI soạn đáp án</span>` : ''}
        </div>
        <h2 class="quiz-question" id="practiceQuestion">${esc(question.q)}</h2>

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

        ${answered ? `
          <div class="explanation" role="status" aria-live="polite">
            <span class="explanation__icon">${icon(isCorrect ? 'check' : 'info')}</span>
            <div>
              <strong>${isCorrect ? 'Chính xác!' : `Chưa chính xác. Đáp án đúng là ${LETTERS[question.a]}.`}</strong>
              <p>${esc(question.e || (isCorrect ? 'Bạn đã chọn đúng đáp án của câu này.' : 'Hãy xem lại đáp án được viền xanh ở trên.'))}</p>
            </div>
          </div>
        ` : ''}

        <div class="quiz-footer">
          <span class="quiz-footer__hint">${answered ? 'Đáp án đã được khóa cho câu này.' : 'Chọn một đáp án để tiếp tục.'}</span>
          <button class="btn btn--primary" type="button" data-action="practice-next" ${answered ? '' : 'disabled'}>
            ${isLast ? 'Xem kết quả' : 'Câu tiếp'} ${icon('arrowRight')}
          </button>
        </div>
      </section>
    </div>
  `;
}

function finishSession() {
  const session = state.session;
  if (!session) return;
  clearExamClock();
  const result = buildResult(session, false);
  state.result = result;
  state.session = null;
  renderResult();
  scrollToTop();
}

function buildResult(session, autoSubmitted = false) {
  const wrong = [];
  let correctCount = 0;

  session.questions.forEach((question, index) => {
    const chosen = session.answers[index];
    if (chosen === question.a) {
      correctCount += 1;
    } else {
      wrong.push({
        index,
        chosen,
        question
      });
    }
  });

  const total = session.questions.length;
  const score = total ? Math.round((correctCount / total) * 100) / 10 : 0;
  const scorePct = total ? Math.round((correctCount / total) * 100) : 0;

  return {
    mode: session.mode,
    deck: session.deck,
    autoSubmitted,
    total,
    correctCount,
    wrongCount: total - correctCount,
    score,
    scorePct,
    wrong
  };
}

function renderResult() {
  const result = state.result;
  if (!result) {
    renderHome();
    return;
  }
  state.view = 'result';
  clearExamClock();

  const title = result.mode === 'exam'
    ? (result.autoSubmitted ? 'Hết giờ – đã nộp bài' : 'Kết quả thi thử')
    : 'Hoàn thành luyện tập';
  const subtitle = result.mode === 'exam'
    ? `Bài thi thử · ${esc(result.deck.name)}`
    : `Luyện tập · ${esc(result.deck.name)}`;
  const scoreText = Number.isInteger(result.score) ? String(result.score) : result.score.toFixed(1);

  app.innerHTML = `
    <div class="result-wrap">
      <section class="card result-card">
        <div class="result-hero">
          <span class="eyebrow">${icon('award')} ${result.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}</span>
          <h1>${esc(title)}</h1>
          <p>${subtitle} · ${result.correctCount}/${result.total} câu đúng</p>

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
              <span>Câu đúng</span>
            </div>
            <div class="result-stat result-stat--bad">
              <strong>${result.wrongCount}</strong>
              <span>Câu sai</span>
            </div>
          </div>

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
              ${result.wrong.map((item) => {
                const chosenText = item.chosen === null || item.chosen === undefined
                  ? 'Chưa trả lời'
                  : `${LETTERS[item.chosen]}. ${item.question.o[item.chosen]}`;
                const correctText = `${LETTERS[item.question.a]}. ${item.question.o[item.question.a]}`;
                return `
                  <article class="wrong-item">
                    <div class="check-card__head">
                      <span class="tag">Câu ${item.index + 1}</span>
                      ${item.question.aiAnswers ? `<span class="tag tag--ai">${icon('sparkles')} AI soạn đáp án</span>` : ''}
                    </div>
                    <h3>${esc(item.question.q)}</h3>
                    <p class="is-chosen">Bạn chọn: <strong>${esc(chosenText)}</strong></p>
                    <p class="is-correct">Đáp án đúng: <strong>${esc(correctText)}</strong></p>
                    ${item.question.e ? `<p class="wrong-explanation">${esc(item.question.e)}</p>` : ''}
                  </article>
                `;
              }).join('')}
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
  const question = session.questions[session.current];
  const selected = session.answers[session.current];
  const answeredCount = session.answers.filter((answer) => answer !== null && answer !== undefined).length;
  const answeredPercent = (answeredCount / session.questions.length) * 100;
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
          <span>Đã trả lời <strong>${answeredCount}</strong> / ${session.questions.length} câu</span>
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
            ${question.aiAnswers ? `<span class="tag tag--ai">${icon('sparkles')} AI soạn đáp án</span>` : ''}
          </div>
          <h2 class="quiz-question" id="examQuestion">${esc(question.q)}</h2>

          <div class="quiz-options">
            ${question.o.map((option, index) => `
              <button class="quiz-option ${selected === index ? 'is-selected' : ''}" type="button" data-action="exam-answer" data-index="${index}" aria-pressed="${selected === index}">
                <span class="quiz-option__letter">${LETTERS[index]}</span>
                <span class="quiz-option__text">${esc(option)}</span>
              </button>
            `).join('')}
          </div>

          <div class="exam-nav">
            <button class="btn btn--ghost" type="button" data-action="exam-prev" ${session.current === 0 ? 'disabled' : ''}>${icon('arrowLeft')} Câu trước</button>
            <button class="btn btn--soft" type="button" data-action="exam-next" ${session.current === session.questions.length - 1 ? 'disabled' : ''}>Câu tiếp ${icon('arrowRight')}</button>
          </div>
        </section>

        <aside class="card exam-side" aria-label="Bảng số câu và nộp bài">
          <h2>${icon('list')} Bảng số câu</h2>
          <div class="exam-grid">
            ${session.questions.map((item, index) => `
              <button class="exam-grid__btn ${index === session.current ? 'is-current' : ''} ${session.answers[index] !== null && session.answers[index] !== undefined ? 'is-answered' : ''}" type="button" data-action="exam-jump" data-index="${index}" aria-label="Đến câu ${index + 1}" title="Câu ${index + 1}">${index + 1}</button>
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
    const unanswered = session.answers.filter((answer) => answer === null || answer === undefined).length;
    const message = unanswered
      ? `Còn ${unanswered} câu chưa trả lời. Bạn vẫn muốn nộp bài?`
      : `Nộp bài thi thử? Bạn đã trả lời ${session.questions.length}/${session.questions.length} câu.`;
    if (!window.confirm(message)) return;
  }

  session.submitted = true;
  clearExamClock();
  const result = buildResult(session, auto);
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
    } else if (state.check?.questions?.length) {
      if (!window.confirm('Rời màn hình kiểm tra? Các câu hỏi đã tách sẽ bị hủy.')) return;
    }
  }

  clearExamClock();
  state.session = null;
  state.result = null;
  state.check = null;
  renderHome();
  scrollToTop();
}

function retryResult() {
  const result = state.result;
  if (!result || !result.deck) return;
  if (result.mode === 'exam') {
    startExam(result.deck);
  } else {
    startPractice(result.deck);
  }
}

function retryWrongQuestions() {
  const result = state.result;
  if (!result || !result.deck) return;
  const wrongIds = new Set(result.wrong.map((item) => item.question.sourceId));
  const pool = result.deck.questions.filter((question) => wrongIds.has(question.id));
  if (!pool.length) {
    toast('Không tìm thấy câu sai để làm lại.', 'warning');
    return;
  }
  startPractice(result.deck, pool);
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

  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return;
  }

  switch (action) {
    case 'remove-image':
      removeSelectedImage(Number(actionElement.dataset.index));
      break;

    case 'clear-images':
      cleanupSelectedImages();
      renderHome();
      break;

    case 'start-extract':
      startExtraction().catch((error) => {
        console.error(error);
        state.processing = false;
        toast(`Không thể hoàn tất quá trình tách ảnh: ${shortError(error)}`, 'error', 8000);
        renderHome();
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
      if (deck) startPractice(deck);
      else toast('Không tìm thấy bộ câu hỏi.', 'error');
      break;
    }

    case 'exam-deck': {
      const deck = getDeckById(actionElement.dataset.id);
      if (deck) startExam(deck);
      else toast('Không tìm thấy bộ câu hỏi.', 'error');
      break;
    }

    case 'export-deck':
      exportDeck(actionElement.dataset.id);
      break;

    case 'import-deck': {
      const input = document.getElementById('importInput');
      if (input) input.click();
      break;
    }

    case 'cancel-check':
      cancelCheck();
      break;

    case 'delete-check-q':
      deleteCheckQuestion(actionElement.dataset.qid);
      break;

    case 'save-check':
      savePendingCheck();
      break;

    case 'practice-answer': {
      const session = state.session;
      if (!session || session.mode !== 'practice') return;
      if (session.answers[session.current] !== null && session.answers[session.current] !== undefined) return;
      const index = Number(actionElement.dataset.index);
      if (!isValidAnswer(index)) return;
      session.answers[session.current] = index;
      renderPractice();
      break;
    }

    case 'practice-next': {
      const session = state.session;
      if (!session || session.mode !== 'practice') return;
      const chosen = session.answers[session.current];
      if (chosen === null || chosen === undefined) return;
      if (session.current >= session.questions.length - 1) {
        finishSession();
      } else {
        session.current += 1;
        renderPractice();
        scrollToTop();
      }
      break;
    }

    case 'quit-session':
      goHome();
      break;

    case 'exam-answer': {
      const session = state.session;
      if (!session || session.mode !== 'exam') return;
      const index = Number(actionElement.dataset.index);
      if (!isValidAnswer(index)) return;
      session.answers[session.current] = index;
      renderExam();
      break;
    }

    case 'exam-jump': {
      const session = state.session;
      if (!session || session.mode !== 'exam') return;
      const index = Number(actionElement.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index >= session.questions.length) return;
      session.current = index;
      renderExam();
      scrollToTop();
      break;
    }

    case 'exam-prev': {
      const session = state.session;
      if (!session || session.mode !== 'exam' || session.current <= 0) return;
      session.current -= 1;
      renderExam();
      scrollToTop();
      break;
    }

    case 'exam-next': {
      const session = state.session;
      if (!session || session.mode !== 'exam' || session.current >= session.questions.length - 1) return;
      session.current += 1;
      renderExam();
      scrollToTop();
      break;
    }

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
    if (target.id === 'imageInput' || target.id === 'importInput') target.value = '';
    return;
  }

  if (target.id === 'imageInput') {
    const files = target.files;
    handleImageSelection(files);
    target.value = '';
    return;
  }

  if (target.id === 'importInput') {
    const file = target.files && target.files[0];
    target.value = '';
    if (file) importDeckFile(file);
    return;
  }

  if (target.name === 'draftType') {
    state.draftType = Number(target.value) || 1;
    return;
  }

  if (target.classList.contains('correct-radio') && state.check) {
    const card = target.closest('.check-card');
    if (!card) return;
    const question = state.check.questions.find((item) => item.id === card.dataset.qid);
    if (!question) return;
    question.a = Number(target.value);
    updateCheckStatus();
  }
}

function onAppInput(event) {
  const target = event.target;

  if (target.name === 'apiKey') {
    updateSettingsStatus();
    return;
  }

  if (!state.check) return;

  if (target.id === 'checkName') {
    state.check.name = target.value;
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
  }
  updateCheckStatus();
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
  const zone = event.target.closest('#uploadZone');
  if (!zone || state.processing) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  zone.classList.add('is-dragover');
}

function onDragLeave(event) {
  const zone = event.target.closest('#uploadZone');
  if (!zone) return;
  if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
  zone.classList.remove('is-dragover');
}

function onDrop(event) {
  const zone = event.target.closest('#uploadZone');
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove('is-dragover');
  if (state.processing) {
    toast('Đang xử lý ảnh, vui lòng chờ hoàn tất.', 'warning');
    return;
  }
  if (event.dataTransfer && event.dataTransfer.files.length) {
    handleImageSelection(event.dataTransfer.files);
  }
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
    if (event.key !== 'Escape' || !isAISettingsOpen()) return;
    event.preventDefault();
    closeAISettings();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkExamDeadline();
  });

  window.addEventListener('beforeunload', (event) => {
    const hasActiveExam = state.session && state.session.mode === 'exam';
    if (state.processing || hasActiveExam) {
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
  renderHome();
}

init();
