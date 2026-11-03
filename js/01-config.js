'use strict';

/* =========================================================
   1. Hằng số, cấu hình mặc định và trạng thái ứng dụng
   ========================================================= */
const STORAGE_KEYS = Object.freeze({
  decks: 'dc_decks',
  history: 'dc_history',
  config: 'dc_cfg',
  draftCheck: 'dc_draft_check',
  draftExam: 'dc_draft_exam',
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
const CHECK_FILTERS = ['all', 'ai', 'low', 'missing', 'new'];
const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const REQUEST_TIMEOUT_MS = 120000;
const RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_WAITS = [5, 10, 20, 30];
const CHECK_DRAFT_VERSION = 1;
const EXAM_DRAFT_VERSION = 1;
const CHECK_DRAFT_DEBOUNCE_MS = 400;

const TYPE_INFO = {
  1: { short: 'Có sẵn A–D' },
  2: { short: 'Hỏi – đáp' },
  3: { short: 'AI tạo đáp án' },
  4: { short: 'Đúng/Sai nhiều ý' },
  5: { short: 'Tự nhận dạng' }
};

const PROMPT_AUTO = `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Tự nhận dạng từng câu và ghi "type" là "tracnghiem" hoặc "dungsai":
   - "tracnghiem": câu trắc nghiệm A–D, cặp hỏi–đáp hoặc câu hỏi sẽ được chuyển thành 4 lựa chọn.
   - "dungsai": câu có đoạn dẫn và các ý a, b, c, d (mỗi ý chọn Đúng/Sai).
4. Với câu "tracnghiem": dùng "o" cho đúng 4 lựa chọn, "a" là chỉ số 0, 1, 2 hoặc 3 của đáp án đúng trong "o"; "e" là giải thích ngắn.
5. Với câu "dungsai": dùng "items" cho từ 2 đến 6 ý (thường 4 ý); mỗi ý có "t" là nội dung, "a" là true/false, "e" là giải thích ngắn. Chỉ để "a" của một ý là null khi nội dung ý bị mờ, cụt hoặc không đọc được.
6. Không thêm ký hiệu A., B., C., D. vào nội dung lựa chọn và không thêm a), b), c), d) vào nội dung ý.
7. Tìm dấu hiệu đáp án trong ảnh trước: gạch chân, tô đậm, khoanh tròn, đánh dấu tích, tô màu, chữ Đ/S hoặc bảng đáp án. Nếu có dấu hiệu, dùng đúng đáp án đó và đặt "ai_chon": false.
8. "ai_chon": true nếu đáp án đúng do bạn tự suy ra theo kiến thức; false nếu lấy từ dấu hiệu hoặc câu trả lời có sẵn trong ảnh. Với câu "dungsai", ghi "ai_chon" riêng cho từng ý.
9. "do_tin_cay": "cao", "vua" hoặc "thap" cho biết độ tin cậy. Với câu "dungsai", ghi riêng cho từng ý.
10. "e" bắt buộc: với câu trắc nghiệm là giải thích ngắn vì sao chọn đáp án; với câu Đúng/Sai phải có "e" riêng cho từng ý, giải thích ngắn vì sao ý đó Đúng hoặc Sai.
11. "topic" là chủ đề ngắn gọn của câu nếu xác định được, nếu không thì để chuỗi rỗng.
12. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

CÁCH XỬ LÝ THEO TỪNG DẠNG:
a) Câu đã có A–D: chép nguyên văn câu hỏi và các lựa chọn. Tìm dấu hiệu đáp án trong ảnh; nếu có, dùng đúng đáp án đó với "ai_chon": false. Nếu không có dấu hiệu nào, tự chọn đáp án đúng nhất theo kiến thức với "ai_chon": true.
b) Cặp hỏi–đáp (có câu trả lời nhưng chưa có lựa chọn): lấy câu trả lời trong ảnh làm đáp án đúng, giữ đúng ý (có thể rút gọn nếu quá dài). Tự soạn thêm 3 đáp án sai hợp lý cùng văn phong và độ dài, không trùng đáp án đúng. Đặt đáp án đúng ở vị trí ngẫu nhiên trong 4 lựa chọn, ghi đúng chỉ số vào "a" và đặt "ai_chon": false.
c) Chỉ có câu hỏi: tự soạn 4 đáp án ngắn gọn, rõ ràng; chọn đáp án đúng theo kiến thức, ghi chỉ số vào "a", viết "e" giải thích ngắn và đặt "ai_chon": true.
d) Đúng/Sai nhiều ý a, b, c, d: dùng đúng cấu trúc "dungsai" với "items"; xác định Đúng/Sai cho từng ý theo dấu hiệu trong ảnh hoặc theo kiến thức như quy tắc trên.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"type":"tracnghiem","q":"câu hỏi","topic":"chủ đề","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":0,"e":"giải thích ngắn","ai_chon":true,"do_tin_cay":"cao"},{"type":"dungsai","q":"đoạn dẫn hoặc dữ kiện của câu","topic":"chủ đề","items":[{"t":"nội dung ý","a":true,"e":"giải thích ngắn cho ý này","ai_chon":true,"do_tin_cay":"cao"}]}]}

NHIỆM VỤ RIÊNG:
Ảnh có thể chứa lẫn câu trắc nghiệm A–D, cặp hỏi–đáp, câu chỉ có câu hỏi và câu Đúng/Sai nhiều ý, hoặc chỉ một dạng. Hãy phân loại đúng từng câu, tách đủ nội dung và xác định đáp án theo đúng các quy tắc trên.`;

/* Dùng khi người dùng tắt ô "Nếu ảnh chưa có đáp án, để AI tự chọn". */
const PROMPT_AUTO_NO_AI = `Bạn là trợ lý số hóa đề cương học tập. Hãy đọc ảnh được gửi và trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời chào hay bất kỳ chữ nào bên ngoài JSON.

QUY TẮC CHUNG BẮT BUỘC:
1. Giữ đúng tiếng Việt có dấu, không tự ý dịch hoặc sửa nội dung.
2. Không bỏ sót bất kỳ câu hỏi nào xuất hiện trong ảnh. Nếu ảnh có nhiều câu, trả về đủ tất cả.
3. Tự nhận dạng từng câu và ghi "type" là "tracnghiem" hoặc "dungsai":
   - "tracnghiem": câu trắc nghiệm A–D, cặp hỏi–đáp hoặc câu hỏi sẽ được chuyển thành 4 lựa chọn.
   - "dungsai": câu có đoạn dẫn và các ý a, b, c, d (mỗi ý chọn Đúng/Sai).
4. Với câu "tracnghiem": dùng "o" cho đúng 4 lựa chọn; "a" là chỉ số 0, 1, 2 hoặc 3 của đáp án đúng, hoặc null khi ảnh không có dấu hiệu đáp án.
5. Với câu "dungsai": dùng "items" cho từ 2 đến 6 ý (thường 4 ý); mỗi ý có "t" là nội dung, "a" là true/false hoặc null khi ảnh không có dấu hiệu cho ý đó, "e" là giải thích ngắn.
6. Không thêm ký hiệu A., B., C., D. vào nội dung lựa chọn và không thêm a), b), c), d) vào nội dung ý.
7. Chỉ dùng đáp án có sẵn trong ảnh: dấu hiệu gạch chân, tô đậm, khoanh tròn, đánh dấu tích, tô màu, chữ Đ/S, bảng đáp án hoặc câu trả lời của cặp hỏi–đáp. Không tự suy đoán đáp án.
8. "ai_chon": luôn false trong chế độ này vì bạn không được tự chọn đáp án.
9. "do_tin_cay": "cao", "vua" hoặc "thap" theo độ rõ của dấu hiệu đáp án trong ảnh. Với câu "dungsai", ghi riêng cho từng ý.
10. Nếu câu trắc nghiệm A–D hoặc câu chỉ có câu hỏi không có dấu hiệu đáp án, đặt "a": null. Với cặp hỏi–đáp, lấy câu trả lời trong ảnh làm đáp án như mục b. Nếu một ý Đúng/Sai không có dấu hiệu, đặt "a": null cho ý đó. Không tự chọn đáp án khi ảnh không có dấu hiệu.
11. "e" bắt buộc: với câu trắc nghiệm là giải thích ngắn; nếu không thấy dấu hiệu đáp án, ghi rõ là không tìm thấy dấu hiệu trong ảnh. Với câu Đúng/Sai phải có "e" riêng cho từng ý.
12. "topic" là chủ đề ngắn gọn của câu nếu xác định được, nếu không thì để chuỗi rỗng.
13. Không thêm câu hỏi không có trong ảnh, không thêm chữ ngoài JSON.

CÁCH XỬ LÝ THEO TỪNG DẠNG:
a) Câu đã có A–D: chép nguyên văn câu hỏi và các lựa chọn. Nếu có dấu hiệu đáp án trong ảnh, dùng đúng đáp án đó; nếu không có dấu hiệu, đặt "a": null.
b) Cặp hỏi–đáp (có câu trả lời nhưng chưa có lựa chọn): lấy câu trả lời trong ảnh làm đáp án đúng, giữ đúng ý (có thể rút gọn nếu quá dài). Tự soạn thêm 3 đáp án sai hợp lý cùng văn phong và độ dài, không trùng đáp án đúng. Đặt đáp án đúng ở vị trí ngẫu nhiên trong 4 lựa chọn và ghi đúng chỉ số vào "a".
c) Chỉ có câu hỏi: ảnh không có đáp án nên đặt "a": null; vẫn soạn 4 lựa chọn hợp lý để người dùng tự chọn ở màn hình kiểm tra, nhưng không tự chọn đáp án đúng.
d) Đúng/Sai nhiều ý a, b, c, d: dùng đúng cấu trúc "dungsai" với "items"; chỉ điền true/false khi ảnh có dấu hiệu đáp án, nếu không đặt null cho từng ý.

ĐỊNH DẠNG BẮT BUỘC:
{"questions":[{"type":"tracnghiem","q":"câu hỏi","topic":"chủ đề","o":["đáp án 1","đáp án 2","đáp án 3","đáp án 4"],"a":null,"e":"giải thích ngắn","ai_chon":false,"do_tin_cay":"thap"},{"type":"dungsai","q":"đoạn dẫn hoặc dữ kiện của câu","topic":"chủ đề","items":[{"t":"nội dung ý","a":null,"e":"giải thích ngắn cho ý này","ai_chon":false,"do_tin_cay":"thap"}]}]}

NHIỆM VỤ RIÊNG:
Ảnh có thể chứa lẫn câu trắc nghiệm A–D, cặp hỏi–đáp, câu chỉ có câu hỏi và câu Đúng/Sai nhiều ý, hoặc chỉ một dạng. Hãy phân loại đúng từng câu, tách đủ nội dung và chỉ điền đáp án khi tìm thấy dấu hiệu hoặc câu trả lời có sẵn trong ảnh.`;

const state = {
  view: 'home',
  cfg: null,
  selectedImages: [], // [{ file, url }]
  allowAIAnswer: true,
  processing: false,
  extractionAbort: null,
  progress: { text: '', detail: '', percent: 0 },
  check: null,
  checkDraft: null,
  setup: null,
  session: null,
  examDraft: null,
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
let practiceClock = null;
let checkDraftTimer = null;
let draftQuotaWarned = false;
let examDraftSaveFailed = false;

