import { supabase } from "./supabase";
import { getFamilyId } from "./family";

const PIXABAY_KEY = import.meta.env.VITE_PIXABAY_API_KEY || "";

const POS_MAP = {
  n: "noun", v: "verb", adj: "adjective", adv: "adverb",
  prep: "preposition", conj: "conjunction", pron: "pronoun",
  int: "interjection", vt: "verb", vi: "verb", aux: "verb",
};

// ===== 查词 =====

export function playAudio(word, type = 2) {
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
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

  let imageUrl = "";
  try {
    let imgRes = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=5&safesearch=true&editors_choice=true`
    );
    let imgData = imgRes.ok ? await imgRes.json() : { hits: [] };
    if (!imgData.hits?.length) {
      imgRes = await fetch(
        `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=5&safesearch=true`
      );
      imgData = imgRes.ok ? await imgRes.json() : { hits: [] };
    }
    imageUrl = imgData.hits?.[0]?.webformatURL || "";
  } catch { /* ignore */ }

  return { word: canonicalWord, ukPhonetic, usPhonetic, imageUrl, meanings };
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
  const { data } = await supabase
    .from("words")
    .select("*, meanings(*), progress(*)")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function deleteWord(id) {
  await supabase.from("words").delete().eq("id", id);
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

// 艾宾浩斯遗忘曲线复习间隔（天）
// 第1次→1天后复习，第2次→2天，第3次→4天，第4次→1周，第5次→2周，第6次→1月
const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30];

export async function getQuizWords({ extra = false } = {}) {
  const familyId = getFamilyId();

  if (!extra) {
    const todayDone = await getTodayQuizDone();
    if (todayDone) return [];
  }

  const { data: allWords } = await supabase
    .from("words")
    .select("*, meanings(*)")
    .eq("family_id", familyId);
  if (!allWords?.length) return [];

  const { data: quizHistory } = await supabase
    .from("quiz_log")
    .select("word_id, created_at, is_correct")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // 统计每个词的做题数据
  const wordStats = {};
  for (const q of (quizHistory || [])) {
    const date = q.created_at.slice(0, 10);
    if (!wordStats[q.word_id]) {
      wordStats[q.word_id] = { lastQuiz: new Date(q.created_at), dates: new Set(), wrong: 0, total: 0 };
    }
    wordStats[q.word_id].dates.add(date);
    wordStats[q.word_id].total++;
    if (!q.is_correct) wordStats[q.word_id].wrong++;
  }

  const quizzedWordIds = new Set((quizHistory || []).map((q) => q.word_id));
  const todayQuizzedIds = new Set(
    (quizHistory || []).filter((q) => q.created_at.slice(0, 10) === today).map((q) => q.word_id)
  );

  // 新词池：从未测试过的词（extra 模式下也排除今天刚作为新词测过的）
  const newPool = allWords.filter((w) =>
    !quizzedWordIds.has(w.id) && !(extra && todayQuizzedIds.has(w.id))
  );
  const newWords = shuffleArr(newPool).slice(0, 5);

  // 复习池：所有测试过的词（不排除今天的，让遗忘曲线+错误率决定优先级）
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
    // 错误率越高优先级越高，全错时权重×3
    const errorWeight = 1 + errorRate * 2;
    return { word: w, priority: timePriority * errorWeight };
  });

  scored.sort((a, b) => b.priority - a.priority);
  const reviewWords = scored.slice(0, 15).map((s) => s.word);

  return [...newWords, ...reviewWords];
}

export async function updateMasteryStatus(wordIds) {
  for (const wid of wordIds) {
    const { data: prog } = await supabase
      .from("progress")
      .select("correct_count")
      .eq("word_id", wid)
      .single();
    if (prog && prog.correct_count >= 5) {
      await supabase.from("progress").update({ stage: "mastered" }).eq("word_id", wid);
    }
  }
}

// ===== 测试记录 =====

export async function recordQuiz(wordId, meaningId, quizType, isCorrect) {
  const familyId = getFamilyId();
  await supabase.from("quiz_log").insert({
    word_id: wordId,
    meaning_id: meaningId,
    quiz_type: quizType,
    is_correct: isCorrect,
    family_id: familyId,
  });

  const { data: prog } = await supabase
    .from("progress")
    .select("*")
    .eq("word_id", wordId)
    .single();
  if (!prog) return;

  await supabase
    .from("progress")
    .update({
      correct_count: prog.correct_count + (isCorrect ? 1 : 0),
      wrong_count: prog.wrong_count + (isCorrect ? 0 : 1),
      last_quiz_at: new Date().toISOString(),
    })
    .eq("word_id", wordId);
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
