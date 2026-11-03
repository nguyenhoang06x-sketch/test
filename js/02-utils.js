'use strict';
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
  pause: '<path d="M9 5v14M15 5v14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5"/><path d="M5 20h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m13.5 5.5 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  import: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M5 14v5h14v-5"/>',
  arrowLeft: '<path d="M19 12H5m0 0 6-6m-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
  arrowDown: '<path d="M12 5v14m0 0 6-6m-6 6-6-6"/>',
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

const CONFIDENCE_LABELS = Object.freeze({
  cao: 'cao',
  vua: 'vừa',
  thap: 'thấp'
});

function normalizeConfidence(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (['cao', 'high', 'chac chan', 'chắc chắn'].includes(normalized)) return 'cao';
  if (['vua', 'vừa', 'medium', 'trung binh', 'trung bình', 'binh thuong', 'bình thường'].includes(normalized)) return 'vua';
  if (['thap', 'thấp', 'low'].includes(normalized)) return 'thap';
  return '';
}

function normalizeAiChosen(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'co', 'có', 'dung', 'đúng'].includes(normalized)) return true;
    if (['false', 'no', 'khong', 'không', 'sai'].includes(normalized)) return false;
  }
  return fallback;
}

// Chỉ dùng làm giá trị dự phòng khi đọc bộ cũ thiếu trường ai_chon.
// Dữ liệu mới luôn lấy ai_chon riêng cho từng câu/ý do AI trả về.
function defaultAiChosenForType(type) {
  return (Number(type) || 1) === 3;
}

function defaultConfidenceForType(type, aiChosen = defaultAiChosenForType(type)) {
  const typeNumber = Number(type) || 1;
  if (typeNumber === 1) return aiChosen ? 'vua' : '';
  return aiChosen ? 'vua' : 'cao';
}

function resolveConfidence(value, type, aiChosen) {
  const normalized = normalizeConfidence(value);
  if (normalized) return normalized;
  return defaultConfidenceForType(type, aiChosen);
}

/* =========================================================
   Dạng câu Đúng/Sai nhiều ý
   ========================================================= */
function itemLetter(index) {
  return String.fromCharCode(97 + Number(index || 0));
}

function truthLabel(value) {
  if (value === true) return 'Đúng';
  if (value === false) return 'Sai';
  return 'Chưa có đáp án';
}

// Chấp nhận true/false hoặc các cách AI/người dùng hay ghi: "Đúng", "Sai", "Đ", "S", 1, 0…
function normalizeTruthAnswer(value) {
  if (value === true || value === false) return value;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 't', 'd', 'đ', 'dung', 'đúng', 'yes', 'co', 'có'].includes(normalized)) return true;
    if (['false', '0', 'f', 's', 'sai', 'no', 'khong', 'không'].includes(normalized)) return false;
  }
  return null;
}

function normalizeQuestionType(value, source = null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['dungsai', 'ds', 'truefalse', 'true_false', 'dung-sai', 'đúng/sai'].includes(normalized)) return 'dungsai';
  if (['tracnghiem', 'trac-nghiem', 'mcq', 'multiple_choice', 'multiple-choice'].includes(normalized)) return 'tracnghiem';
  if (source && Array.isArray(source.items)) return 'dungsai';
  return 'tracnghiem';
}

function isDungSaiQuestion(question) {
  return Boolean(question) && normalizeQuestionType(question.type, question) === 'dungsai';
}

function normalizeItemConfidence(value, aiChosen = false) {
  return normalizeConfidence(value) || (aiChosen ? 'vua' : '');
}

function getQuestionItems(question) {
  return question && Array.isArray(question.items) ? question.items : [];
}

function getQuestionTopic(question) {
  return question && typeof question.topic === 'string' ? question.topic.trim() : '';
}

function questionHasAiChosen(question) {
  if (!question) return false;
  if (isDungSaiQuestion(question)) return getQuestionItems(question).some((item) => item && item.ai_chon);
  return Boolean(question.ai_chon);
}

function questionHasLowConfidence(question) {
  if (!question) return false;
  if (isDungSaiQuestion(question)) {
    return getQuestionItems(question).some((item) => item && item.do_tin_cay === 'thap');
  }
  return question.do_tin_cay === 'thap';
}

function isQuestionMissingAnswer(question) {
  if (!question) return true;
  if (isDungSaiQuestion(question)) {
    const items = getQuestionItems(question);
    return !items.length || items.some((item) => typeof item.a !== 'boolean');
  }
  return !isValidAnswer(question.a);
}

function countMissingAnswerItems(question) {
  if (!question) return 0;
  if (isDungSaiQuestion(question)) {
    return getQuestionItems(question).filter((item) => typeof item.a !== 'boolean').length;
  }
  return isValidAnswer(question.a) ? 0 : 1;
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

