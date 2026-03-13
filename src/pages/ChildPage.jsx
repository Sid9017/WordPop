import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCheckins, checkinToday, getTodayQuizDone } from "../lib/api";
import Confetti from "../components/Confetti";

export default function ChildPage() {
  const navigate = useNavigate();
  const [checkins, setCheckins] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBubble, setShowBubble] = useState(false);
  const drawerRef = useRef(null);
  const todayCellRef = useRef(null);

  const refresh = useCallback(async () => {
    const [checks, done] = await Promise.all([
      getCheckins(30),
      getTodayQuizDone(),
    ]);
    setCheckins(checks);
    setQuizDone(done);

    const today = new Date().toISOString().slice(0, 10);
    const alreadyChecked = checks.includes(today);
    setCheckedIn(alreadyChecked);

    if (!alreadyChecked && done) {
      await checkinToday();
      setCheckedIn(true);
      setShowConfetti(true);
      setCheckins(await getCheckins(30));
      setTimeout(() => setShowConfetti(false), 4000);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!showBubble) return;
    function handleClick(e) {
      if (drawerRef.current?.contains(e.target)) return;
      if (todayCellRef.current?.contains(e.target)) return;
      setShowBubble(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBubble]);

  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = viewDate.getDay();

  const calendarDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(viewYear, viewMonth, d);
    calendarDays.push(dt.toISOString().slice(0, 10));
  }

  const isCurrentMonth = monthOffset === 0;
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = MONTH_NAMES[viewMonth];

  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

  let daysBeforeDrawer = calendarDays;
  let daysAfterDrawer = [];
  if (isCurrentMonth) {
    const todayDate = today.getDate();
    const todayGridPos = firstDow + todayDate - 1;
    const todayRow = Math.floor(todayGridPos / 7);
    const rowEndDay = Math.min((todayRow + 1) * 7 - firstDow, daysInMonth);
    daysBeforeDrawer = calendarDays.slice(0, rowEndDay);
    daysAfterDrawer = calendarDays.slice(rowEndDay);
  }

  const renderDay = (day) => {
    const isToday = day === todayStr;
    const isDone = checkins.includes(day);
    const isFuture = day > todayStr;
    return (
      <div
        key={day}
        ref={isToday ? todayCellRef : undefined}
        className={`cal-day ${isDone ? "active" : ""} ${isToday ? "today clickable" : ""} ${isFuture ? "cal-future" : ""}`}
        title={day}
        onClick={() => { if (isToday) setShowBubble(prev => !prev); }}
      >
        <span className="cal-num">{parseInt(day.slice(8))}</span>
        {isDone && <span className="cal-check">✓</span>}
      </div>
    );
  };

  if (loading) return <div className="page center"><p className="loading-text">加载中...</p></div>;

  return (
    <div className="page center">
      {showConfetti && <Confetti />}
      <h1 className="page-title">WordPop</h1>
      <p className="child-subtitle">点击今天开始闯关</p>

      <div className="checkin-section">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => setMonthOffset((o) => o - 1)}>‹</button>
          <span className="cal-month-label">{monthLabel}</span>
          <button className="cal-nav-btn" onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))} disabled={isCurrentMonth}>›</button>
        </div>
        <div className="calendar">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">{w}</div>
          ))}
          {Array.from({ length: firstDow }, (_, i) => (
            <div key={`blank-${i}`} className="cal-day cal-blank" />
          ))}
          {daysBeforeDrawer.map(renderDay)}
          {isCurrentMonth && (
            <div className={`cal-drawer-row ${showBubble ? "open" : ""}`} ref={drawerRef}>
              <div className="drawer-row-content">
                {quizDone && (
                  <p className="drawer-hint">今天已完成一轮学习 🎉 要再多学一点吗？</p>
                )}
                <div className="drawer-buttons">
                  <button className="drawer-btn drawer-btn-learn"
                    onClick={() => { setShowBubble(false); navigate(quizDone ? "/child/learn?extra=1" : "/child/learn"); }}>
                    📖 学学
                  </button>
                  <button className="drawer-btn drawer-btn-quiz"
                    onClick={() => { setShowBubble(false); navigate(quizDone ? "/child/quiz?extra=1" : "/child/quiz"); }}>
                    ✏️ 测测
                  </button>
                </div>
              </div>
            </div>
          )}
          {daysAfterDrawer.map(renderDay)}
        </div>
        <p className="streak">
          最近30天打卡 {checkins.length} 天
          {checkedIn && <span className="checked-inline"> · 今日已完成</span>}
        </p>
      </div>
    </div>
  );
}
