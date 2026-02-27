import { useState, useEffect, useCallback } from "react";
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

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const calendarDays = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    calendarDays.push(d.toISOString().slice(0, 10));
  }

  if (loading) return <div className="page center"><p className="loading-text">加载中...</p></div>;

  return (
    <div className="page center">
      {showConfetti && <Confetti />}
      <h1 className="page-title">WordPop</h1>
      <p className="child-subtitle">点击今天开始闯关</p>

      <div className="checkin-section">
        <div className="calendar">
          {calendarDays.map((day) => {
            const isToday = day === todayStr;
            const isDone = checkins.includes(day);
            return (
              <div
                key={day}
                className={`cal-day ${isDone ? "active" : ""} ${isToday ? "today" : ""} ${isToday ? "clickable" : ""}`}
                title={day}
                onClick={() => {
                  if (isToday && quizDone) navigate("/child/quiz?extra=1");
                  else if (isToday) navigate("/child/quiz");
                }}
              >
                <span className="cal-num">{parseInt(day.slice(8))}</span>
                {isDone && <span className="cal-check">✓</span>}
                {isToday && quizDone && <span className="cal-tooltip">多背几个</span>}
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
