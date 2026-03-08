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
  const bubbleRef = useRef(null);

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
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) setShowBubble(false);
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
          {calendarDays.map((day) => {
            const isToday = day === todayStr;
            const isDone = checkins.includes(day);
            const isFuture = day > todayStr;
            return (
              <div
                key={day}
                ref={isToday ? bubbleRef : undefined}
                className={`cal-day ${isDone ? "active" : ""} ${isToday ? "today" : ""} ${isToday ? "clickable" : ""} ${isFuture ? "cal-future" : ""} ${isToday && showBubble ? "today-open" : ""}`}
                title={day}
                onClick={() => { if (isToday && !showBubble) setShowBubble(true); }}
              >
                {isToday && showBubble ? (
                  <>
                    <button
                      className="bb bb-learn"
                      onClick={(e) => { e.stopPropagation(); setShowBubble(false); navigate(quizDone ? "/child/learn?extra=1" : "/child/learn"); }}
                    >学学</button>
                    <button
                      className="bb bb-quiz"
                      onClick={(e) => { e.stopPropagation(); setShowBubble(false); navigate(quizDone ? "/child/quiz?extra=1" : "/child/quiz"); }}
                    >测测</button>
                  </>
                ) : (
                  <>
                    <span className="cal-num">{parseInt(day.slice(8))}</span>
                    {isDone && <span className="cal-check">✓</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="streak">
          最近30天打卡 {checkins.length} 天
          {checkedIn && <span className="checked-inline"> · 今日已完成</span>}
        </p>
      </div>
    </div>
  );
}
