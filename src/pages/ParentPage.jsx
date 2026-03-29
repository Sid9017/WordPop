import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  lookupWord,
  saveWord,
  deleteWord,
  playAudio,
  batchLookupWords,
  fetchParentWordDetail,
  getParentWordListStats,
  getParentWordSummaryPage,
  PARENT_LIST_PAGE_SIZE,
} from "../lib/api";
import { getInviteToken, getDailyNewWords, updateDailyNewWords, getSelectedBanks, updateSelectedBanks, getPronunciationPref, updatePronunciationPref } from "../lib/family";
import { setAudioPref } from "../lib/api";
import { SpeakerIcon } from "../components/Icons";
import { startGlobalImport, useGlobalImportTask } from "../components/ImportProgress";

const BANKS = [
  { id: "custom", name: "我的词库", desc: "手动添加", category: "我的" },
  { id: "KET", name: "KET", desc: "Cambridge A2 Key", category: "剑桥体系" },
  { id: "PET", name: "PET", desc: "Cambridge B1 Preliminary", category: "剑桥体系" },
  { id: "CET4", name: "CET-4", desc: "大学英语四级", category: "大学英语" },
  { id: "CET6", name: "CET-6", desc: "大学英语六级", category: "大学英语" },
  { id: "TOEFL", name: "TOEFL", desc: "托福", category: "留学考试" },
  { id: "IELTS", name: "IELTS", desc: "雅思", category: "留学考试" },
  { id: "SAT", name: "SAT", desc: "SAT", category: "留学考试" },
  { id: "GRE", name: "GRE", desc: "GRE", category: "留学考试" },
  { id: "GMAT", name: "GMAT", desc: "GMAT", category: "商务职场" },
  { id: "BEC", name: "BEC", desc: "商务英语", category: "商务职场" },
];
const CATEGORIES = ["我的", "剑桥体系", "大学英语", "留学考试", "商务职场"];

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
  const [bankFilter, setBankFilter] = useState("all");
  const [expandedWords, setExpandedWords] = useState({});
  const [listStats, setListStats] = useState({
    cntAll: 0,
    cntTested: 0,
    cntUntested: 0,
    bankCounts: {},
  });
  const [listTotal, setListTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dailyNew, setDailyNew] = useState(5);
  const [dailyNewSaving, setDailyNewSaving] = useState(false);
  const [sliderHint, setSliderHint] = useState("");
  const [sliderHintKey, setSliderHintKey] = useState(0);
  const [selectedBanks, setSelectedBanks] = useState(["custom"]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const detailFetchRef = useRef(new Set());
  const [pronPref, setPronPref] = useState("us");
  const hintTimer = useRef(null);
  const sliderRef = useRef(null);

  const importTask = useGlobalImportTask();

  const banksRef = useRef(selectedBanks);
  banksRef.current = selectedBanks;
  const listInitRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(
    async (banksOverride) => {
      const b = banksOverride ?? selectedBanks;
      setWordsLoading(true);
      setExpandedWords({});
      detailFetchRef.current.clear();
      setDetailLoadingId(null);
      try {
        const [stats, page] = await Promise.all([
          getParentWordListStats(b),
          getParentWordSummaryPage({
            selectedBanks: b,
            stage: stageFilter,
            bankSource: bankFilter,
            search: debouncedSearch,
            limit: PARENT_LIST_PAGE_SIZE,
            offset: 0,
          }),
        ]);
        setListStats(stats);
        setWords(page.items);
        setListTotal(page.totalCount);
      } catch {
        setMsg("加载列表失败，请确认已在 Supabase 执行词表 RPC 迁移");
      } finally {
        setWordsLoading(false);
      }
    },
    [selectedBanks, stageFilter, bankFilter, debouncedSearch]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [, banks, pref] = await Promise.all([
        getDailyNewWords().then((v) => {
          if (!cancelled) setDailyNew(v);
        }),
        getSelectedBanks(),
        getPronunciationPref(),
      ]);
      if (cancelled) return;
      setSelectedBanks(banks);
      setPronPref(pref);
      setAudioPref(pref);
      try {
        await loadList(banks);
      } finally {
        if (!cancelled) listInitRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
    // 仅首屏拉 family 配置后拉表；筛选依赖见下一 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!listInitRef.current) return;
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随筛选/搜索刷新
  }, [stageFilter, bankFilter, debouncedSearch]);

  useEffect(() => {
    if (!listInitRef.current) return;
    if (importTask && !importTask.active) loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importTask?.active]);

  const appendPage = useCallback(async () => {
    if (wordsLoading || words.length >= listTotal) return;
    setWordsLoading(true);
    try {
      const page = await getParentWordSummaryPage({
        selectedBanks,
        stage: stageFilter,
        bankSource: bankFilter,
        search: debouncedSearch,
        limit: PARENT_LIST_PAGE_SIZE,
        offset: words.length,
      });
      setWords((prev) => [...prev, ...page.items]);
    } catch {
      setMsg("加载更多失败");
    } finally {
      setWordsLoading(false);
    }
  }, [wordsLoading, words.length, listTotal, selectedBanks, stageFilter, bankFilter, debouncedSearch]);

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

  async function toggleBank(bankId) {
    const next = selectedBanks.includes(bankId)
      ? selectedBanks.filter((b) => b !== bankId)
      : [...selectedBanks, bankId];
    if (next.length === 0) return;
    setSelectedBanks(next);
    await updateSelectedBanks(next);
    await loadList(next);
  }

  async function handleSave() {
    if (!preview) return;
    setLoading(true);
    try {
      await saveWord(preview);
      setMsg("已保存");
      setPreview(null);
      setInput("");
      await loadList();
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
    await loadList();
  }

  function toggleWord(w) {
    const id = w.id;
    const opening = !expandedWords[id];
    setExpandedWords((prev) => ({ ...prev, [id]: opening }));

    if (opening && !w._detailLoaded && !detailFetchRef.current.has(id)) {
      detailFetchRef.current.add(id);
      setDetailLoadingId(id);
      fetchParentWordDetail(w)
        .then((full) => {
          setWords((prev) =>
            prev.map((x) => (x.id === id ? { ...full, _detailLoaded: true } : x))
          );
        })
        .catch(() => {
          setMsg("加载词卡失败");
          setExpandedWords((prev) => ({ ...prev, [id]: false }));
        })
        .finally(() => {
          detailFetchRef.current.delete(id);
          setDetailLoadingId((cur) => (cur === id ? null : cur));
        });
    }
  }

  const bankOrderIndex = useMemo(() => {
    const m = {};
    BANKS.forEach((b, i) => {
      m[b.id] = i;
    });
    return m;
  }, []);

  const bankFilterTabs = useMemo(() => {
    return [...selectedBanks].sort((a, b) => (bankOrderIndex[a] ?? 99) - (bankOrderIndex[b] ?? 99));
  }, [selectedBanks, bankOrderIndex]);

  useEffect(() => {
    if (bankFilter !== "all" && !selectedBanks.includes(bankFilter)) {
      setBankFilter("all");
    }
  }, [selectedBanks, bankFilter]);

  const stageCounts = {
    all: listStats.cntAll,
    tested: listStats.cntTested,
    untested: listStats.cntUntested,
  };
  const bankCounts = { all: listStats.cntAll, ...listStats.bankCounts };
  for (const id of selectedBanks) {
    if (bankCounts[id] === undefined) bankCounts[id] = 0;
  }

  return (
    <div className="page">
      <h1 className="page-title">家长管理</h1>

      <div className="settings-section">
        <div className="settings-row">
          <span className="settings-label">每日新词</span>
          <span className="slider-value">{dailyNew}</span>
          <div className="slider-wrap">
            <input
              ref={sliderRef}
              type="range"
              className="settings-slider"
              min={5}
              max={30}
              step={1}
              value={dailyNew}
              disabled={dailyNewSaving}
              style={{ "--slider-pct": `${((dailyNew - 5) / 25) * 100}%` }}
              onTouchStart={(e) => {
                const rect = sliderRef.current.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const pct = Math.max(0, Math.min(1, x / rect.width));
                const v = Math.round(5 + pct * 25);
                const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
                nativeSet.call(sliderRef.current, v);
                sliderRef.current.dispatchEvent(new Event("input", { bubbles: true }));
              }}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDailyNew(v);
                const hints = [
                  [5, "So Easy! 😎"],
                  [8, "热热身~"],
                  [11, "小试牛刀 💪"],
                  [14, "稳步提升中"],
                  [17, "有点厉害哦"],
                  [20, "学霸在线 🔥"],
                  [23, "卷起来了!"],
                  [26, "硬核挑战 🏋️"],
                  [29, "终极模式!"],
                  [30, "词霸诞生! 👑"],
                ];
                const hint = [...hints].reverse().find((h) => v >= h[0]);
                if (hint) {
                  setSliderHint(hint[1]);
                  setSliderHintKey((k) => k + 1);
                  clearTimeout(hintTimer.current);
                  hintTimer.current = setTimeout(() => setSliderHint(""), 1200);
                }
              }}
              onPointerUp={async () => {
                setDailyNewSaving(true);
                await updateDailyNewWords(dailyNew);
                setDailyNewSaving(false);
              }}
            />
            {sliderHint && <span className="slider-hint" key={sliderHintKey}>{sliderHint}</span>}
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-label">默认发音</span>
          <div className="pron-switch" onClick={async () => {
            const next = pronPref === "us" ? "uk" : "us";
            setPronPref(next);
            setAudioPref(next);
            await updatePronunciationPref(next);
          }}>
            <span className={`pron-option ${pronPref === "us" ? "pron-active" : ""}`}>🇺🇸 美音</span>
            <span className={`pron-option ${pronPref === "uk" ? "pron-active" : ""}`}>🇬🇧 英音</span>
          </div>
        </div>
      </div>

      <div className="bank-selector">
        <span className="bank-selector-label">出题词库</span>
        <div className="wb-categories">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="wb-category">
              <h4 className="wb-cat-title">{cat}</h4>
              <div className="wb-bank-grid">
                {BANKS.filter((b) => b.category === cat).map((bank) => (
                  <button
                    key={bank.id}
                    className={`wb-bank-card ${selectedBanks.includes(bank.id) ? "wb-selected" : ""}`}
                    onClick={() => toggleBank(bank.id)}
                  >
                    <span className="wb-bank-name">{bank.name}</span>
                    <span className="wb-bank-desc">{bank.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="combobox-wrapper">
        <div className="input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="添加到我的词库：输入单词，多个词用逗号分隔..."
            disabled={loading}
          />
        </div>
        {isBatchMode && !loading && !batchResults && (
          <p className="batch-hint">检测到 {inputWords.length} 个单词，点击查询批量导入</p>
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
        <h2>已添加的单词 ({wordsLoading && !words.length ? "加载中…" : listStats.cntAll})</h2>

        <div className="browser-toolbar">
          <input
            className="browser-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索单词（仅匹配英文词形，服务端筛选）"
          />
          <div className="browser-filter-block">
            <span className="browser-filter-label">测验进度</span>
            <div className="stage-filters">
              {STAGE_FILTERS.map((f) => (
                <button
                  type="button"
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
          <div className="browser-filter-block">
            <span className="browser-filter-label">词库来源</span>
            <div className="stage-filters">
              <button
                type="button"
                className={`stage-filter-btn ${bankFilter === "all" ? "active" : ""}`}
                onClick={() => setBankFilter("all")}
              >
                全部词库
                <span className="filter-count">{bankCounts.all ?? 0}</span>
              </button>
              {bankFilterTabs.map((bankId) => {
                const meta = BANKS.find((b) => b.id === bankId);
                const label = meta?.name ?? bankId;
                return (
                  <button
                    type="button"
                    key={bankId}
                    className={`stage-filter-btn ${bankFilter === bankId ? "active" : ""}`}
                    onClick={() => setBankFilter(bankId)}
                  >
                    {label}
                    <span className="filter-count">{bankCounts[bankId] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {wordsLoading && !words.length ? (
          <p className="browser-empty">加载中…</p>
        ) : !words.length ? (
          <p className="browser-empty">
            {listStats.cntAll === 0
              ? "还没有添加单词"
              : "没有匹配的单词"}
          </p>
        ) : (
          <>
          <div className="word-list">
            {words.map((w) => {
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
                  <div className="word-item-header" onClick={() => toggleWord(w)}>
                    <span className="word-item-arrow">{expandedWords[w.id] ? "▾" : "▸"}</span>
                    <strong className="word-item-word">{w.word}</strong>
                    <span className="phonetic">{w.phonetic}</span>
                    <span className="stage-badge" style={badgeStyle}>
                      {badgeText}
                    </span>
                    {w._source && w._source !== "custom" && (
                      <span className="word-source-tag">{w._source}</span>
                    )}
                    <span className="word-item-brief">
                      {w._detailLoaded && w.meanings?.[0]?.meaning_cn
                        ? w.meanings[0].meaning_cn.split("\n")[0]
                        : ""}
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
                      {detailLoadingId === w.id ? (
                        <p className="loading-text" style={{ padding: "12px 0", margin: 0 }}>加载词卡中…</p>
                      ) : (
                        <>
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
                          {w.meanings?.length ? (
                            w.meanings.map((m, i) => (
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
                            ))
                          ) : (
                            <p className="loading-text" style={{ padding: "8px 0", margin: 0, color: "#95a5a6" }}>暂无释义</p>
                          )}
                          {(!w._source || w._source === "custom") && (
                            <button className="btn-del" onClick={() => handleDelete(w.id)}>删除此词</button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {words.length < listTotal && (
            <button
              type="button"
              className="btn-show-more"
              disabled={wordsLoading}
              onClick={() => appendPage()}
            >
              {wordsLoading ? "加载中…" : `显示更多（还有 ${listTotal - words.length} 个）`}
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
