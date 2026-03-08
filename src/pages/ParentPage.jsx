import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { lookupWord, saveWord, getAllWords, deleteWord, playAudio, batchLookupWords } from "../lib/api";
import { getInviteToken } from "../lib/family";
import { SpeakerIcon } from "../components/Icons";
import WordBankPanel from "../components/WordBankPanel";
import { startGlobalImport, useGlobalImportTask } from "../components/ImportProgress";

const STAGE_FILTERS = [
  { value: "all", label: "全部" },
  { value: "untested", label: "待测试" },
  { value: "tested", label: "已测试" },
];

function MeaningLines({ text }) {
  const lines = (text || "").split("\n").filter(Boolean);
  if (lines.length <= 1) return <p className="meaning-line">{text}</p>;
  return lines.map((line, i) => {
    const alpha = 1 - 0.5 * (i / (lines.length - 1));
    return <p key={i} className="meaning-line" style={{ color: `rgba(26, 26, 46, ${alpha})` }}>{line}</p>;
  });
}

function parseInputWords(text) {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s && /^[a-zA-Z\s\-']+$/.test(s));
}

export default function ParentPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [batchResults, setBatchResults] = useState(null);
  const [words, setWords] = useState([]);
  const [msg, setMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [expandedWords, setExpandedWords] = useState({});
  const [showCount, setShowCount] = useState(10);
  const [showBankPanel, setShowBankPanel] = useState(false);
  const dropdownRef = useRef(null);

  const importTask = useGlobalImportTask();

  const loadWords = useCallback(async () => {
    const data = await getAllWords();
    setWords(data);
  }, []);

  useEffect(() => { loadWords(); }, [loadWords]);

  useEffect(() => {
    if (importTask && !importTask.active) loadWords();
  }, [importTask?.active, loadWords]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowBankPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inputWords = parseInputWords(input);
  const isBatchMode = inputWords.length > 1;

  async function handleLookup() {
    if (!input.trim()) return;
    setLoading(true);
    setMsg("");
    setPreview(null);
    setBatchResults(null);

    if (isBatchMode) {
      try {
        const results = await batchLookupWords(inputWords, (progress) => {
          setMsg(`查询中... 缓存命中 ${progress.cached}，剩余 ${progress.remaining}${progress.current ? ` (${progress.current})` : ""}`);
        });
        setBatchResults(results);
        setMsg("");
      } catch {
        setMsg("批量查询失败");
      }
    } else {
      try {
        const data = await lookupWord(input.trim());
        setPreview(data);
      } catch {
        setMsg("查询失败，请检查单词拼写");
      }
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

  function handleBatchImport() {
    if (!batchResults?.length) return;
    const existingSet = new Set(words.map((w) => w.word?.toLowerCase()));
    const newWords = batchResults.filter((w) => !existingSet.has(w.word.toLowerCase()));
    if (!newWords.length) {
      setMsg("所有单词已存在，无需导入");
      return;
    }
    startGlobalImport(newWords);
    setBatchResults(null);
    setInput("");
  }

  function handleBankImport(bankWords) {
    startGlobalImport(bankWords);
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
    setShowCount(10);
    let list = words;
    if (stageFilter !== "all") {
      list = list.filter((w) => {
        const p = Array.isArray(w.progress) ? w.progress[0] : w.progress;
        const total = (p?.correct_count || 0) + (p?.wrong_count || 0);
        return stageFilter === "tested" ? total > 0 : total === 0;
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
    const counts = { all: words.length, tested: 0, untested: 0 };
    for (const w of words) {
      const p = Array.isArray(w.progress) ? w.progress[0] : w.progress;
      const total = (p?.correct_count || 0) + (p?.wrong_count || 0);
      if (total > 0) counts.tested++;
      else counts.untested++;
    }
    return counts;
  }, [words]);

  return (
    <div className="page">
      <h1 className="page-title">家长管理</h1>

      <div className="combobox-wrapper" ref={dropdownRef}>
        <div className="input-row">
          <div className="input-with-toggle">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="输入单词，多个词用逗号分隔..."
              disabled={loading}
            />
            <button
              className={`dropdown-toggle ${showBankPanel ? "active" : ""}`}
              onClick={() => setShowBankPanel(!showBankPanel)}
              title="从词库导入"
            >
              ▼
            </button>
          </div>
        </div>
        {isBatchMode && !loading && !batchResults && (
          <p className="batch-hint">检测到 {inputWords.length} 个单词，点击查询批量导入</p>
        )}
        {showBankPanel && (
          <div className="dropdown-panel">
            <WordBankPanel
              onImport={handleBankImport}
              existingWords={words}
              onClose={() => setShowBankPanel(false)}
            />
          </div>
        )}
      </div>

      {msg && <p className="msg">{msg}</p>}

      {batchResults && (
        <div className="batch-preview">
          <div className="batch-preview-header">
            <h3>查询结果 ({batchResults.length} 词)</h3>
            <button className="btn-primary" onClick={handleBatchImport}>
              确认导入
            </button>
            <button className="btn-cancel" onClick={() => { setBatchResults(null); setInput(""); }}>
              取消
            </button>
          </div>
          <div className="batch-word-list">
            {batchResults.map((w) => {
              const exists = words.some((ew) => ew.word?.toLowerCase() === w.word.toLowerCase());
              return (
                <div key={w.word} className={`wb-word-item ${exists ? "wb-exists" : ""}`}>
                  <span className="wb-word">{w.word}</span>
                  <span className="wb-phonetic">{w.usPhonetic || w.ukPhonetic}</span>
                  <span className="wb-meaning">{w.meanings?.[0]?.meaning_cn?.split("\n")[0] || ""}</span>
                  {exists && <span className="wb-tag-exists">已添加</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          </div>

          <div className="meanings-edit">
            {preview.meanings.map((m, i) => (
              <div key={i} className="meaning-block">
                <span className="pos-tag">{m.pos}</span>
                <div className="meaning-lines">
                  <MeaningLines text={m.meaning_cn} />
                </div>
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
          <>
          <div className="word-list">
            {filtered.slice(0, showCount).map((w) => {
              const prog = Array.isArray(w.progress) ? w.progress[0] : w.progress;
              const stage = prog?.stage || "testing";
              const correct = prog?.correct_count || 0;
              const wrong = prog?.wrong_count || 0;
              const total = correct + wrong;
              const accuracy = total > 0 ? correct / total : -1;
              const hue = accuracy >= 0 ? Math.round(accuracy * 120) : 220;

              const accPct = total > 0 ? Math.round(accuracy * 100) : -1;
              const badgeStyle = total > 0
                ? { background: `hsla(${hue}, 75%, 55%, 0.15)`, color: `hsl(${hue}, 65%, 35%)` }
                : {};
              const badgeText = total > 0
                ? (accPct === 100 ? "全对" : `错${Math.round((1 - accuracy) * 100)}%`)
                : "待测试";

              return (
                <div key={w.id} className="word-item">
                  <div className="word-item-header" onClick={() => toggleWord(w.id)}>
                    <span className="word-item-arrow">{expandedWords[w.id] ? "▾" : "▸"}</span>
                    <strong className="word-item-word">{w.word}</strong>
                    <span className="phonetic">{w.phonetic}</span>
                    <span className="stage-badge" style={badgeStyle}>
                      {badgeText}
                    </span>
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
                          <div className="meaning-lines"><MeaningLines text={m.meaning_cn} /></div>
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
          {filtered.length > showCount && (
            <button
              className="btn-show-more"
              onClick={() => setShowCount((c) => c + 10)}
            >
              显示更多（还有 {filtered.length - showCount} 个）
            </button>
          )}
          </>
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
