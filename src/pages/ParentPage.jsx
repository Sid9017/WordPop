import { useState, useEffect, useMemo } from "react";
import { lookupWord, saveWord, getAllWords, deleteWord, playAudio } from "../lib/api";
import { getInviteToken } from "../lib/family";
import { SpeakerIcon } from "../components/Icons";

const STAGE_LABELS = {
  testing: "待测试", mastered: "已掌握",
};

const STAGE_FILTERS = [
  { value: "all", label: "全部" },
  { value: "testing", label: "待测试" },
  { value: "mastered", label: "已掌握" },
];

export default function ParentPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [words, setWords] = useState([]);
  const [msg, setMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [expandedWords, setExpandedWords] = useState({});



  useEffect(() => { loadWords(); }, []);

  async function loadWords() {
    const data = await getAllWords();
    setWords(data);
  }

  async function handleLookup() {
    if (!input.trim()) return;
    setLoading(true);
    setMsg("");
    try {
      const data = await lookupWord(input.trim());
      setPreview(data);
    } catch {
      setMsg("查询失败，请检查单词拼写");
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!preview) return;
    setLoading(true);
    try {
      await saveWord(preview);
      setMsg("已保存");
      setPreview(null);
      setInput("");
      loadWords();
    } catch (err) {
      setMsg("保存失败: " + err.message);
    }
    setLoading(false);
  }

  function updateMeaning(idx, field, value) {
    setPreview((prev) => {
      const meanings = [...prev.meanings];
      meanings[idx] = { ...meanings[idx], [field]: value };
      return { ...prev, meanings };
    });
  }

  async function handleDelete(id) {
    if (!confirm("确定删除？")) return;
    await deleteWord(id);
    loadWords();
  }

  function toggleWord(id) {
    setExpandedWords((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const filtered = useMemo(() => {
    let list = words;
    if (stageFilter !== "all") {
      list = list.filter((w) => {
        const stage = w.progress?.[0]?.stage || "testing";
        return stage === stageFilter;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((w) =>
        w.word.toLowerCase().includes(q) ||
        w.meanings?.some((m) => m.meaning_cn?.includes(q))
      );
    }
    return list;
  }, [words, stageFilter, search]);

  const stageCounts = useMemo(() => {
    const counts = { all: words.length };
    for (const w of words) {
      const stage = w.progress?.[0]?.stage || "testing";
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return counts;
  }, [words]);

  return (
    <div className="page">
      <h1 className="page-title">家长管理</h1>

      <div className="input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          placeholder="输入英文单词..."
          disabled={loading}
        />
        <button onClick={handleLookup} disabled={loading}>
          {loading ? "查询中..." : "查询"}
        </button>
      </div>

      {msg && <p className="msg">{msg}</p>}

      {preview && (
        <div className="preview-card">
          <div className="preview-header">
            <div>
              <h2>{preview.word}</h2>
              <div className="phonetic-row">
                {preview.ukPhonetic && (
                  <span className="phonetic-item">
                    <span className="phonetic-label">UK</span>
                    <span className="phonetic">{preview.ukPhonetic}</span>
                    <button className="audio-btn" onClick={() => playAudio(preview.word, 1)} title="英音"><SpeakerIcon size={14} /></button>
                  </span>
                )}
                {preview.usPhonetic && (
                  <span className="phonetic-item">
                    <span className="phonetic-label">US</span>
                    <span className="phonetic">{preview.usPhonetic}</span>
                    <button className="audio-btn" onClick={() => playAudio(preview.word, 2)} title="美音"><SpeakerIcon size={14} /></button>
                  </span>
                )}
              </div>
            </div>
            {preview.imageUrl && (
              <img src={preview.imageUrl} alt={preview.word} className="preview-img" />
            )}
          </div>

          <div className="meanings-edit">
            {preview.meanings.map((m, i) => (
              <div key={i} className="meaning-block">
                <span className="pos-tag">{m.pos}</span>
                <p
                  className="meaning-text"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateMeaning(i, "meaning_cn", e.currentTarget.textContent)}
                >
                  {m.meaning_cn}
                </p>
                {m.example && <p className="example">{m.example}</p>}
                {m.example_cn && <p className="example">{m.example_cn}</p>}
              </div>
            ))}
          </div>

          <button className="btn-save" onClick={handleSave} disabled={loading}>
            保存单词
          </button>
        </div>
      )}

      <div className="word-browser">
        <h2>已添加的单词 ({words.length})</h2>

        <div className="browser-toolbar">
          <input
            className="browser-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索单词或释义..."
          />
          <div className="stage-filters">
            {STAGE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`stage-filter-btn ${stageFilter === f.value ? "active" : ""}`}
                onClick={() => setStageFilter(f.value)}
              >
                {f.label}
                {stageCounts[f.value] != null && (
                  <span className="filter-count">{stageCounts[f.value] || 0}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="browser-empty">
            {search || stageFilter !== "all" ? "没有匹配的单词" : "还没有添加单词"}
          </p>
        ) : (
          <div className="word-list">
            {filtered.map((w) => {
              const stage = w.progress?.[0]?.stage || "testing";
              const correct = w.progress?.[0]?.correct_count || 0;
              const wrong = w.progress?.[0]?.wrong_count || 0;
              const total = correct + wrong;
              const accuracy = total > 0 ? correct / total : -1;
              const hue = accuracy >= 0 ? Math.round(accuracy * 120) : 220;
              const bgOpacity = total > 0
                ? Math.min(0.15, 0.05 + (total / 30) * 0.1)
                : 0.06;
              const cardStyle = {
                background: `linear-gradient(135deg, hsla(${hue}, 75%, 55%, ${bgOpacity}) 0%, transparent 70%)`
              };

              return (
                <div key={w.id} className="word-item" style={cardStyle}>
                  <div className="word-item-header" onClick={() => toggleWord(w.id)}>
                    <span className="word-item-arrow">{expandedWords[w.id] ? "▾" : "▸"}</span>
                    <strong className="word-item-word">{w.word}</strong>
                    <span className="phonetic">{w.phonetic}</span>
                    <span className={`stage-badge ${stage}`}>
                      {STAGE_LABELS[stage] || stage}
                    </span>
                    {total > 0 && (
                      <span className="word-item-acc" style={{ color: `hsl(${hue}, 65%, 40%)` }}>
                        {Math.round(accuracy * 100)}%
                      </span>
                    )}
                    <span className="word-item-brief">
                      {w.meanings?.[0]?.meaning_cn?.split("\n")[0] || ""}
                    </span>
                  </div>
                  <div className="word-stats-bar">
                    {total > 0 ? (
                      <>
                        <div className="word-stats-fill correct" style={{ width: `${accuracy * 100}%` }} />
                        <div className="word-stats-fill wrong" style={{ width: `${(1 - accuracy) * 100}%` }} />
                      </>
                    ) : (
                      <div className="word-stats-fill untested" style={{ width: '100%' }} />
                    )}
                  </div>
                  {expandedWords[w.id] && (
                    <div className="word-item-detail">
                      {total > 0 && (
                        <div className="word-stats-detail">
                          <span>做题 {total} 次</span>
                          <span className="stats-correct">正确 {correct}</span>
                          <span className="stats-wrong">错误 {wrong}</span>
                          <span style={{ color: `hsl(${hue}, 65%, 40%)`, fontWeight: 600 }}>
                            正确率 {Math.round(accuracy * 100)}%
                          </span>
                        </div>
                      )}
                      {w.image_url && <img src={w.image_url} alt={w.word} className="word-item-img" />}
                      <div className="phonetic-row">
                        {w.uk_phonetic && (
                          <span className="phonetic-item">
                            <span className="phonetic-label">UK</span>
                            <span className="phonetic">{w.uk_phonetic}</span>
                            <button className="audio-btn" onClick={() => playAudio(w.word, 1)} title="英音"><SpeakerIcon size={14} /></button>
                          </span>
                        )}
                        {w.phonetic && (
                          <span className="phonetic-item">
                            <span className="phonetic-label">US</span>
                            <span className="phonetic">{w.phonetic}</span>
                            <button className="audio-btn" onClick={() => playAudio(w.word, 2)} title="美音"><SpeakerIcon size={14} /></button>
                          </span>
                        )}
                      </div>
                      {w.meanings?.map((m, i) => (
                        <div key={i} className="word-item-meaning">
                          {m.pos && <span className="pos-tag">{m.pos}</span>}
                          <p style={{ whiteSpace: "pre-line" }}>{m.meaning_cn}</p>
                          {m.example && (
                            <div className="example-block">
                              <p className="example-en">{m.example}</p>
                              {m.example_cn && <p className="example-cn">{m.example_cn}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                      <button className="btn-del" onClick={() => handleDelete(w.id)}>删除此词</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}



      </div>

      <div className="invite-section">
        <h2>邀请新用户</h2>
        <p style={{ fontSize: 13, color: "#7f8c8d", margin: "8px 0" }}>
          生成邀请链接发给朋友，对方打开后即可创建自己的账号
        </p>
        {inviteLink ? (
          <div className="invite-link-box">
            <input readOnly value={inviteLink} onClick={(e) => e.target.select()} />
            <button onClick={async () => {
              await navigator.clipboard.writeText(inviteLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}>
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={async () => {
            const token = await getInviteToken();
            if (token) setInviteLink(`${window.location.origin}/invite/${token}`);
          }}>
            生成邀请链接
          </button>
        )}
      </div>
    </div>
  );
}
