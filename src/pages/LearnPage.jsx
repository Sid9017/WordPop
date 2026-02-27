import { useState, useEffect } from "react";
import { getReserveWords, getLearningWords, selectWordsForToday, markAsTestable } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function LearnPage() {
  const [words, setWords] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState("right");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const reserve = await getReserveWords();
      if (reserve.length > 0) {
        await selectWordsForToday(reserve.map((w) => w.id));
      }
      const learning = await getLearningWords();
      setWords(learning);
      setLoading(false);
    })();
  }, []);

  async function handleFinish() {
    await markAsTestable(words.map((w) => w.id));
    navigate("/child");
  }

  function goTo(newIdx) {
    setDirection(newIdx > idx ? "right" : "left");
    setIdx(newIdx);
    setFlipped(false);
  }

  if (loading) return <div className="page center"><p className="loading-text">加载中...</p></div>;

  if (!words.length) {
    return (
      <div className="page center">
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <h2>没有待学习的单词</h2>
          <p>请让家长先添加储备单词</p>
          <button className="btn-primary" onClick={() => navigate("/child")}>返回</button>
        </div>
      </div>
    );
  }

  const w = words[idx];
  const progressPct = ((idx + 1) / words.length) * 100;

  return (
    <div className="page center">
      <div className="learn-progress">
        <div className="learn-progress-bar" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="progress-text">{idx + 1} / {words.length}</p>

      <div
        key={idx}
        className={`flashcard ${flipped ? "flipped" : ""} slide-${direction}`}
        onClick={() => setFlipped(!flipped)}
      >
        <div className="flashcard-inner">
          <div className="flashcard-front">
            {w.image_url && (
              <img src={w.image_url} alt={w.word} className="card-img" />
            )}
            <h1 className="card-word">{w.word}</h1>
            <p className="phonetic">{w.phonetic}</p>
            <p className="hint">👆 点击查看释义</p>
          </div>
          <div className="flashcard-back">
            <h2>{w.word}</h2>
            <div className="card-meanings">
              {w.meanings?.map((m, i) => (
                <div key={i} className="card-meaning">
                  <span className="pos-tag">{m.pos}</span>
                  <p className="cn" style={{ whiteSpace: "pre-line" }}>{m.meaning_cn}</p>
                  {m.example && <p className="example">💬 {m.example}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card-nav">
        <button
          disabled={idx === 0}
          onClick={() => goTo(idx - 1)}
        >
          ← 上一个
        </button>
        {idx < words.length - 1 ? (
          <button onClick={() => goTo(idx + 1)}>
            下一个 →
          </button>
        ) : (
          <button className="btn-primary btn-finish" onClick={handleFinish}>
            全部认识了，去测试 🚀
          </button>
        )}
      </div>
    </div>
  );
}
