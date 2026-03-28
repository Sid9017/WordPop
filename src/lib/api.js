import { supabase } from "./supabase";
import { getFamilyId } from "./family";

const POS_MAP = {
  n: "noun", v: "verb", adj: "adjective", adv: "adverb",
  prep: "preposition", conj: "conjunction", pron: "pronoun",
  int: "interjection", vt: "verb", vi: "verb", aux: "verb",
};

// ===== 查词 =====

let _lastAudioKey = "";
let _lastAudioTime = 0;
let _audioPref = 2; // 1=UK, 2=US

export function setAudioPref(pref) {
  _audioPref = pref === "uk" ? 1 : 2;
}

export function getAudioPref() {
  return _audioPref;
}

export function playAudio(word, type) {
  const t = type ?? _audioPref;
  const w = word.includes("/") ? word.split("/")[0] : word;
  const key = `${w}-${t}`;
  const now = Date.now();
  if (key === _lastAudioKey && now - _lastAudioTime < 500) return;
  _lastAudioKey = key;
  _lastAudioTime = now;
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(w)}&type=${t}`;
  const audio = new Audio(url);
  audio.play().catch(() => {});
}

export async function lookupWord(word) {
  const query = word.toLowerCase();
  const dictsParam = encodeURIComponent(JSON.stringify({
    count: 99,
    dicts: [["ec", "blng_sents_part"]],
  }));
  const ydRes = await fetch(
    `/youdao-api/jsonapi_s?doctype=json&jsonversion=4&le=en&q=${encodeURIComponent(query)}&dicts=${dictsParam}`
  );
  if (!ydRes.ok) throw new Error("查询失败");
  const ydData = await ydRes.json();

  const ecWord = ydData.ec?.word;
  const ec = Array.isArray(ecWord) ? ecWord[0] : ecWord;
  if (!ec) throw new Error("词典未找到该单词");

  const canonicalWord = ec["return-phrase"]?.l?.i || query;

  const ukPhonetic = ec.ukphone ? `/${ec.ukphone}/` : "";
  const usPhonetic = ec.usphone ? `/${ec.usphone}/` : "";

  const sentPairs = ydData.blng_sents_part?.["sentence-pair"] || [];
  const oxfordSents = sentPairs.filter((s) => s.source?.includes("牛津"));
  const allSents = oxfordSents.length > 0 ? oxfordSents : sentPairs;

  const meanings = (ec.trs || []).map((t, idx) => {
    const raw = t.tran || "";
    const items = raw.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
    const numbered = items.length > 1
      ? items.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : items[0] || raw;
    const sent = allSents[idx];
    return {
      pos: POS_MAP[t.pos?.replace(".", "")] || t.pos?.replace(".", "") || "",
      meaning_cn: numbered,
      meaning_en: "",
      example: sent?.sentence?.replace(/<[^>]*>/g, "") || "",
      example_cn: sent?.["sentence-translation"] || "",
    };
  });

  return { word: canonicalWord, ukPhonetic, usPhonetic, imageUrl: "", meanings };
}

// ===== 批量查词（前端实现）=====

let _bankCache = {};

async function loadBankData(bankId) {
  if (_bankCache[bankId]) return _bankCache[bankId];
  try {
    const res = await fetch(`/data/word-banks/${bankId}.json`);
    const data = await res.json();
    _bankCache[bankId] = data;
    return data;
  } catch {
    return null;
  }
}

const BANK_IDS = ["KET", "PET", "CET4", "CET6", "TOEFL", "IELTS", "SAT", "GRE", "GMAT", "BEC"];

let _wordIndex = null;

async function buildWordIndex() {
  if (_wordIndex) return _wordIndex;
  _wordIndex = {};
  for (const id of BANK_IDS) {
    const bank = await loadBankData(id);
    if (!bank?.words) continue;
    for (const w of bank.words) {
      const key = w.word.toLowerCase();
      if (!_wordIndex[key]) _wordIndex[key] = w;
    }
  }
  return _wordIndex;
}

export async function batchLookupWords(wordList, onProgress) {
  const index = await buildWordIndex();
  const results = [];
  const toQuery = [];

  for (const raw of wordList) {
    const w = raw.trim().toLowerCase();
    if (!w) continue;
    if (index[w]) {
      results.push(index[w]);
    } else {
      toQuery.push(w);
    }
  }

  if (onProgress) onProgress({ cached: results.length, remaining: toQuery.length });

  for (let i = 0; i < toQuery.length; i++) {
    try {
      const data = await lookupWord(toQuery[i]);
      results.push(data);
    } catch {
      // word not found, skip
    }
    if (onProgress) onProgress({ cached: results.length - toQuery.length + i + 1, remaining: toQuery.length - i - 1, current: toQuery[i] });
  }

  return results;
}

// ===== 家长：保存单词 =====

export async function saveWord({ word, ukPhonetic, usPhonetic, phonetic, imageUrl, meanings }) {
  const familyId = getFamilyId();
  const { data: wordRow, error: wErr } = await supabase
    .from("words")
    .upsert(
      {
        word,
        phonetic: usPhonetic || phonetic || "",
        uk_phonetic: ukPhonetic || "",
        image_url: imageUrl,
        family_id: familyId,
      },
      { onConflict: "word,family_id" }
    )
    .select()
    .single();
  if (wErr) throw wErr;

  await supabase.from("meanings").delete().eq("word_id", wordRow.id);

  const rows = meanings.map((m) => ({
    word_id: wordRow.id,
    pos: m.pos,
    meaning_en: m.meaning_en,
    meaning_cn: m.meaning_cn,
    example: m.example || "",
    example_cn: m.example_cn || "",
  }));
  const { error: mErr } = await supabase.from("meanings").insert(rows);
  if (mErr) throw mErr;

  await supabase
    .from("progress")
    .upsert(
      { word_id: wordRow.id, stage: "testing", next_review_at: new Date().toISOString(), family_id: familyId },
      { onConflict: "word_id" }
    );

  return wordRow;
}

export async function getAllWords() {
  const familyId = getFamilyId();
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("words")
      .select("*, meanings(*), progress(*)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** 家长列表用：无 meanings，体积小 */
export async function getAllWordsSummary() {
  const familyId = getFamilyId();
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("words")
      .select("id, word, phonetic, uk_phonetic, progress(correct_count, wrong_count, stage)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function getSelectedWordCount(selectedBanks) {
  const familyId = getFamilyId();
  const promises = [];
  if (selectedBanks.includes("custom")) {
    promises.push(
      supabase.from("words").select("*", { count: "exact", head: true })
        .eq("family_id", familyId).then(({ count }) => count || 0)
    );
  }
  for (const bankId of selectedBanks.filter((b) => b !== "custom")) {
    promises.push(
      supabase.from("bank_words").select("*", { count: "exact", head: true })
        .eq("bank_id", bankId).then(({ count }) => count || 0)
    );
  }
  const counts = await Promise.all(promises);
  return counts.reduce((a, b) => a + b, 0);
}

export async function getAllSelectedWords(selectedBanks, { limit, summary } = {}) {
  const familyId = getFamilyId();
  const all = [];
  const seen = new Set();

  const bankIds = selectedBanks.filter((b) => b !== "custom");
  const bankSelect = summary ? "id, bank_id, word, us_phonetic, uk_phonetic" : "*";

  async function loadCustom() {
    if (!selectedBanks.includes("custom")) return [];
    return summary ? getAllWordsSummary() : getAllWords();
  }

  async function loadBankPages(bankId) {
    const results = [];
    let lastWord = null;
    const PAGE = 1000;
    while (true) {
      let q = supabase
        .from("bank_words")
        .select(bankSelect)
        .eq("bank_id", bankId)
        .order("word")
        .limit(PAGE);
      if (lastWord != null) q = q.gt("word", lastWord);
      const { data } = await q;
      if (!data?.length) break;
      results.push(...data);
      if (data.length < PAGE) break;
      lastWord = data[data.length - 1].word;
    }
    return results;
  }

  async function loadProgress() {
    const map = {};
    const selectCols = summary
      ? "id, bank_word_id, correct_count, wrong_count, stage"
      : "*";
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("progress")
        .select(selectCols)
        .eq("family_id", familyId)
        .not("bank_word_id", "is", null)
        .range(from, from + 999);
      if (!data?.length) break;
      for (const p of data) map[p.bank_word_id] = p;
      if (data.length < 1000) break;
      from += 1000;
    }
    return map;
  }

  if (limit) {
    const customWords = await loadCustom();
    for (const w of customWords) {
      seen.add(w.word.toLowerCase());
      all.push(
        summary
          ? { ...w, _source: "custom", meanings: [] }
          : { ...w, _source: "custom" }
      );
    }
    if (all.length >= limit) return all.slice(0, limit);

    const remaining = limit - all.length;
    for (const bankId of bankIds) {
      const { data } = await supabase
        .from("bank_words")
        .select(bankSelect)
        .eq("bank_id", bankId)
        .order("word")
        .limit(remaining + 100);
      if (data) {
        for (const bw of data) {
          const key = bw.word.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          if (summary) {
            all.push(bankWordToSummaryRow(bw, {}));
          } else {
            const norm = normalizeBankWord(bw);
            norm.progress = [];
            norm._source = bw.bank_id;
            all.push(norm);
          }
          if (all.length >= limit) break;
        }
      }
      if (all.length >= limit) break;
    }
    return all.slice(0, limit);
  }

  const [customWords, progressMap, ...bankResults] = await Promise.all([
    loadCustom(),
    bankIds.length ? loadProgress() : Promise.resolve({}),
    ...bankIds.map(loadBankPages),
  ]);

  for (const w of customWords) {
    seen.add(w.word.toLowerCase());
    all.push(
      summary
        ? { ...w, _source: "custom", meanings: [] }
        : { ...w, _source: "custom" }
    );
  }

  const bankWords = bankResults.flat();
  for (const bw of bankWords) {
    const key = bw.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (summary) {
      all.push(bankWordToSummaryRow(bw, progressMap));
    } else {
      const norm = normalizeBankWord(bw);
      norm.progress = progressMap[bw.id] ? [progressMap[bw.id]] : [];
      norm._source = bw.bank_id;
      all.push(norm);
    }
  }

  return all;
}

export async function deleteWord(id) {
  await supabase.from("words").delete().eq("id", id);
}

/** 家长页展开词卡时拉取完整释义（自定义词 / 预置词库词） */
export async function fetchParentWordDetail(item) {
  const familyId = getFamilyId();
  if (item._isBankWord) {
    const { data: bw, error } = await supabase
      .from("bank_words")
      .select("*")
      .eq("id", item.id)
      .single();
    if (error || !bw) throw error || new Error("加载失败");
    const { data: prog } = await supabase
      .from("progress")
      .select("*")
      .eq("family_id", familyId)
      .eq("bank_word_id", item.id)
      .maybeSingle();
    const norm = normalizeBankWord(bw);
    norm.progress = prog ? [prog] : [];
    norm._source = bw.bank_id;
    return norm;
  }
  const { data, error } = await supabase
    .from("words")
    .select("*, meanings(*), progress(*)")
    .eq("id", item.id)
    .eq("family_id", familyId)
    .single();
  if (error || !data) throw error || new Error("加载失败");
  return { ...data, _source: "custom" };
}

// ===== 闯关选词 =====

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  function rand() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 艾宾浩斯遗忘曲线复习间隔（天）
// 第1次→1天后复习，第2次→2天，第3次→4天，第4次→1周，第5次→2周，第6次→1月
const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30];

// 将 bank_word 行规范化为与 words 表兼容的格式
function normalizeBankWord(bw) {
  return {
    id: bw.id,
    _isBankWord: true,
    word: bw.word,
    phonetic: bw.us_phonetic || "",
    uk_phonetic: bw.uk_phonetic || "",
    image_url: "",
    meanings: (bw.meanings || []).map((m, i) => ({
      id: `${bw.id}_m${i}`,
      pos: m.pos || "",
      meaning_cn: m.meaning_cn || "",
      meaning_en: m.meaning_en || "",
      example: m.example || "",
      example_cn: m.example_cn || "",
    })),
  };
}

function bankWordToSummaryRow(bw, progressMap) {
  return {
    id: bw.id,
    _isBankWord: true,
    word: bw.word,
    phonetic: bw.us_phonetic || "",
    uk_phonetic: bw.uk_phonetic || "",
    image_url: "",
    meanings: [],
    progress: progressMap[bw.id] ? [progressMap[bw.id]] : [],
    _source: bw.bank_id,
  };
}

export async function getQuizWords({ extra = false } = {}) {
  const familyId = getFamilyId();

  if (!extra) {
    const todayDone = await getTodayQuizDone();
    if (todayDone) return [];
  }

  const { data: familyRow } = await supabase
    .from("families")
    .select("daily_new_words, selected_banks")
    .eq("id", familyId)
    .maybeSingle();
  const dailyNewWords = familyRow?.daily_new_words ?? 5;
  const selectedBanks = familyRow?.selected_banks ?? ["custom"];

  // 合并词池
  const allWords = [];

  // 加载自定义词
  if (selectedBanks.includes("custom")) {
    let wFrom = 0;
    while (true) {
      const { data } = await supabase
        .from("words")
        .select("*, meanings(*)")
        .eq("family_id", familyId)
        .range(wFrom, wFrom + 999);
      if (!data?.length) break;
      allWords.push(...data);
      if (data.length < 1000) break;
      wFrom += 1000;
    }
  }

  // 加载选中的预置词库
  const bankIds = selectedBanks.filter((b) => b !== "custom");
  const BANK_PAGE = 1000;
  for (const bankId of bankIds) {
    let lastWord = null;
    while (true) {
      let q = supabase
        .from("bank_words")
        .select("*")
        .eq("bank_id", bankId)
        .order("word")
        .limit(BANK_PAGE);
      if (lastWord != null) q = q.gt("word", lastWord);
      const { data } = await q;
      if (!data?.length) break;
      allWords.push(...data.map(normalizeBankWord));
      if (data.length < BANK_PAGE) break;
      lastWord = data[data.length - 1].word;
    }
  }

  if (!allWords.length) return [];

  // 加载做题历史（word_id + bank_word_id 两列）
  const quizHistory = [];
  let qFrom = 0;
  while (true) {
    const { data } = await supabase
      .from("quiz_log")
      .select("word_id, bank_word_id, created_at, is_correct")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .range(qFrom, qFrom + 999);
    if (!data?.length) break;
    quizHistory.push(...data);
    if (data.length < 1000) break;
    qFrom += 1000;
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const getRefId = (q) => q.bank_word_id || q.word_id;

  const wordStats = {};
  for (const q of quizHistory) {
    const refId = getRefId(q);
    const date = q.created_at.slice(0, 10);
    if (!wordStats[refId]) {
      wordStats[refId] = { lastQuiz: new Date(q.created_at), dates: new Set(), wrong: 0, total: 0 };
    }
    wordStats[refId].dates.add(date);
    wordStats[refId].total++;
    if (!q.is_correct) wordStats[refId].wrong++;
  }

  const quizzedWordIds = new Set(quizHistory.map(getRefId));
  const todayQuizzedIds = new Set(
    quizHistory.filter((q) => q.created_at.slice(0, 10) === today).map(getRefId)
  );

  const sorted = [...allWords].sort((a, b) => a.id.localeCompare(b.id));
  const seed = hashSeed(today + familyId);
  const shuffled = seededShuffle(sorted, seed);

  const newWords = [];
  for (const w of shuffled) {
    if (newWords.length >= dailyNewWords) break;
    if (quizzedWordIds.has(w.id)) continue;
    if (extra && todayQuizzedIds.has(w.id)) continue;
    newWords.push({ ...w, _isNew: true });
  }

  const reviewPool = allWords.filter((w) => quizzedWordIds.has(w.id));
  if (reviewPool.length === 0) return newWords;

  const scored = reviewPool.map((w) => {
    const stats = wordStats[w.id];
    if (!stats) return { word: w, priority: 0 };
    const daysSince = (now - stats.lastQuiz) / (1000 * 60 * 60 * 24);
    const quizDays = stats.dates.size;
    const idealInterval = REVIEW_INTERVALS[Math.min(quizDays - 1, REVIEW_INTERVALS.length - 1)];
    const timePriority = daysSince / idealInterval;
    const errorRate = stats.wrong / Math.max(stats.total, 1);
    const errorWeight = 1 + errorRate * 2;
    return { word: w, priority: timePriority * errorWeight };
  });

  scored.sort((a, b) => b.priority - a.priority);
  const reviewWords = scored.slice(0, 25).map((s) => s.word);

  return [...newWords, ...reviewWords];
}

export async function updateMasteryStatus(words) {
  for (const w of words) {
    const isBankWord = w._isBankWord;
    const col = isBankWord ? "bank_word_id" : "word_id";
    const { data: prog } = await supabase
      .from("progress")
      .select("correct_count")
      .eq(col, w.id)
      .maybeSingle();
    if (prog && prog.correct_count >= 5) {
      await supabase.from("progress").update({ stage: "mastered" }).eq(col, w.id);
    }
  }
}

// ===== 测试记录 =====

export async function recordQuiz(word, meaningId, quizType, isCorrect) {
  const familyId = getFamilyId();
  const isBankWord = word._isBankWord;

  const logRow = {
    quiz_type: quizType,
    is_correct: isCorrect,
    family_id: familyId,
  };
  if (isBankWord) {
    logRow.bank_word_id = word.id;
    logRow.meaning_id = null;
  } else {
    logRow.word_id = word.id;
    logRow.meaning_id = meaningId;
  }
  await supabase.from("quiz_log").insert(logRow);

  // 更新 progress
  const col = isBankWord ? "bank_word_id" : "word_id";
  const { data: prog } = await supabase
    .from("progress")
    .select("*")
    .eq(col, word.id)
    .eq("family_id", familyId)
    .maybeSingle();

  if (prog) {
    await supabase
      .from("progress")
      .update({
        correct_count: prog.correct_count + (isCorrect ? 1 : 0),
        wrong_count: prog.wrong_count + (isCorrect ? 0 : 1),
        last_quiz_at: new Date().toISOString(),
      })
      .eq("id", prog.id);
  } else {
    const newProg = {
      stage: "testing",
      correct_count: isCorrect ? 1 : 0,
      wrong_count: isCorrect ? 0 : 1,
      last_quiz_at: new Date().toISOString(),
      next_review_at: new Date().toISOString(),
      family_id: familyId,
    };
    if (isBankWord) newProg.bank_word_id = word.id;
    else newProg.word_id = word.id;
    await supabase.from("progress").insert(newProg);
  }
}

// ===== 打卡 =====

export async function checkinToday() {
  const familyId = getFamilyId();
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("checkins")
    .upsert({ check_date: today, family_id: familyId }, { onConflict: "family_id,check_date" });
}

export async function getCheckins(days = 30) {
  const familyId = getFamilyId();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from("checkins")
    .select("check_date")
    .eq("family_id", familyId)
    .gte("check_date", since.toISOString().slice(0, 10))
    .order("check_date", { ascending: false });
  return (data || []).map((d) => d.check_date);
}

export async function getTodayQuizDone() {
  const familyId = getFamilyId();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("quiz_log")
    .select("id")
    .eq("family_id", familyId)
    .gte("created_at", todayStart.toISOString())
    .limit(1);
  return (data?.length || 0) > 0;
}
