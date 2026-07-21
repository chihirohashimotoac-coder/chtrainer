import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatsView } from "../components/StatsView";
import { getSession, getStatistics, saveSession } from "../db/db";
import { recalcAndSaveStatistics } from "../services/sessionService";
import type { SessionStatistics, TrainingSession } from "../types/models";
import { t } from "../i18n/ja";

export default function ResultPage() {
  const s = t();
  const { id } = useParams();
  const [session, setSession] = useState<TrainingSession>();
  const [stats, setStats] = useState<SessionStatistics>();
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const sess = await getSession(id);
      setSession(sess);
      setNote(sess?.sessionNote ?? "");
      const st = (await getStatistics(id)) ?? (await recalcAndSaveStatistics(id));
      setStats(st);
    })();
  }, [id]);

  if (!session || !stats) return <p>{s.common.loading}</p>;

  return (
    <div>
      <h1>{s.result.title}</h1>
      <StatsView stats={stats} session={session} />

      <h2>{s.result.sessionNote}</h2>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setNoteSaved(false);
        }}
        onBlur={async () => {
          if (session.sessionNote === note) return;
          await saveSession({ ...session, sessionNote: note || undefined });
          setSession({ ...session, sessionNote: note || undefined });
          setNoteSaved(true);
        }}
      />
      {noteSaved && <p className="ok-text small">{s.common.save}: OK</p>}

      <div className="action-bar">
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
      </div>
    </div>
  );
}
