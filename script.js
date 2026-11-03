'use strict';

/* =========================================================
   1. Hằng số, cấu hình mặc định và trạng thái ứng dụng
   ========================================================= */
const STORAGE_KEYS = Object.freeze({
  decks: 'dc_decks',
  history: 'dc_history',
  config: 'dc_cfg',
  theme: 'theme' // Khóa giao diện theo yêu cầu, không dùng tiền tố dc_
});

const EXPORT_APP = 'on-de-cuong-tu-anh';
const EXPORT_VERSION = 1;

const DEFAULT_CONFIG = Object.freeze({
  baseUrl: 'https://motapis.com/v1',
  apiKey: '',
  models: 'claude-sonnet-5-5, claude-sonnet-5, gpt-6-luna, claude-sonnet-4-6'
});

const LETTERS = ['A', 'B', 'C', 'D'];
const CHECK_FILTERS = ['all', 'ai', 'low', 'missing'];
const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const REQUEST_TIMEOUT_MS = 120000;
const RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_WAITS = [5, 10, 20, 30];

const TYPE_INFO = {
  1: {
    short: 'Có sẵn A–D',
    title: 'Đề đã có lựa chọn A, B, C, D',
    desc: 'AI chép nguyên văn câu hỏi, các lựa chọn và dùng dấu hiệu trong ảnh; nếu ảnh chưa có đáp án, AI tự chọn đáp án đúng nhất.'
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
  },
  4: {
    short: 'Đúng/Sai nhiều ý',
    title: 'Đề dạng Đúng/Sai (mỗi câu có các ý a, b, c, d)',
    desc: 'Mỗi câu gồm một đoạn dẫn và các ý a, b, c, d. AI xác định Đúng/Sai cho từng ý, kèm giải thích và độ tin cậy.'
  },
  5: {
    short: 'Hỗn hợp',
    title: 'Tự nhận dạng từng câu (hỗn hợp trắc nghiệm và Đúng/Sai)',
    desc: 'AI đọc ảnh và tự nhận dạng từng câu: câu trắc nghiệm A–D hoặc câu Đúng/Sai nhiều ý. Một bộ có thể chứa cả hai loại.'
  }
};

const PROMPTS = {
  1: `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Mỗi câu phải có đúng 4 lựa chọn trong mảng "o", không thêm ký hiệu A., B., C., D. ở đầu nội dung lựa chọn.
4. "a" là chỉ số 0, 1, 2 hoặc 3 của đáp án đúng trong mảng "o". Chỉ dùng null khi câu hỏi hoặc các lựa chọn bị mờ, cụt, không đọc được; không được để null chỉ vì ảnh không có dấu hiệu đáp án.
5. "e" bắt buộc phải có: giải thích ngắn gọn 1–2 câu bằng tiếng Việt nêu lý do chọn đáp án đó.
6. "ai_chon": true nếu đáp án do bạn tự chọn theo kiến thức vì ảnh không có dấu hiệu đáp án; false nếu đáp án lấy từ dấu hiệu có trong ảnh.
7. "do_tin_cay": "cao", "vua" hoặc "thap" để cho biết độ tin cậy của đáp án bạn chọn.
8. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"q":"câu hỏi","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":0,"e":"giải thích ngắn 1–2 câu","ai_chon":true,"do_tin_cay":"cao"}]}

NHIỆM VỤ RIÊNG:
Ảnh là đề cương trắc nghiệm đã có sẵn các lựa chọn A, B, C, D. Hãy chép nguyên văn câu hỏi và nội dung các lựa chọn, bỏ ký hiệu A., B., C., D. ở đầu mỗi lựa chọn.
Bước 1 — Tìm dấu hiệu đáp án trong ảnh: gạch chân, tô đậm, khoanh tròn, đánh dấu tích, tô màu hoặc bảng đáp án. Nếu có dấu hiệu, dùng đúng đáp án đó, đặt "ai_chon": false và "do_tin_cay": "cao" (hoặc "vua" nếu dấu hiệu không thật rõ).
Bước 2 — Nếu KHÔNG có bất kỳ dấu hiệu đáp án nào, hãy tự chọn đáp án đúng nhất theo kiến thức của bạn, đặt "ai_chon": true và "do_tin_cay" phù hợp. Tuyệt đối không để "a": null chỉ vì ảnh không có dấu hiệu; chỉ để null khi câu hỏi bị mờ, cụt hoặc không đọc được.
Luôn viết "e" 1–2 câu nêu lý do chọn đáp án để người dùng kiểm tra lại.`,
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

/* Dùng khi người dùng tắt ô "Nếu ảnh chưa có đáp án, để AI tự chọn". */
/* Dạng 4: đề Đúng/Sai nhiều ý. */
PROMPTS[4] = `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Mỗi câu Đúng/Sai gồm "q" là đoạn dẫn/dữ kiện của câu (có thể để chuỗi rỗng nếu ảnh không có đoạn dẫn) và "items" là mảng từ 2 đến 6 ý, thường là 4 ý a, b, c, d.
4. Chép nguyên văn nội dung từng ý vào "t" và bỏ ký hiệu a), b), c), d) hoặc a., b., c., d. ở đầu ý. Không thêm ký hiệu vào nội dung.
5. "a" của mỗi ý là true nếu ý Đúng, false nếu ý Sai. Chỉ dùng null khi nội dung ý bị mờ, cụt hoặc không đọc được; không được để null chỉ vì ảnh không ghi đáp án.
6. Bước 1 — tìm dấu hiệu đáp án trong ảnh: đáp án đã ghi sẵn, chữ Đ/S, dấu tích, gạch chân, tô đậm, khoanh tròn, tô màu hoặc bảng đáp án. Nếu có dấu hiệu, dùng đúng đáp án đó và đặt "ai_chon": false. Nếu dấu hiệu không rõ, đặt "do_tin_cay": "vua".
7. Bước 2 — nếu ảnh KHÔNG có dấu hiệu đáp án, hãy tự xác định Đúng/Sai cho từng ý theo kiến thức của bạn, đặt "ai_chon": true và "do_tin_cay" phù hợp. Tuyệt đối không để null chỉ vì ảnh thiếu đáp án.
8. "e" bắt buộc với TỪNG ý: giải thích ngắn gọn 1 câu bằng tiếng Việt vì sao ý đó Đúng hoặc Sai.
9. "do_tin_cay" của từng ý là "cao", "vua" hoặc "thap".
10. "topic" là chủ đề ngắn gọn của câu nếu xác định được, nếu không thì để chuỗi rỗng.
11. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"type":"dungsai","q":"đoạn dẫn hoặc dữ kiện của câu","topic":"chủ đề","items":[{"t":"nội dung ý","a":true,"e":"giải thích ngắn cho ý này","ai_chon":true,"do_tin_cay":"cao"}]}]}

NHIỆM VỤ RIÊNG:
Ảnh là đề cương dạng Đúng/Sai nhiều ý. Mỗi câu có một đoạn dẫn và các ý a, b, c, d (mỗi ý phải chọn Đúng hoặc Sai). Hãy tách đủ tất cả các câu, giữ nguyên văn nội dung đoạn dẫn và từng ý, xác định đáp án Đúng/Sai cho từng ý theo đúng thứ tự quy tắc ở trên.`;

/* Dạng 5: tự nhận dạng từng câu, cho phép trộn trắc nghiệm và Đúng/Sai. */
PROMPTS[5] = `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Tự nhận dạng từng câu và ghi "type" là "tracnghiem" hoặc "dungsai":
   - "tracnghiem": câu có 4 lựa chọn A, B, C, D. Dùng "o" cho 4 lựa chọn, "a" là chỉ số 0–3 của đáp án đúng.
   - "dungsai": câu có một đoạn dẫn và các ý a, b, c, d (mỗi ý chọn Đúng/Sai). Dùng "items" cho các ý, mỗi ý có "t", "a" là true/false.
4. Không thêm ký hiệu A., B., C., D. vào nội dung lựa chọn và không thêm a), b), c), d) vào nội dung ý.
5. Với câu trắc nghiệm: chỉ dùng "a": null khi câu hỏi hoặc lựa chọn bị mờ/cụt; nếu ảnh không có dấu hiệu đáp án thì tự chọn theo kiến thức, đặt "ai_chon": true.
6. Với câu Đúng/Sai: mỗi câu có từ 2 đến 6 ý (thường 4 ý). "a" của mỗi ý là true/false; chỉ null khi ý mờ/cụt. Nếu ảnh không có dấu hiệu đáp án thì tự xác định theo kiến thức, đặt "ai_chon": true.
7. Tìm dấu hiệu đáp án trong ảnh trước (đáp án ghi sẵn, Đ/S, tích, gạch chân, tô đậm, khoanh tròn, bảng đáp án). Nếu có dấu hiệu, dùng đúng đáp án đó và đặt "ai_chon": false.
8. "e" bắt buộc: với câu trắc nghiệm là giải thích ngắn vì sao chọn đáp án; với câu Đúng/Sai phải có "e" riêng cho TỪNG ý, giải thích ngắn vì sao ý đó Đúng hoặc Sai.
9. "do_tin_cay" là "cao", "vua" hoặc "thap"; với câu Đúng/Sai ghi cho từng ý, với câu trắc nghiệm ghi ở cấp câu.
10. "topic" là chủ đề ngắn gọn của câu nếu xác định được, nếu không thì để chuỗi rỗng.
11. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"type":"tracnghiem","q":"câu hỏi","topic":"chủ đề","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":0,"e":"giải thích ngắn","ai_chon":true,"do_tin_cay":"cao"},{"type":"dungsai","q":"đoạn dẫn hoặc dữ kiện của câu","topic":"chủ đề","items":[{"t":"nội dung ý","a":true,"e":"giải thích ngắn cho ý này","ai_chon":true,"do_tin_cay":"cao"}]}]}

NHIỆM VỤ RIÊNG:
Ảnh có thể chứa cả câu trắc nghiệm A–D và câu Đúng/Sai nhiều ý, hoặc chỉ một loại. Hãy phân loại đúng từng câu, tách đủ nội dung, xác định đáp án theo dấu hiệu trong ảnh hoặc theo kiến thức như quy tắc ở trên.`;

const PROMPTS_1_NO_AI = `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Mỗi câu phải có đúng 4 lựa chọn trong mảng "o", không thêm ký hiệu A., B., C., D. ở đầu nội dung lựa chọn.
4. "a" là chỉ số 0, 1, 2 hoặc 3 của đáp án đúng trong mảng "o"; dùng null nếu không thể xác định chắc chắn.
5. "e" bắt buộc phải có: giải thích ngắn gọn 1–2 câu bằng tiếng Việt nêu lý do; nếu không thấy dấu hiệu đáp án, ghi rõ là không tìm thấy dấu hiệu trong ảnh.
6. "ai_chon": luôn false trong chế độ này vì bạn không được tự chọn đáp án.
7. "do_tin_cay": "cao", "vua" hoặc "thap" theo độ rõ của dấu hiệu đáp án trong ảnh.
8. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"q":"câu hỏi","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":0,"e":"giải thích ngắn 1–2 câu","ai_chon":false,"do_tin_cay":"cao"}]}

NHIỆM VỤ RIÊNG:
Ảnh là đề cương trắc nghiệm đã có sẵn các lựa chọn A, B, C, D. Hãy chép nguyên văn câu hỏi và nội dung các lựa chọn, bỏ ký hiệu A., B., C., D. ở đầu mỗi lựa chọn. Xác định đáp án đúng dựa vào dấu hiệu trong ảnh như gạch chân, tô đậm, khoanh tròn, đánh dấu tích, tô màu hoặc bảng đáp án. Nếu không thấy dấu hiệu rõ ràng, đặt "a": null, "ai_chon": false và "do_tin_cay": "thap". Không tự suy đoán đáp án khi ảnh không có dấu hiệu.`;

const state = {
  view: 'home',
  cfg: null,
  selectedImages: [], // [{ file, url }]
  draftType: 1,
  allowAIAnswer: true,
  processing: false,
  extractionAbort: null,
  progress: { text: '', detail: '', percent: 0 },
  check: null,
  setup: null,
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

// Kiểu 1: AI chỉ chọn đáp án khi ảnh không có dấu hiệu (do AI trả về).
// Kiểu 2: đáp án đúng lấy từ câu trả lời trong ảnh nên không phải do AI chọn.
// Kiểu 3: AI tự soạn và chọn đáp án nên luôn do AI chọn.
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
      <p>Tải ảnh đề cương, để AI tách câu hỏi và đáp án, rồi luyện tập hoặc thi thử ngay trên trình duyệt. Mọi dữ liệu được lưu trên máy của bạn.</p>
      <div class="hero__stats">
        <span class="hero__stat">${icon('layers')} 5 kiểu đề cương</span>
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
          <span>hoặc kéo thả ảnh vào đây · dán bằng Ctrl+V</span>
          <small>Hỗ trợ JPG, PNG, WEBP… · nên chụp rõ nét, đủ sáng</small>
        </label>

        ${renderPreviewArea()}

        <div class="type-section">
          <h3>Chọn loại đề cương</h3>
          <p>Mỗi loại dùng một cách đọc và tạo đáp án riêng.</p>
          <div class="type-options">
            ${[1, 2, 3, 4, 5].map((type) => `
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

        <label class="type-option type-option--check auto-answer-option">
          <input id="autoAnswerToggle" type="checkbox" ${state.allowAIAnswer ? 'checked' : ''} ${state.processing ? 'disabled' : ''}>
          <span class="type-option__body">
            <span class="type-option__title">Nếu ảnh chưa có đáp án, để AI tự chọn</span>
            <span class="type-option__desc">Khi ảnh không có dấu hiệu đáp án, AI sẽ tự chọn đáp án đúng nhất theo kiến thức. Tắt để giữ trống và tự chọn ở màn hình kiểm tra.</span>
          </span>
        </label>

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
  if (state.view !== 'home' || state.setup || isAISettingsOpen()) return;
  const target = event.target;
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

  const files = getClipboardImageFiles(event.clipboardData);
  if (!files.length) return;
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

function getPrompt(type, allowAIAnswer = true) {
  const typeNumber = Number(type) || 1;
  if (typeNumber === 1) return allowAIAnswer ? PROMPTS[1] : PROMPTS_1_NO_AI;
  return PROMPTS[typeNumber] || PROMPTS[1];
}

async function extractQuestionsFromImage(dataUrl, type, config, onStatus, allowAIAnswer = true, signal = null) {
  const models = parseModelList(config.models);
  const prompt = getPrompt(type, allowAIAnswer);
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

function normalizeExtractedDsItems(rawItems) {
  const source = Array.isArray(rawItems) ? rawItems : [];
  const items = [];
  source.slice(0, 6).forEach((raw) => {
    if (!raw) return;
    const item = typeof raw === 'object' ? raw : { t: raw };
    const text = String(item.t ?? item.text ?? item.content ?? '').trim();
    if (!text) return;
    const answer = normalizeTruthAnswer(item.a ?? item.answer);
    const aiChosen = normalizeAiChosen(item.ai_chon ?? item.aiChosen, true);
    items.push({
      t: text,
      a: answer,
      e: String(item.e ?? item.explanation ?? '').trim(),
      ai_chon: aiChosen,
      do_tin_cay: normalizeItemConfidence(item.do_tin_cay, aiChosen)
    });
  });
  return items;
}

function normalizeExtractedQuestions(parsed, type, imageIndex, allowAIAnswer = true) {
  const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new Error('AI không trả về mảng "questions" đúng định dạng.');
  }

  const typeNumber = Number(type) || 1;
  const result = [];
  rawQuestions.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const questionText = String(item.q ?? item.question ?? '').trim();
    const kind = typeNumber === 4
      ? 'dungsai'
      : typeNumber === 5
        ? normalizeQuestionType(item.type, item)
        : 'tracnghiem';

    if (kind === 'dungsai') {
      const items = normalizeExtractedDsItems(item.items);
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
    const aiChosen = typeNumber === 1
      ? (allowAIAnswer ? normalizeAiChosen(item.ai_chon, Boolean(item.aiAnswers)) : false)
      : typeNumber === 5
        ? normalizeAiChosen(item.ai_chon, Boolean(item.aiAnswers))
        : defaultAiChosenForType(typeNumber);

    result.push({
      id: uid('q'),
      type: 'tracnghiem',
      q: questionText,
      o: options,
      a: answer,
      e: String(item.e ?? item.explanation ?? '').trim(),
      aiAnswers: aiChosen,
      ai_chon: aiChosen,
      do_tin_cay: resolveConfidence(item.do_tin_cay, typeNumber, aiChosen),
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

async function processImageEntries(entries, { type, allowAIAnswer, config, signal, label = 'Ảnh' }) {
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
      const parsed = await extractQuestionsFromImage(dataUrl, type, config, (detail) => {
        setProcessing(`${label} ${index + 1}/${entries.length}…`, detail, Math.min(96, basePercent + 6));
      }, allowAIAnswer, signal);
      const questions = normalizeExtractedQuestions(parsed, type, imageNo, allowAIAnswer);
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

  const entries = state.selectedImages.slice();
  const type = Number(state.draftType) || 1;
  const allowAIAnswer = type === 1 ? Boolean(state.allowAIAnswer) : true;
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
      type,
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
  const failedUrls = new Set(check.errors.map((error) => error.url).filter(Boolean));
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
      type: Number(check.type) || 1,
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
      .filter((error) => !retriedUrls.has(error.url))
      .concat(result.errors);
    check.questions.push(...result.allQuestions);
    check.filter = 'all';
    renderCheck({ scroll: false });

    if (result.aborted) {
      toast('Đã hủy thử lại ảnh lỗi.', 'warning', 5000);
    } else if (result.allQuestions.length) {
      toast(`Đã thêm ${result.allQuestions.length} câu hỏi từ ảnh thử lại.`, 'success', 5000);
    } else {
      toast('Vẫn chưa đọc được câu hỏi nào từ các ảnh lỗi.', 'error', 6000);
    }
  }
}

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
    const imageIndices = new Set();
    group.forEach((question) => {
      if (Number.isInteger(question.imageIndex) && question.imageIndex > 0) {
        imageIndices.add(question.imageIndex);
      }
    });
    if (imageIndices.size < 2) return;
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
    filter: 'all'
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
  const filter = CHECK_FILTERS.includes(check.filter) ? check.filter : 'all';
  check.filter = filter;
  const indexed = questions.map((question, index) => ({ question, index }));
  const visible = filter === 'ai'
    ? indexed.filter((item) => questionHasAiChosen(item.question))
    : filter === 'low'
      ? indexed.filter((item) => questionHasLowConfidence(item.question))
      : filter === 'missing'
        ? indexed.filter((item) => isQuestionMissingAnswer(item.question))
        : indexed;
  const filterEmptyText = filter === 'ai'
    ? 'Không có câu nào do AI tự chọn đáp án.'
    : filter === 'low'
      ? 'Không có câu nào có độ tin cậy thấp.'
      : filter === 'missing'
        ? 'Tất cả câu hỏi và các ý đã có đáp án.'
        : 'Không có câu hỏi nào để hiển thị.';
  const retryableErrors = check.errors.filter((error) => (
    error.url && state.selectedImages.some((item) => item.url === error.url)
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
          ` : ''}
        </section>
      ` : ''}

      ${isEdit ? `
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
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'all' ? 'is-active' : ''}" type="button" data-action="check-filter" data-filter="all">Tất cả (${questions.length})</button>
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'ai' ? 'is-active' : ''}" type="button" data-action="check-filter" data-filter="ai">Chỉ hiện câu AI chọn (${analysis.aiChosen})</button>
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'low' ? 'is-active' : ''}" type="button" data-action="check-filter" data-filter="low">Chỉ hiện câu độ tin cậy thấp (${analysis.lowConfidence})</button>
            <button class="btn btn--ghost btn--sm check-filter-btn ${filter === 'missing' ? 'is-active' : ''} ${analysis.unanswered ? 'check-filter-btn--alert' : ''}" type="button" data-action="check-filter" data-filter="missing">${icon('warning')} Chưa có đáp án (${analysis.unanswered}${analysis.unansweredItems > analysis.unanswered ? ` câu · ${analysis.unansweredItems} ý` : ''})</button>
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

function buildQuestionsForSave(questions) {
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
  }

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
}

/* =========================================================
   8. Lưu trữ bộ câu hỏi, nhập và xuất JSON
   ========================================================= */
function normalizeStrictDsItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length < 2 || rawItems.length > 6) return null;
  const items = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') return null;
    const text = String(raw.t ?? raw.text ?? raw.content ?? '').trim();
    if (!text) return null;
    const answer = normalizeTruthAnswer(raw.a ?? raw.answer);
    if (typeof answer !== 'boolean') return null;
    const aiChosen = normalizeAiChosen(raw.ai_chon ?? raw.aiChosen, false);
    items.push({
      t: text,
      a: answer,
      e: String(raw.e ?? raw.explanation ?? '').trim(),
      ai_chon: aiChosen,
      do_tin_cay: normalizeItemConfidence(raw.do_tin_cay, aiChosen)
    });
  }
  return items;
}

function inferDeckType(questions) {
  if (!Array.isArray(questions) || !questions.length) return 1;
  const dsCount = questions.filter(isDungSaiQuestion).length;
  if (!dsCount) return 1;
  return dsCount === questions.length ? 4 : 5;
}

// Bộ khai báo kiểu 4/5 hoặc có câu Đúng/Sai thì luôn phản ánh đúng nội dung thực tế.
function resolveDeckType(baseType, questions) {
  const declared = [1, 2, 3, 4, 5].includes(Number(baseType)) ? Number(baseType) : 1;
  const hasDs = Array.isArray(questions) && questions.some(isDungSaiQuestion);
  if (declared >= 4 || hasDs) return inferDeckType(questions);
  return declared;
}

function getDecks() {
  const raw = readJSON(STORAGE_KEYS.decks, []);
  if (!Array.isArray(raw)) return [];

  const decks = [];
  raw.forEach((deck) => {
    if (!deck || typeof deck !== 'object' || !Array.isArray(deck.questions)) return;

    const declaredType = Number(deck.type);
    const hasDeclaredType = [1, 2, 3, 4, 5].includes(declaredType);
    const type = hasDeclaredType ? declaredType : 1;
    const questions = [];
    deck.questions.forEach((question) => {
      if (!question || typeof question !== 'object') return;
      const text = String(question.q || '').trim();

      if (isDungSaiQuestion(question)) {
        const items = normalizeStrictDsItems(question.items);
        if (!items) return;
        questions.push({
          id: typeof question.id === 'string' && question.id ? question.id : uid('q'),
          type: 'dungsai',
          q: text,
          topic: String(question.topic || '').trim(),
          items,
          imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
        });
        return;
      }

      const rawOptions = Array.isArray(question.o) ? question.o : [];
      const options = rawOptions.slice(0, 4).map((option) => String(option ?? '').trim());
      while (options.length < 4) options.push('');
      const answer = normalizeAnswerIndex(question.a);
      if (!text || !isValidAnswer(answer) || options.some((option) => !option)) return;
      // Deck cũ có thể chỉ lưu một trong hai trường ai_chon/aiAnswers. Ưu tiên giá trị đã lưu
      // để giữ nguyên hành vi; chỉ dùng mặc định theo kiểu khi dữ liệu cũ thiếu hoàn toàn.
      const storedAiChosen = question.ai_chon ?? question.aiAnswers;
      const aiChosen = type === 1
        ? normalizeAiChosen(storedAiChosen, false)
        : normalizeAiChosen(storedAiChosen, defaultAiChosenForType(type));

      questions.push({
        id: typeof question.id === 'string' && question.id ? question.id : uid('q'),
        type: 'tracnghiem',
        q: text,
        o: options,
        a: answer,
        e: String(question.e || '').trim(),
        aiAnswers: aiChosen,
        ai_chon: aiChosen,
        do_tin_cay: resolveConfidence(question.do_tin_cay, type, aiChosen),
        imageIndex: Number.isInteger(question.imageIndex) ? question.imageIndex : null
      });
    });

    if (!questions.length) return;
    decks.push({
      id: typeof deck.id === 'string' && deck.id ? deck.id : uid('deck'),
      name: String(deck.name || '').trim() || 'Bộ câu hỏi',
      createdAt: deck.createdAt || new Date().toISOString(),
      type: hasDeclaredType ? resolveDeckType(type, questions) : inferDeckType(questions),
      questions
    });
  });
  return decks;
}

function getDeckById(deckId) {
  return getDecks().find((deck) => deck.id === deckId) || null;
}

function getHistory() {
  const raw = readJSON(STORAGE_KEYS.history, []);
  if (!Array.isArray(raw)) return [];

  const entries = [];
  raw.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const deckId = typeof entry.deckId === 'string' ? entry.deckId : '';
    if (!deckId) return;
    const score = Number(entry.score);
    entries.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : '',
      deckId,
      mode: entry.mode === 'exam' ? 'exam' : 'practice',
      date: typeof entry.date === 'string' ? entry.date : '',
      score: Number.isFinite(score) ? score : 0,
      total: Number(entry.total) || 0,
      correctCount: Number(entry.correctCount) || 0,
      wrongIds: Array.isArray(entry.wrongIds)
        ? entry.wrongIds.filter((id) => typeof id === 'string' && id)
        : []
    });
  });
  return entries;
}

function getHistoryForDeck(deckId, history = null) {
  const entries = Array.isArray(history) ? history : getHistory();
  return entries.filter((entry) => entry.deckId === deckId);
}

function getHistoryTime(entry) {
  const time = Date.parse(entry.date);
  return Number.isFinite(time) ? time : 0;
}

function summarizeDeckHistory(entries) {
  if (!entries.length) return null;

  const summary = {
    attempts: entries.length,
    best: entries[0],
    last: entries[0],
    lastTime: getHistoryTime(entries[0])
  };
  entries.forEach((entry) => {
    if (entry.score > summary.best.score) summary.best = entry;
    const time = getHistoryTime(entry);
    if (time > summary.lastTime) {
      summary.last = entry;
      summary.lastTime = time;
    }
  });
  return summary;
}

function getWeakQuestionIdsFromHistory(entries) {
  const stats = new Map();
  entries.forEach((entry) => {
    const time = getHistoryTime(entry);
    new Set(entry.wrongIds).forEach((id) => {
      const stat = stats.get(id) || { id, count: 0, lastWrongAt: 0 };
      stat.count += 1;
      stat.lastWrongAt = Math.max(stat.lastWrongAt, time);
      stats.set(id, stat);
    });
  });

  return Array.from(stats.values())
    .sort((a, b) => b.count - a.count || b.lastWrongAt - a.lastWrongAt)
    .map((stat) => stat.id);
}

function formatScore(score) {
  const value = Number(score) || 0;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function saveSessionHistory(result) {
  if (!result || !result.deck || !result.deck.id) return;
  const wrongIds = Array.from(new Set(
    (result.wrong || [])
      .map((item) => item.question && item.question.sourceId)
      .filter((id) => typeof id === 'string' && id)
  ));
  const entry = {
    id: uid('hist'),
    deckId: result.deck.id,
    mode: result.mode === 'exam' ? 'exam' : 'practice',
    date: new Date().toISOString(),
    score: Number(result.score) || 0,
    total: Number(result.total) || 0,
    correctCount: Number(result.correctCount) || 0,
    wrongIds
  };
  const history = getHistory();
  writeJSON(STORAGE_KEYS.history, [entry, ...history]);
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
  const history = getHistory();
  if (history.length) {
    writeJSON(STORAGE_KEYS.history, history.filter((entry) => entry.deckId !== deckId));
  }
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

function buildDeckPayload(deck) {
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    name: deck.name,
    type: deck.type,
    createdAt: deck.createdAt,
    questions: deck.questions.map((question) => {
      if (isDungSaiQuestion(question)) {
        return {
          type: 'dungsai',
          q: question.q,
          topic: question.topic || '',
          items: getQuestionItems(question).map((item) => ({
            t: item.t,
            a: item.a,
            e: item.e || '',
            ai_chon: Boolean(item.ai_chon),
            do_tin_cay: item.do_tin_cay || ''
          })),
          imageIndex: question.imageIndex
        };
      }
      return {
        type: 'tracnghiem',
        q: question.q,
        o: question.o,
        a: question.a,
        e: question.e,
        aiAnswers: question.aiAnswers,
        ai_chon: question.ai_chon,
        do_tin_cay: question.do_tin_cay,
        imageIndex: question.imageIndex
      };
    })
  };
}

function downloadJSON(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function exportDeck(deckId) {
  const deck = getDeckById(deckId);
  if (!deck) {
    toast('Không tìm thấy bộ câu hỏi để xuất.', 'error');
    return;
  }

  try {
    downloadJSON(buildDeckPayload(deck), `${safeFileName(deck.name)}.json`);
    toast('Đã xuất file JSON của bộ câu hỏi.', 'success');
  } catch (error) {
    toast(`Không xuất được file: ${shortError(error)}`, 'error');
  }
}

function exportAllDecks() {
  const decks = getDecks();
  if (!decks.length) {
    toast('Chưa có bộ câu hỏi nào để xuất.', 'warning');
    return;
  }

  const payload = {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    decks: decks.map(buildDeckPayload)
  };

  try {
    downloadJSON(payload, `de-cuong-tat-ca-${todayStamp()}.json`);
    toast(`Đã xuất ${decks.length} bộ câu hỏi vào một file JSON.`, 'success', 5000);
  } catch (error) {
    toast(`Không xuất được file: ${shortError(error)}`, 'error');
  }
}

function normalizeImportedDeck(data, fileName, options = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('Nội dung file không phải JSON hợp lệ.');
  }
  const rawQuestions = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(rawQuestions) || !rawQuestions.length) {
    throw new Error('File không có danh sách câu hỏi.');
  }

  const declaredType = Number(data.type);
  const hasDeclaredType = [1, 2, 3, 4, 5].includes(declaredType);
  const type = hasDeclaredType ? declaredType : 1;
  const fallbackBase = String(fileName || 'Bộ câu hỏi').replace(/\.json$/i, '').trim() || 'Bộ câu hỏi';
  const hasIndex = Number.isInteger(options.index) && Number(options.total) > 1;
  const fallbackName = hasIndex ? `${fallbackBase} (${options.index + 1})` : fallbackBase;
  const name = !Array.isArray(data) && String(data.name || '').trim()
    ? String(data.name).trim()
    : fallbackName;

  const questions = rawQuestions.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Câu ${index + 1} không hợp lệ.`);
    }
    const text = String(item.q ?? item.question ?? '').trim();

    if (isDungSaiQuestion(item)) {
      const items = normalizeStrictDsItems(item.items);
      if (!items) {
        throw new Error(`Câu ${index + 1} (Đúng/Sai) cần 2–6 ý, mỗi ý có nội dung và đáp án Đúng/Sai hợp lệ.`);
      }
      return {
        id: uid('q'),
        type: 'dungsai',
        q: text,
        topic: String(item.topic || '').trim(),
        items,
        imageIndex: Number.isInteger(item.imageIndex) ? item.imageIndex : null
      };
    }

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
    const aiChosen = type === 1
      ? normalizeAiChosen(item.ai_chon, Boolean(item.aiAnswers))
      : defaultAiChosenForType(type);
    return {
      id: uid('q'),
      type: 'tracnghiem',
      q: text,
      o: options,
      a: answer,
      e: String(item.e ?? item.explanation ?? '').trim(),
      aiAnswers: aiChosen,
      ai_chon: aiChosen,
      do_tin_cay: resolveConfidence(item.do_tin_cay, type, aiChosen),
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
    type: hasDeclaredType ? resolveDeckType(type, questions) : inferDeckType(questions),
    questions
  };
}

function normalizeImportedDecks(data, fileName) {
  let candidates = [];
  if (Array.isArray(data)) {
    candidates = [data];
  } else if (data && Array.isArray(data.decks)) {
    candidates = data.decks;
  } else if (data && typeof data === 'object') {
    candidates = [data];
  }

  if (!candidates.length) {
    throw new Error('File không có bộ câu hỏi nào.');
  }

  const decks = [];
  const errors = [];
  candidates.forEach((item, index) => {
    try {
      decks.push(normalizeImportedDeck(item, fileName, { index, total: candidates.length }));
    } catch (error) {
      errors.push({ index, message: shortError(error) });
    }
  });

  if (!decks.length) {
    throw new Error(errors.length ? errors[0].message : 'File không có bộ câu hỏi hợp lệ.');
  }

  return { decks, errors };
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
    const normalized = normalizeImportedDecks(data, file.name);
    const existing = getDecks();
    const existingNameMap = new Map(existing.map((deck) => [deck.name.trim().toLowerCase(), deck.name]));
    const accepted = [];
    let skipped = 0;

    normalized.decks.forEach((deck) => {
      const key = deck.name.trim().toLowerCase();
      const existingName = existingNameMap.get(key);
      if (existingName) {
        const addCopy = window.confirm(
          `Đã có bộ "${existingName}". Bạn có muốn thêm một bản sao không?\n\n`
          + 'Chọn OK để thêm bản sao, chọn Cancel để bỏ qua bộ này.'
        );
        if (!addCopy) {
          skipped += 1;
          return;
        }
      }
      existingNameMap.set(key, deck.name);
      accepted.push(deck);
    });

    if (!accepted.length) {
      toast(
        skipped
          ? `Đã bỏ qua ${skipped} bộ trùng tên, không có bộ nào được nhập.`
          : 'Không có bộ câu hỏi nào được nhập.',
        'warning',
        6000
      );
      return;
    }

    if (!writeJSON(STORAGE_KEYS.decks, [...accepted, ...existing])) return;

    renderHome();
    scrollToTop();

    const notes = [];
    if (skipped) notes.push(`Bỏ qua ${skipped} bộ trùng tên`);
    if (normalized.errors.length) notes.push(`bỏ qua ${normalized.errors.length} bộ không hợp lệ`);
    const suffix = notes.length ? ` (${notes.join(', ')}).` : '';

    if (accepted.length === 1) {
      toast(`Đã nhập bộ "${accepted[0].name}" với ${accepted[0].questions.length} câu hỏi.${suffix}`, 'success', 6000);
    } else {
      const totalQuestions = accepted.reduce((sum, deck) => sum + deck.questions.length, 0);
      toast(`Đã nhập ${accepted.length} bộ câu hỏi (${totalQuestions} câu).${suffix}`, 'success', 6000);
    }
  } catch (error) {
    toast(`Không nhập được bộ câu hỏi: ${shortError(error)}`, 'error', 8000);
  }
}

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
  const questions = selectSessionQuestions(pool, options)
    .map((question) => prepareSessionQuestion(question, options.shuffleAnswers !== false));
  state.result = null;
  state.session = {
    mode: 'practice',
    deck,
    questions,
    answers: questions.map(createEmptySessionAnswer),
    revealed: questions.map(() => false),
    current: 0
  };
  renderPractice();
  scrollToTop();
}

function startExam(deck, options = {}) {
  if (!deck || !Array.isArray(deck.questions) || !deck.questions.length) {
    toast('Bộ câu hỏi không có dữ liệu để thi thử.', 'error');
    return;
  }

  clearExamClock();
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
  renderExam();
  scrollToTop();
}

function finishSession() {
  const session = state.session;
  if (!session) return;
  clearExamClock();
  const result = buildResult(session, false);
  saveSessionHistory(result);
  state.result = result;
  state.session = null;
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

  const isExam = result.mode === 'exam';
  const isDrill = result.mode === 'dsdrill';
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
  state.session = null;
  state.result = null;
  state.check = null;
  renderHome();
  scrollToTop();
}

function retryResult() {
  const result = state.result;
  if (!result || !result.deck) return;
  if (result.mode === 'dsdrill') {
    startDungSaiDrill(result.deck);
    return;
  }
  openSessionSetup(result.mode === 'exam' ? 'exam' : 'practice', result.deck);
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

    case 'cancel-check':
      cancelCheck();
      break;

    case 'check-filter': {
      if (!state.check) return;
      const filter = actionElement.dataset.filter;
      if (!CHECK_FILTERS.includes(filter)) return;
      state.check.filter = filter;
      renderCheck({ scroll: false });
      break;
    }

    case 'jump-missing':
      jumpToMissingAnswer();
      break;

    case 'delete-check-q':
      deleteCheckQuestion(actionElement.dataset.qid);
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
    if (!document.hidden) checkExamDeadline();
  });

  window.addEventListener('beforeunload', (event) => {
    const hasActiveExam = state.session && state.session.mode === 'exam';
    const hasUnsavedDeckEdit = state.check?.mode === 'edit' && isCheckDirty();
    if (state.processing || hasActiveExam || hasUnsavedDeckEdit) {
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
