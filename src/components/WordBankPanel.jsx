import { useState } from "react";

const BANKS = [
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

const CATEGORIES = ["剑桥体系", "大学英语", "留学考试", "商务职场"];

export default function WordBankPanel({ onImport, existingWords, onClose }) {
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankData, setBankData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const existingSet = new Set((existingWords || []).map((w) => w.word?.toLowerCase()));

  async function handleSelectBank(bank) {
    setSelectedBank(bank);
    setLoading(true);
    setSearch("");
    try {
      const res = await fetch(`/data/word-banks/${bank.id}.json`);
      const data = await res.json();
      setBankData(data);
    } catch {
      setBankData(null);
    }
    setLoading(false);
  }

  function handleImportAll() {
    if (!bankData) return;
    const newWords = bankData.words.filter(
      (w) => !existingSet.has(w.word.toLowerCase())
    );
    if (!newWords.length) {
      alert("该词库的所有单词已存在，无需导入");
      return;
    }
    onImport(newWords);
    onClose();
  }

  const filteredWords = bankData
    ? bankData.words.filter((w) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          w.word.toLowerCase().includes(q) ||
          w.meanings?.some((m) => m.meaning_cn?.includes(q))
        );
      })
    : [];

  const newCount = bankData
    ? bankData.words.filter((w) => !existingSet.has(w.word.toLowerCase())).length
    : 0;

  if (selectedBank && bankData) {
    return (
      <div className="wb-panel">
        <div className="wb-panel-header">
          <button className="wb-back-btn" onClick={() => { setSelectedBank(null); setBankData(null); }}>
            ← 返回
          </button>
          <h3>{selectedBank.name}</h3>
          <span className="wb-count">{bankData.wordCount} 词</span>
        </div>

        <div className="wb-actions">
          <input
            className="wb-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索词库中的单词..."
          />
          <button className="btn-primary wb-import-btn" onClick={handleImportAll}>
            导入新词 ({newCount})
          </button>
        </div>

        <div className="wb-word-list">
          {filteredWords.slice(0, 100).map((w) => {
            const exists = existingSet.has(w.word.toLowerCase());
            return (
              <div key={w.word} className={`wb-word-item ${exists ? "wb-exists" : ""}`}>
                <span className="wb-word">{w.word}</span>
                <span className="wb-phonetic">{w.usPhonetic || w.ukPhonetic}</span>
                <span className="wb-meaning">{w.meanings?.[0]?.meaning_cn?.split("\n")[0] || ""}</span>
                {exists && <span className="wb-tag-exists">已添加</span>}
              </div>
            );
          })}
          {filteredWords.length > 100 && (
            <p className="wb-more">还有 {filteredWords.length - 100} 个词未显示，使用搜索查看</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wb-panel">
      <div className="wb-panel-header">
        <h3>选择词库</h3>
        <button className="wb-close-btn" onClick={onClose}>✕</button>
      </div>
      {loading ? (
        <p className="wb-loading">加载中...</p>
      ) : (
        <div className="wb-categories">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="wb-category">
              <h4 className="wb-cat-title">{cat}</h4>
              <div className="wb-bank-grid">
                {BANKS.filter((b) => b.category === cat).map((bank) => (
                  <button
                    key={bank.id}
                    className="wb-bank-card"
                    onClick={() => handleSelectBank(bank)}
                  >
                    <span className="wb-bank-name">{bank.name}</span>
                    <span className="wb-bank-desc">{bank.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
