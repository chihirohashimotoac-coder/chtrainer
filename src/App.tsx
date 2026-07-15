import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./state/AppContext";
import { SetupProvider } from "./state/SetupContext";
import { onUpdateAvailable } from "./pwa/register";
import { t } from "./i18n/ja";
import HomePage from "./pages/HomePage";
import OnboardingPage from "./pages/OnboardingPage";
import PlayerSettingsPage from "./pages/PlayerSettingsPage";
import EquipmentListPage from "./pages/EquipmentListPage";
import EquipmentEditPage from "./pages/EquipmentEditPage";
import ModeSelectPage from "./pages/ModeSelectPage";
import TargetSelectPage from "./pages/TargetSelectPage";
import SetCountPage from "./pages/SetCountPage";
import PreSessionPage from "./pages/PreSessionPage";
import SessionPage from "./pages/SessionPage";
import ResultPage from "./pages/ResultPage";
import ThrowsPage from "./pages/ThrowsPage";
import SessionsPage from "./pages/SessionsPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import ComparePage from "./pages/ComparePage";
import ExportPage from "./pages/ExportPage";
import BackupPage from "./pages/BackupPage";
import AppSettingsPage from "./pages/AppSettingsPage";
import AboutPage from "./pages/AboutPage";

function UpdateBanner() {
  const [apply, setApply] = useState<(() => void) | undefined>();
  useEffect(() => {
    onUpdateAvailable((fn) => setApply(() => fn));
  }, []);
  if (!apply) return null;
  const s = t();
  return (
    <div className="update-banner" role="status">
      <span>{s.appSettings.updateAvailable}</span>
      <button className="btn small primary" onClick={() => apply()}>
        {s.appSettings.updateNow}
      </button>
      <button
        className="btn small"
        onClick={() => setApply(undefined)}
        aria-label={s.common.close}
      >
        ✕
      </button>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const s = t();
  const inSession = location.pathname.startsWith("/train/session");
  return (
    <AppProvider>
      <SetupProvider>
        <UpdateBanner />
        <main className={`app-main${inSession ? " no-nav" : ""}`}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/setup" element={<OnboardingPage />} />
            <Route path="/settings" element={<AppSettingsPage />} />
            <Route path="/settings/player" element={<PlayerSettingsPage />} />
            <Route path="/settings/equipment" element={<EquipmentListPage />} />
            <Route
              path="/settings/equipment/:id"
              element={<EquipmentEditPage />}
            />
            <Route path="/settings/backup" element={<BackupPage />} />
            <Route path="/train/mode" element={<ModeSelectPage />} />
            <Route path="/train/targets" element={<TargetSelectPage />} />
            <Route path="/train/sets" element={<SetCountPage />} />
            <Route path="/train/pre" element={<PreSessionPage />} />
            <Route path="/train/session" element={<SessionPage />} />
            <Route path="/history" element={<SessionsPage />} />
            <Route path="/session/:id" element={<SessionDetailPage />} />
            <Route path="/session/:id/result" element={<ResultPage />} />
            <Route path="/session/:id/throws" element={<ThrowsPage />} />
            <Route path="/session/:id/compare" element={<ComparePage />} />
            <Route path="/session/:id/export" element={<ExportPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        {!inSession && (
          <nav className="bottom-nav" aria-label="メインナビゲーション">
            <NavLink to="/" end>
              <span className="icon" aria-hidden>
                🎯
              </span>
              {s.nav.home}
            </NavLink>
            <NavLink to="/history">
              <span className="icon" aria-hidden>
                📋
              </span>
              {s.nav.history}
            </NavLink>
            <NavLink to="/settings">
              <span className="icon" aria-hidden>
                ⚙️
              </span>
              {s.nav.settings}
            </NavLink>
            <NavLink to="/about">
              <span className="icon" aria-hidden>
                ℹ️
              </span>
              {s.nav.about}
            </NavLink>
          </nav>
        )}
      </SetupProvider>
    </AppProvider>
  );
}
