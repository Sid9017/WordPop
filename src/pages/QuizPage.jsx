import { useState, useEffect, useCallback } from "react";
import { getTestingWords, getReviewWords, recordQuiz, markAsReview, markReviewDone, playAudio } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import Confetti from "../components/Confetti";

function primaryMeaning(text) {
  if (!text) return "";
  return text.split("\n")[0].replace(/^\d+\.\s*/, "").trim();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeOptions(correct, allWords, field) {
  const options = [correct];
  let pool;
  if (field === "word") {
    pool = allWords.map((w) => w.word).filter((v) => v && v !== correct);
  } else {
    pool = allWords.map((w) => primaryMeaning(w.meanings?.[0]?.meaning_cn)).filter((v) => v && v !== correct);
  }
  for (const v of shuffle(pool)) {
    if (options.length >= 4) break;
    if (!options.includes(v)) options.push(v);
  }
  while (options.length < 4) options.push("\u2014");
  return shuffle(options);
}

function buildQuestions(words) {
  const questions = [];
  const valid = words.filter((w) => w.meanings?.length);

  for (const w of valid) {
    const m = w.meanings[0];
    const display_cn = primaryMeaning(m.meaning_cn);
    const type = ["cn2en", "en2cn", "spell"][Math.floor(Math.random() * 3)];
    const q = { word: w, meaning: m, display_cn, type, wordId: w.id, meaningId: m.id };
    if (type === "cn2en") q.options = makeOptions(w.word, words, "word");
    if (type === "en2cn") q.options = makeOptions(display_cn, words, "meaning_cn");
    questions.push(q);
  }

  if (valid.length >= 3) {
    const matchWords = shuffle(valid).slice(0, Math.min(4, valid.length));
    const pairs = matchWords.map((w) => ({
      wordId: w.id, meaningId: w.meanings[0].id,
      en: w.word, cn: primaryMeaning(w.meanings[0].meaning_cn),
    }));
    questions.push({
      type: "match", pairs,
      wordIds: matchWords.map((w) => w.id),
      meaningIds: matchWords.map((w) => w.meanings[0].id),
    });
  }

  return shuffle(questions);
}

function MatchGame({ pairs, onComplete }) {
  const [leftItems] = useState(() => shuffle(pairs.map((p) => ({ id: p.wordId, text: p.cn, key: p.en }))));
  const [rightItems] = useState(() => shuffle(pairs.map((p) => ({ id: p.wordId, text: p.en, key: p.en }))));
  const [selLeft, setSelLeft] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrongPair, setWrongPair] = useState(null);
  const [mistakes, setMistakes] = useState(0);

  function clickLeft(item) {
    if (matched.includes(item.key)) return;
    setSelLeft(item);
    setWrongPair(null);
  }

  function clickRight(item) {
    if (!selLeft || matched.includes(item.key)) return;
    if (selLeft.key === item.key) {
      const m = [...matched, item.key];
      setMatched(m);
      setSelLeft(null);
      if (m.length === pairs.length) setTimeout(() => onComplete(mistakes === 0), 400);
    } else {
      setMistakes((n) => n + 1);
      setWrongPair({ left: selLeft.key, right: item.key });
      setTimeout(() => { setWrongPair(null); setSelLeft(null); }, 600);
    }
  }

  return (
    <div className="quiz-card match-card">
      <p className="quiz-label">中英连连看 — 点左侧中文，再点右侧英文</p>
      <div className="match-grid">
        {leftItems.map((left, i) => {
          const right = rightItems[i];
          return (
            <div className="match-row" key={i}>
              <button
                className={`match-item left ${matched.includes(left.key) ? "matched" : ""} ${selLeft?.key === left.key ? "active" : ""} ${wrongPair?.left === left.key ? "wrong" : ""}`}
                onClick={() => clickLeft(left)} disabled={matched.includes(left.key)}>
                {left.text}
              </button>
              <button
                className={`match-item right ${matched.includes(right.key) ? "matched" : ""} ${wrongPair?.right === right.key ? "wrong" : ""}`}
                onClick={() => clickRight(right)} disabled={matched.includes(right.key)}>
                {right.text}
              </button>
            </div>
          );
        })}
      </div>
      <p className="match-progress">已配对 {matched.length} / {pairs.length}</p>
    </div>
  );
}

export default function QuizPage() {
  const [searchParams] = useSearchParams();
  const isReview = searchParams.get("mode") === "review";
  const navigate = useNavigate();

  const [allWords, setAllWords] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [spellInput, setSpellInput] = useState("");
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [wrongOnes, setWrongOnes] = useState([]);
  const [phase, setPhase] = useState("quiz");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    (async () => {
      const words = isReview ? await getReviewWords() : await getTestingWords();
      setAllWords(words);
      setQuestions(buildQuestions(words));
      setLoading(false);
    })();
  }, [isReview]);

  const currentQ = questions[qIdx];

  const handleAnswer = useCallback(async (answer) => {
    if (answered) return;
    const q = currentQ;
    let correct = false;
    if (q.type === "cn2en") correct = answer === q.word.word;
    else if (q.type === "en2cn") correct = answer === q.display_cn;
    else if (q.type === "spell") correct = answer.trim().toLowerCase() === q.word.word.toLowerCase();

    setAnswered(true);
    setIsCorrect(correct);
    setSelected(answer);
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    if (!correct) setWrongOnes((prev) => [...prev, q]);
    await recordQuiz(q.wordId, q.meaningId, q.type, correct);
  }, [answered, currentQ]);

  function handleMatchComplete(allCorrect) {
    const q = currentQ;
    setAnswered(true);
    setIsCorrect(allCorrect);
    setScore((s) => ({ correct: s.correct + (allCorrect ? 1 : 0), total: s.total + 1 }));
    if (!allCorrect) setWrongOnes((prev) => [...prev, q]);
    for (let i = 0; i < q.wordIds.length; i++) {
      recordQuiz(q.wordIds[i], q.meaningIds[i], "match", allCorrect);
    }
  }

  async function nextQuestion() {
    if (qIdx < questions.length - 1) {
      setTransitioning(true);
      setTimeout(() => {
        setQIdx(qIdx + 1);
        resetState();
        setTransitioning(false);
      }, 200);
    } else if (phase === "quiz" && wrongOnes.length > 0) {
      setTransitioning(true);
      setTimeout(() => {
        setPhase("retry");
        const retryQs = wrongOnes.map((q) => {
          if (q.type === "cn2en") return { ...q, options: makeOptions(q.word.word, allWords, "word") };
          if (q.type === "en2cn") return { ...q, options: makeOptions(q.display_cn, allWords, "meaning_cn") };
          return { ...q };
        });
        setQuestions(shuffle(retryQs));
        setWrongOnes([]);
        setQIdx(0);
        resetState();
        setTransitioning(false);
      }, 200);
    } else {
      setPhase("done");
      setShowConfetti(true);
      const wordIds = allWords.map((w) => w.id);
      if (isReview) await markReviewDone(wordIds);
      else await markAsReview(wordIds);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }

  function resetState() {
    setSelected(null);
    setSpellInput("");
    setAnswered(false);
    setIsCorrect(false);
  }

  if (loading) return <div className="page center"><p className="loading-text">加载题目中...</p></div>;

  if (!questions.length) {
    return (
      <div className="page center">
        <div className="empty-state">
          <span className="empty-icon">{isReview ? "📭" : "📭"}</span>
          <h2>{isReview ? "暂无待复习的单词" : "暂无待测试的单词"}</h2>
          <p>{isReview ? "复习任务已完成" : "先去认识新单词吧！"}</p>
          <button className="btn-primary" onClick={() => navigate("/child")}>返回</button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const pct = Math.round((score.correct / score.total) * 100);
    return (
      <div className="page center">
        {showConfetti && <Confetti />}
        <div className="result-card">
          <h1>{pct >= 80 ? "🎉 太棒了！" : pct >= 60 ? "👍 不错！" : "💪 继续加油！"}</h1>
          <div className="score-ring"><span className="score-num">{pct}%</span></div>
          <p>共 {score.total} 题，答对 {score.correct} 题</p>
          <p style={{ fontSize: 14, color: "#636e72" }}>{isReview ? "复习完成，单词已更新" : "单词已转入复习库"}</p>
          <div className="result-actions"><button className="btn-primary" onClick={() => navigate("/child")}>返回首页</button></div>
        </div>
      </div>
    );
  }

  const q = currentQ;
  const progressPct = ((qIdx + 1) / questions.length) * 100;

  return (
    <div className="page center">
      {showConfetti && <Confetti />}
      {phase === "retry" && <div className="retry-banner">🔄 错题重考回合</div>}
      <div className="quiz-progress"><div className="quiz-progress-bar" style={{ width: `${progressPct}%` }} /></div>
      <p className="progress-text">第 {qIdx + 1} / {questions.length} 题</p>

      <div className={`quiz-transition ${transitioning ? "out" : "in"}`}>
        {q.type === "match" ? (
          <MatchGame key={qIdx} pairs={q.pairs} onComplete={handleMatchComplete} />
        ) : (
          <div className="quiz-card" key={qIdx}>
            {q.type === "cn2en" && (
              <>
                <p className="quiz-label">看中文，选英文</p>
                <h2 className="quiz-prompt">{q.display_cn}</h2>
                {q.meaning.pos && <span className="pos-tag">{q.meaning.pos}</span>}
                <div className="options">
                  {q.options.map((opt, i) => (
                    <button key={i}
                      className={`option ${answered ? (opt === q.word.word ? "correct" : opt === selected ? "wrong" : "") : ""}`}
                      onClick={() => { if (!answered) handleAnswer(opt); else playAudio(opt, 2); }}
                      disabled={false}>{opt} {answered && opt === q.word.word && <span className="audio-hint">🔊</span>}</button>
                  ))}
                </div>
              </>
            )}
            {q.type === "en2cn" && (
              <>
                <p className="quiz-label">看英文，选中文</p>
                <h2 className="quiz-prompt quiz-word-clickable" onClick={() => playAudio(q.word.word, 2)}>{q.word.word} <span className="audio-hint">🔊</span></h2>
                <span className="phonetic">{q.word.phonetic}</span>
                <div className="options">
                  {q.options.map((opt, i) => (
                    <button key={i}
                      className={`option ${answered ? (opt === q.display_cn ? "correct" : opt === selected ? "wrong" : "") : ""}`}
                      onClick={() => handleAnswer(opt)} disabled={answered}>{opt}</button>
                  ))}
                </div>
              </>
            )}
            {q.type === "spell" && (
              <>
                <p className="quiz-label">拼写单词</p>
                <h2 className="quiz-prompt">{q.display_cn}</h2>
                {q.meaning.pos && <span className="pos-tag">{q.meaning.pos}</span>}
                <div className="spell-input">
                  <input value={spellInput} onChange={(e) => setSpellInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !answered && handleAnswer(spellInput)}
                    placeholder="输入英文拼写..." disabled={answered} autoFocus />
                  {!answered && <button onClick={() => handleAnswer(spellInput)}>确认</button>}
                </div>
                {answered && (
                  <p className={`spell-result ${isCorrect ? "correct" : "wrong"}`}>
                    {isCorrect ? "✅ 正确！" : <>❌ 正确答案: <span className="quiz-word-clickable" onClick={() => playAudio(q.word.word, 2)}>{q.word.word} 🔊</span></>}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {answered && (
        <button className="btn-primary btn-next" onClick={nextQuestion}>
          {qIdx < questions.length - 1 ? "下一题 →" : phase === "quiz" && wrongOnes.length > 0 ? "进入错题重考 🔄" : "查看结果 🏆"}
        </button>
      )}
    </div>
  );
}
