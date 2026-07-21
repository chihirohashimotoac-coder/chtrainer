import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatsView } from "../components/StatsView";
import { deleteSessionCascade, getSession, getStatistics } from "../db/db";
import { modeLabel } from "../export/markdown";
import {
  recalcAndSaveStatistics,
  reopenSession,
} from "../services/sessionService";
import { useApp } from "../state/AppContext";
import type { SessionStatistics, TrainingSession } from "../types/models";
import { fmtDateTime } from "../utils/format";
import { t } from "../i18n/ja";

export default function SessionDetailPage() {
  const s = t();
  const { id } = useParams();
  const navigate = useNavigate();
  const { equipmentProfiles, activeSession, refresh } = useApp();
  const [session, setSession] = useState<TrainingSession>();
  const [stats, setStats] = useState<SessionStatistics>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setSession(await getSession(id));
      const st = (await getStatistics(id)) ?? (await recalcAndSaveStatistics(id));
      setStats(st);
    })();
  }, [id]);

  if (!session) return <p>{s.common.loading}</p>;

  const equipment = equipmentProfiles.find(
    (e) => e.id === session.equipmentProfileId
  );

  return (
    <div>
      <h1>{s.sessions.detail}</h1>
      <div className="card">
        <div className="list-row">
          <span className="muted">{s.sessions.date}</span>
          <strong>{fmtDateTime(session.startedAt)}</strong>
        </div>
        <div className="list-row">
          <span className="muted">{s.sessions.mode}</span>
          <strong>{modeLabel(session.trainingMode)}</strong>
        </div>
        <div className="list-row">
          <span className="muted">{s.sessions.board}</span>
          <strong>
            {session.boardType === "steel" ? s.player.steel : s.player.soft}
          </strong>
        </div>
        {session.scoringStyle && (
          <div className="list-row">
            <span className="muted">{s.preSession.scoringStyle}</span>
            <strong>{s.preSession.scoringStyles[session.scoringStyle]}</strong>
          </div>
        )}
        <div className="list-row">
          <span className="muted">{s.sessions.equipment}</span>
          <strong>{equipment?.name ?? s.common.none}</strong>
        </div>
        <div className="list-row">
          <span className="muted">{s.sessions.status}</span>
          <strong>
            {session.status === "completed"
              ? s.sessions.completed
              : session.status === "aborted"
                ? s.sessions.aborted
                : s.sessions.active}
          </strong>
        </div>
        {session.status !== "completed" && stats && (
          <div className="list-row">
            <span className="muted">{s.sessions.progress}</span>
            <strong>
              {stats.completedThrows}/{session.plannedThrowCount}
              {s.sets.throwsUnit}
              {session.plannedThrowCount > 0
                ? ` (${((stats.completedThrows / session.plannedThrowCount) * 100).toFixed(1)}%)`
                : ""}
            </strong>
          </div>
        )}
      </div>

      {stats && <StatsView stats={stats} />}

      <div className="action-bar">
        {session.status === "aborted" && (
          <>
            <button
              className="btn primary block"
              onClick={async () => {
                if (activeSession) {
                  alert(s.sessions.resumeBlocked);
                  return;
                }
                try {
                  await reopenSession(session);
                  await refresh();
                  navigate("/train/session");
                } catch {
                  alert(s.errors.dbSaveFailed);
                }
              }}
            >
              {s.sessions.resumeAborted}
            </button>
            <p className="muted small" style={{ textAlign: "center", margin: "0.2rem 0 0.6rem" }}>
              {s.sessions.resumeAbortedDesc}
            </p>
          </>
        )}
        <Link className="btn primary block" to={`/session/${session.id}/export`}>
          {s.result.exportAI}
        </Link>
        <div className="btn-row">
          <Link className="btn" to={`/session/${session.id}/throws`}>
            {s.result.viewThrows}
          </Link>
          <Link className="btn" to={`/session/${session.id}/compare`}>
            {s.result.compare}
          </Link>
        </div>
        <button className="btn danger block" onClick={() => setConfirmDelete(true)}>
          {s.common.delete}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={s.common.delete}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (id) await deleteSessionCascade(id);
          navigate("/history", { replace: true });
        }}
      >
        <p>{s.sessions.deleteConfirm}</p>
      </ConfirmDialog>
    </div>
  );
}
