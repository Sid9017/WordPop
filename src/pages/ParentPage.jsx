import { useState, useEffect, useMemo } from "react";
import { lookupWord, saveWord, getAllWords, deleteWord } from "../lib/api";
import { getInviteToken } from "../lib/family";

const STAGE_LABELS = {
  reserve: "储备", learning: "学习中", testing: "待测试",
  review: "待复习", mastered: "已掌握",
};

export default function ParentPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [words, setWords] = useState([]);
  const [msg, setMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

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
      setMsg("✅ 已保存");
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

  return (
    <div className="page">
      <h1 className="page-title">📝 家长管理</h1>

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
              <span className="phonetic">{preview.phonetic}</span>
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
                {m.example && <p className="example">例: {m.example}</p>}
              </div>
            ))}
          </div>

          <button className="btn-save" onClick={handleSave} disabled={loading}>
            保存单词
          </button>
        </div>
      )}

      <h2>已添加的单词 ({words.length})</h2>
      <WordArchive words={words} onDelete={handleDelete} />

      <div className="invite-section">
        <h2>📨 邀请新用户</h2>
        <p style={{ fontSize: 13, color: "#636e72", margin: "8px 0" }}>
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
              {copied ? "已复制 ✓" : "复制"}
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

function WordArchive({ words, onDelete }) {
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedWords, setExpandedWords] = useState({});

  const grouped = useMemo(() => {
    const map = {};
    for (const w of words) {
      const date = w.created_at?.slice(0, 10) || "未知日期";
      if (!map[date]) map[date] = [];
      map[date].push(w);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [words]);

  function toggleDate(date) {
    setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  }

  function toggleWord(id) {
    setExpandedWords((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="archive">
      {grouped.map(([date, items]) => {
        const label = date === today ? `今天 (${date})` : date;
        const open = expandedDates[date] ?? date === today;
        return (
          <div key={date} className="archive-group">
            <div className="archive-date" onClick={() => toggleDate(date)}>
              <span className="archive-arrow">{open ? "▼" : "▶"}</span>
              <span>{label}</span>
              <span className="archive-count">{items.length} 个词</span>
            </div>
            {open && (
              <div className="archive-items">
                {items.map((w) => {
                  const stage = w.progress?.[0]?.stage || "reserve";
                  return (
                    <div key={w.id} className="archive-word">
                      <div className="archive-word-header" onClick={() => toggleWord(w.id)}>
                        <span className="archive-arrow-sm">{expandedWords[w.id] ? "▾" : "▸"}</span>
                        <strong>{w.word}</strong>
                        <span className="phonetic">{w.phonetic}</span>
                        <span className={`stage-badge ${stage}`}>
                          {STAGE_LABELS[stage] || stage}
                        </span>
                        <span className="archive-brief">
                          {w.meanings?.[0]?.meaning_cn?.split("\n")[0] || ""}
                        </span>
                      </div>
                      {expandedWords[w.id] && (
                        <div className="archive-detail">
                          {w.image_url && <img src={w.image_url} alt={w.word} className="archive-img" />}
                          {w.meanings?.map((m, i) => (
                            <div key={i} className="archive-meaning">
                              {m.pos && <span className="pos-tag">{m.pos}</span>}
                              <p style={{ whiteSpace: "pre-line" }}>{m.meaning_cn}</p>
                            </div>
                          ))}
                          <button className="btn-del" onClick={() => onDelete(w.id)}>删除此词</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
