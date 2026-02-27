import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createFamilyFromInvite, checkPinAvailable } from "../lib/family";

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pinHint, setPinHint] = useState("");

  async function handlePinBlur() {
    if (!pin.trim()) return;
    setPinHint("");
    const available = await checkPinAvailable(pin.trim());
    if (!available) setPinHint("该口令已被占用");
  }

  async function handleCreate() {
    if (!pin.trim()) { setError("请设置口令"); return; }
    setLoading(true);
    setError("");
    const res = await createFamilyFromInvite(token, pin.trim());
    if (res.error) {
      setError(res.error);
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <div className="page center home">
      <div className="home-logo">
        <span className="logo-letter">W</span>
        <h1>WordPop</h1>
      </div>

      {done ? (
        <div className="pin-box">
          <h3>创建成功！</h3>
          <p style={{ fontSize: 14, color: "#7f8c8d", margin: "12px 0" }}>
            你的口令已设置，下次用这个口令登录即可
          </p>
          <button className="btn-primary" style={{ width: "100%", marginTop: 12 }}
            onClick={() => navigate("/")}>
            开始使用
          </button>
        </div>
      ) : (
        <div className="pin-box">
          <h3>你被邀请加入 WordPop</h3>
          <p style={{ fontSize: 13, color: "#7f8c8d", margin: "12px 0" }}>
            设置一个专属口令，以后用它登录
          </p>
          <input
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinHint(""); }}
            onBlur={handlePinBlur}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="设置你的口令..."
            autoFocus
            disabled={loading}
          />
          {pinHint && <p className="error" style={{ animation: "none" }}>{pinHint}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" style={{ width: "100%", marginTop: 12 }}
            onClick={handleCreate} disabled={loading || !!pinHint}>
            {loading ? "创建中..." : "创建并开始"}
          </button>
        </div>
      )}
    </div>
  );
}
