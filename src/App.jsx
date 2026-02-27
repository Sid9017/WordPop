import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { getFamilyId } from "./lib/family";
import HomePage from "./pages/HomePage";
import ParentPage from "./pages/ParentPage";
import ChildPage from "./pages/ChildPage";
import LearnPage from "./pages/LearnPage";
import QuizPage from "./pages/QuizPage";
import InvitePage from "./pages/InvitePage";

function RequireFamily({ children }) {
  if (!getFamilyId()) return <Navigate to="/" replace />;
  return children;
}

function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  if (location.pathname === "/") return null;

  const parentPath = location.pathname.includes("/child/")
    ? "/child"
    : "/";

  return (
    <button className="back-btn" onClick={() => navigate(parentPath)}>
      ← 返回
    </button>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <BackButton />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/parent" element={<RequireFamily><ParentPage /></RequireFamily>} />
          <Route path="/child" element={<RequireFamily><ChildPage /></RequireFamily>} />
          <Route path="/child/learn" element={<RequireFamily><LearnPage /></RequireFamily>} />
          <Route path="/child/quiz" element={<RequireFamily><QuizPage /></RequireFamily>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
