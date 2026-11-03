'use strict';
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

// Bộ mới dùng type 5 (tự nhận dạng). Bộ cũ giữ type 1–4, riêng bộ có câu Đúng/Sai
// vẫn được suy ra theo nội dung thực tế để nhãn hiển thị không sai.
function resolveDeckType(baseType, questions) {
  const declared = [1, 2, 3, 4, 5].includes(Number(baseType)) ? Number(baseType) : 5;
  if (declared === 5) return 5;
  const hasDs = Array.isArray(questions) && questions.some(isDungSaiQuestion);
  if (declared === 4 || hasDs) return inferDeckType(questions);
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
      const aiChosen = normalizeAiChosen(storedAiChosen, defaultAiChosenForType(type));

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
    const durationSeconds = Number(entry.durationSeconds);
    entries.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : '',
      deckId,
      mode: entry.mode === 'exam' ? 'exam' : 'practice',
      date: typeof entry.date === 'string' ? entry.date : '',
      score: Number.isFinite(score) ? score : 0,
      total: Number(entry.total) || 0,
      correctCount: Number(entry.correctCount) || 0,
      // Entry cũ không có durationSeconds → mặc định 0, không làm hỏng lịch sử.
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.round(durationSeconds)
        : 0,
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
    lastTime: getHistoryTime(entries[0]),
    totalDurationSeconds: 0
  };
  entries.forEach((entry) => {
    if (entry.score > summary.best.score) summary.best = entry;
    summary.totalDurationSeconds += Number(entry.durationSeconds) || 0;
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
    durationSeconds: Math.max(0, Math.round(Number(result.durationSeconds) || 0)),
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
    const storedAiChosen = item.ai_chon ?? item.aiAnswers;
    const aiChosen = normalizeAiChosen(storedAiChosen, defaultAiChosenForType(type));
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

