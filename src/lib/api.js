import { supabase } from "./supabase";
import { getFamilyId } from "./family";

const PIXABAY_KEY = import.meta.env.VITE_PIXABAY_API_KEY || "";

const POS_MAP = {
  n: "noun", v: "verb", adj: "adjective", adv: "adverb",
  prep: "preposition", conj: "conjunction", pron: "pronoun",
  int: "interjection", vt: "verb", vi: "verb", aux: "verb",
};

// ===== 查词 =====

export async function lookupWord(word) {
  const ydRes = await fetch(
    `/youdao-api/jsonapi_s?doctype=json&jsonversion=4&le=en&q=${encodeURIComponent(word)}`
  );
  if (!ydRes.ok) throw new Error("查询失败");
  const ydData = await ydRes.json();

  const ecWord = ydData.ec?.word;
  const ec = Array.isArray(ecWord) ? ecWord[0] : ecWord;
  if (!ec) throw new Error("词典未找到该单词");

  const phonetic = ec.usphone ? `/${ec.usphone}/` : ec.ukphone ? `/${ec.ukphone}/` : "";

  const meanings = (ec.trs || []).map((t) => {
    const raw = t.tran || "";
    const items = raw.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
    const numbered = items.length > 1
      ? items.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : items[0] || raw;
    return {
      pos: POS_MAP[t.pos?.replace(".", "")] || t.pos?.replace(".", "") || "",
      meaning_cn: numbered,
      meaning_en: "",
      example: "",
    };
  });

  let imageUrl = "";
  try {
    let imgRes = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(word)}&image_type=photo&per_page=5&safesearch=true&editors_choice=true`
    );
    let imgData = imgRes.ok ? await imgRes.json() : { hits: [] };
    if (!imgData.hits?.length) {
      imgRes = await fetch(
        `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(word)}&image_type=photo&per_page=5&safesearch=true`
      );
      imgData = imgRes.ok ? await imgRes.json() : { hits: [] };
    }
    imageUrl = imgData.hits?.[0]?.webformatURL || "";
  } catch { /* 图片获取失败不影响主流程 */ }

  return { word, phonetic, imageUrl, meanings };
}

// ===== 家长：保存单词 =====

export async function saveWord({ word, phonetic, imageUrl, meanings }) {
  const familyId = getFamilyId();
  const { data: wordRow, error: wErr } = await supabase
    .from("words")
    .upsert(
      { word, phonetic, image_url: imageUrl, family_id: familyId },
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
    example: m.example,
  }));
  const { error: mErr } = await supabase.from("meanings").insert(rows);
  if (mErr) throw mErr;

  await supabase
    .from("progress")
    .upsert(
      { word_id: wordRow.id, stage: "reserve", next_review_at: new Date().toISOString(), family_id: familyId },
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

// ===== 阶段流转 =====
// reserve → learning → testing → review → mastered

export async function getWordsByStage(stage) {
  const familyId = getFamilyId();
  const { data } = await supabase
    .from("progress")
    .select("word_id, stage, words(*, meanings(*))")
    .eq("stage", stage)
    .eq("family_id", familyId);
  return (data || []).map((d) => d.words).filter(Boolean);
}

export async function getReserveWords() {
  return getWordsByStage("reserve");
}

export async function getLearningWords() {
  return getWordsByStage("learning");
}

export async function getTestingWords() {
  return getWordsByStage("testing");
}

export async function getReviewWords() {
  const familyId = getFamilyId();
  const { data } = await supabase
    .from("progress")
    .select("word_id, stage, words(*, meanings(*))")
    .eq("stage", "review")
    .eq("family_id", familyId)
    .lte("next_review_at", new Date().toISOString());
  return (data || []).map((d) => d.words).filter(Boolean);
}

// 学生选词：reserve → learning
export async function selectWordsForToday(wordIds) {
  for (const wid of wordIds) {
    await supabase
      .from("progress")
      .update({ stage: "learning" })
      .eq("word_id", wid)
      .eq("stage", "reserve");
  }
}

// 学完卡片：learning → testing
export async function markAsTestable(wordIds) {
  for (const wid of wordIds) {
    await supabase
      .from("progress")
      .update({ stage: "testing" })
      .eq("word_id", wid)
      .eq("stage", "learning");
  }
}

// 闯关通过：testing → review
export async function markAsReview(wordIds) {
  const now = new Date();
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + 2);
  for (const wid of wordIds) {
    await supabase
      .from("progress")
      .update({
        stage: "review",
        last_quiz_at: now.toISOString(),
        next_review_at: nextReview.toISOString(),
      })
      .eq("word_id", wid)
      .eq("stage", "testing");
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

// 复习通过后更新
export async function markReviewDone(wordIds) {
  for (const wid of wordIds) {
    const { data: prog } = await supabase
      .from("progress")
      .select("*")
      .eq("word_id", wid)
      .single();
    if (!prog) continue;

    const correct = prog.correct_count;
    let stage = "review";
    const nextReview = new Date();
    if (correct >= 5) {
      stage = "mastered";
      nextReview.setDate(nextReview.getDate() + 14);
    } else {
      nextReview.setDate(nextReview.getDate() + 2);
    }

    await supabase
      .from("progress")
      .update({ stage, next_review_at: nextReview.toISOString() })
      .eq("word_id", wid);
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

export async function getTodayTaskStatus() {
  const familyId = getFamilyId();
  const testing = await getTestingWords();
  const review = await getReviewWords();
  const learning = await getLearningWords();

  const hasLearning = learning.length > 0;
  const hasTesting = testing.length > 0;
  const hasReview = review.length > 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: quizLogs } = await supabase
    .from("quiz_log")
    .select("id")
    .eq("family_id", familyId)
    .gte("created_at", todayStart.toISOString())
    .limit(1);
  const quizCount = quizLogs?.length || 0;

  const quizDone = !hasTesting && quizCount > 0;
  const reviewDone = !hasReview;
  const learnDone = !hasLearning;

  return {
    learnDone, quizDone, reviewDone, hasLearning, hasTesting, hasReview,
    testingCount: testing.length,
    reviewCount: review.length,
    learningCount: learning.length,
    allDone: learnDone && quizDone && reviewDone,
  };
}
