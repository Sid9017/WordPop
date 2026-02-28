import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithPin, getFamilyId, logout } from "../lib/family";

export default function HomePage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(!!getFamilyId());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    const familyId = await loginWithPin(pin.trim());
    if (familyId) {
      setAuthed(true);
    } else {
      setError("口令不对哦，再试试");
    }
    setLoading(false);
  }

  return (
    <div className="page center home">
      <div className="home-logo">
        <div className="logo-text">
          {"WordPop".split("").map((ch, i) => (
            <span key={i} className={`logo-letter ${i >= 4 ? "pop" : ""}`} style={{ animationDelay: `${i * 0.15}s` }}>{ch}</span>
          ))}
        </div>
        <p>让背单词变得有趣</p>
      </div>

      {!authed ? (
        <div className="pin-box">
          <h3>请输入口令</h3>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="输入口令..."
            autoFocus
            disabled={loading}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 12, width: "100%" }}
            onClick={handleLogin} disabled={loading}>
            {loading ? "登录中..." : "进入"}
          </button>
        </div>
      ) : (
        <>
          <div className="home-buttons">
            <button className="home-btn" onClick={() => navigate("/parent")}>
              <span className="btn-icon parent-icon">📖</span>
              <strong>家长入口</strong>
              <small>添加和管理单词</small>
            </button>
            <button className="home-btn" onClick={() => navigate("/child")}>
              <span className="btn-icon child-icon">🎮</span>
              <strong>学生入口</strong>
              <small>闯关和打卡</small>
            </button>
          </div>
          <button className="btn-exit" onClick={() => {
            logout();
            setAuthed(false);
            setPin("");
          }}>退出登录</button>
        </>
      )}
    </div>
  );
}
