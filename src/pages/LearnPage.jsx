import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getQuizWords, playAudio } from "../lib/api";
import { SpeakerIcon } from "../components/Icons";

export default function LearnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const extra = searchParams.get("extra") === "1";

  const [words, setWords] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      const all = await getQuizWords({ extra: true });
      const newWords = all.filter((w) => w._isNew);
      setWords(newWords);
      setLoading(false);
    })();
  }, []);

  const lastPlayedRef = useRef("");
  useEffect(() => {
    if (words.length > 0) {
      const key = `${idx}-${words[idx].word}`;
      if (lastPlayedRef.current !== key) {
        lastPlayedRef.current = key;
        playAudio(words[idx].word, 2);
      }
    }
  }, [idx, words]);

  if (loading) return <div className="page center"><p className="loading-text">加载中...</p></div>;
  if (!words.length) return <div className="page center"><p className="loading-text">暂无新词</p></div>;

  const word = words[idx];
  const isLast = idx === words.length - 1;
  const progress = `${idx + 1} / ${words.length}`;

  return (
    <div className="page learn-page">
      <div className="learn-progress-bar">
        <div className="learn-progress-fill" style={{ width: `${((idx + 1) / words.length) * 100}%` }} />
      </div>
      <p className="learn-progress-text">{progress}</p>

      <div className="learn-card">
        <h1
          className="learn-word"
          onClick={() => playAudio(word.word, 2)}
        >
          {word.word}
        </h1>

        <div className="learn-phonetics">
          {word.uk_phonetic && (
            <span className="learn-ph" onClick={() => playAudio(word.word, 1)}>
              <SpeakerIcon size={14} />
              <span className="learn-ph-label">UK</span> {word.uk_phonetic}
            </span>
          )}
          {word.phonetic && (
            <span className="learn-ph" onClick={() => playAudio(word.word, 2)}>
              <SpeakerIcon size={14} />
              <span className="learn-ph-label">US</span> {word.phonetic}
            </span>
          )}
        </div>

        <div className="learn-meanings">
          {word.meanings?.map((m, i) => (
            <div key={i} className="learn-meaning">
              {m.pos && <span className="learn-pos">{m.pos}</span>}
              <p className="learn-cn">{m.meaning_cn}</p>
              {m.example && (
                <div className="learn-example">
                  <p className="learn-ex-en">{m.example}</p>
                  {m.example_cn && <p className="learn-ex-cn">{m.example_cn}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        className="learn-next-btn"
        onClick={() => {
          if (isLast) {
            navigate(extra ? "/child/quiz?extra=1" : "/child/quiz");
          } else {
            setIdx((i) => i + 1);
          }
        }}
      >
        {isLast ? "开始测测 ✏️" : "下一个 →"}
      </button>
    </div>
  );
}
