import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getReserveWords, getCheckins, checkinToday, getTodayTaskStatus } from "../lib/api";
import Confetti from "../components/Confetti";

export default function ChildPage() {
  const navigate = useNavigate();
  const [checkins, setCheckins] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [task, setTask] = useState(null);
  const [reserveCount, setReserveCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const refresh = useCallback(async () => {
    const [checks, tasks, reserve] = await Promise.all([
      getCheckins(30),
      getTodayTaskStatus(),
      getReserveWords(),
    ]);
    setCheckins(checks);
    setTask(tasks);
    setReserveCount(reserve.length);

    const today = new Date().toISOString().slice(0, 10);
    const alreadyChecked = checks.includes(today);
    setCheckedIn(alreadyChecked);

    if (!alreadyChecked && tasks.allDone) {
      await checkinToday();
      setCheckedIn(true);
      setShowConfetti(true);
      setCheckins(await getCheckins(30));
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const today = new Date();
  const calendarDays = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    calendarDays.push(d.toISOString().slice(0, 10));
  }

  if (!task) return <div className="page center"><p className="loading-text">加载中...</p></div>;

  const newCount = reserveCount + task.learningCount;

  return (
    <div className="page">
      {showConfetti && <Confetti />}
      <h1 className="page-title">🌟 WordPop 学习中心</h1>

      <div className="dashboard">
        <div
          className={`dash-card learn ${task.learnDone && reserveCount === 0 ? "done" : ""}`}
          onClick={() => navigate("/child/learn")}
        >
          {newCount > 0 && <span className="badge">{newCount}</span>}
          <span className="dash-icon">{task.learnDone && reserveCount === 0 ? "✅" : "📖"}</span>
          <h3>认识新单词</h3>
          <p>{newCount > 0 ? `${newCount} 个待学习` : "暂无新词"}</p>
        </div>

        <div
          className={`dash-card quiz ${task.quizDone ? "done" : ""}`}
          onClick={() => navigate("/child/quiz")}
        >
          {task.testingCount > 0 && <span className="badge">{task.testingCount}</span>}
          <span className="dash-icon">{task.quizDone ? "✅" : "🎯"}</span>
          <h3>闯关测试</h3>
          <p>{task.testingCount > 0 ? `${task.testingCount} 个待测试` : task.quizDone ? "已完成" : "暂无"}</p>
        </div>

        <div
          className={`dash-card review ${task.reviewDone ? "done" : ""}`}
          onClick={() => navigate("/child/quiz?mode=review")}
        >
          {task.reviewCount > 0 && <span className="badge">{task.reviewCount}</span>}
          <span className="dash-icon">{task.reviewDone ? "✅" : "🔄"}</span>
          <h3>复习</h3>
          <p>{task.reviewCount > 0 ? `${task.reviewCount} 个待复习` : "暂无"}</p>
        </div>
      </div>

      <div className="task-status">
        <h3>📋 今日任务</h3>
        <div className="task-list">
          <div className={`task-item ${task.learnDone && reserveCount === 0 ? "done" : ""}`}>
            <span className="task-check">{task.learnDone && reserveCount === 0 ? "✅" : "⬜"}</span>
            <span>认识新单词</span>
          </div>
          <div className={`task-item ${task.quizDone ? "done" : ""}`}>
            <span className="task-check">{task.quizDone ? "✅" : "⬜"}</span>
            <span>完成闯关测试</span>
          </div>
          <div className={`task-item ${task.reviewDone ? "done" : ""}`}>
            <span className="task-check">{task.reviewDone ? "✅" : "⬜"}</span>
            <span>完成复习任务{!task.hasReview && !task.reviewDone ? "" : ""}</span>
          </div>
        </div>
        {checkedIn ? (
          <p className="task-result success">🎉 所有任务完成，已自动打卡！</p>
        ) : (
          <p className="task-result pending">完成以上所有任务后自动打卡</p>
        )}
      </div>

      <div className="checkin-section">
        <div className="checkin-header">
          <h2>📅 打卡日历</h2>
          {checkedIn && <span className="checked-badge">今日已打卡 ✅</span>}
        </div>
        <div className="calendar">
          {calendarDays.map((day) => (
            <div
              key={day}
              className={`cal-day ${checkins.includes(day) ? "active" : ""} ${
                day === today.toISOString().slice(0, 10) ? "today" : ""
              }`}
              title={day}
            >
              <span className="cal-num">{parseInt(day.slice(8))}</span>
              {checkins.includes(day) && <span className="cal-check">✓</span>}
            </div>
          ))}
        </div>
        <p className="streak">最近30天打卡 {checkins.length} 天</p>
      </div>
    </div>
  );
}
