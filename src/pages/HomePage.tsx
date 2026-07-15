import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { useSetup } from "../state/SetupContext";
import { getSessions, getStatistics } from "../db/db";
import { finishSession } from "../services/sessionService";
import type { TrainingSession } from "../types/models";
import { fmtDateTime, fmtRate } from "../utils/format";
import { modeLabel } from "../export/markdown";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { t } from "../i18n/ja";

export default function HomePage() {
  const s = t();
  const { loading, settings, activeSession, refresh } = useApp();
  const { reset } = useSetup();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<
    { session: TrainingSession; hitRate?: number }[]
  >([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    void (async () => {
      const sessions = (await getSessions())
        .filter((x) => x.status !== "active")
        .slice(0, 5);
      const withStats = await Promise.all(
        sessions.map(async (session) => ({
          session,
          hitRate: (await getStatistics(session.id))?.exactHitRate,
        }))
      );
      setRecent(withStats);
    })();
  }, [activeSession]);

  if (loading) return <p>{s.common.loading}</p>;

  const needsSetup = !settings?.onboardingCompleted;

  return (
    <div>
      <div className="top-bar">
        <h1>{s.appName}</h1>
      </div>

      {needsSetup ? (
        <div className="card">
          <p>{s.home.setupRequired}</p>
          <Link className="btn primary block" to="/setup">
            {s.home.goSetup}
          </Link>
        </div>
      ) : (
        <>
          {activeSession && (
            <div className="card">
              <p>{s.home.resumeDescription}</p>
              <p className="muted small">
                {fmtDateTime(activeSession.startedAt)} /{" "}
                {modeLabel(activeSession.trainingMode)} /{" "}
                {activeSession.setCount}
                {s.sets.setsUnit}
              </p>
              <button
                className="btn primary block"
                onClick={() => navigate("/train/session")}
              >
                {s.home.resumeSession}
              </button>
              <button
                className="btn danger block"
                onClick={() => setConfirmDiscard(true)}
              >
                {s.home.discardSession}
              </button>
            </div>
          )}
          {!activeSession && (
            <button
              className="btn primary block"
              style={{ minHeight: 64, fontSize: "1.15rem" }}
              onClick={() => {
                reset();
                navigate("/train/mode");
              }}
            >
              {s.home.startTraining}
            </button>
          )}

          <h2>{s.home.recentSessions}</h2>
          {recent.length === 0 && <p className="muted">{s.home.noSessions}</p>}
          {recent.map(({ session, hitRate }) => (
            <Link
              key={session.id}
              to={`/session/${session.id}`}
              className="card selectable"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div className="list-row">
                <strong>{modeLabel(session.trainingMode)}</strong>
                <span className={`badge${session.status === "completed" ? " ok" : ""}`}>
                  {session.status === "completed"
                    ? s.sessions.completed
                    : s.sessions.aborted}
                </span>
              </div>
              <div className="muted small">
                {fmtDateTime(session.startedAt)} / {session.setCount}
                {s.sets.setsUnit} / {s.sessions.hitRate}{" "}
                {hitRate != null ? fmtRate(hitRate) : "N/A"}
              </div>
            </Link>
          ))}
        </>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title={s.home.discardSession}
        danger
        confirmLabel={s.common.ok}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={async () => {
          if (activeSession) {
            await finishSession(activeSession, "aborted");
            await refresh();
          }
          setConfirmDiscard(false);
        }}
      >
        <p className="muted">{s.throwing.abortConfirm}</p>
      </ConfirmDialog>
    </div>
  );
}
