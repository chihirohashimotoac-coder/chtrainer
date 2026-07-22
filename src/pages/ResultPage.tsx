import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatsView } from "../components/StatsView";
import { LandingScatter } from "../components/LandingScatter";
import { SpeedAccuracyChart } from "../components/SpeedAccuracyChart";
import {
  getEquipmentProfile,
  getPlayer,
  getSession,
  getStatistics,
  getThrows,
  saveSession,
} from "../db/db";
import { getBoardProfile } from "../config/boardProfiles";
import { recalcAndSaveStatistics } from "../services/sessionService";
import { speedAccuracyStats } from "../domain/speedStats";
import { buildSummaryCardBlob } from "../export/summaryCard";
import { downloadBlob } from "../export/download";
import type {
  EquipmentProfile,
  PlayerProfile,
  SessionStatistics,
  ThrowRecord,
  TrainingSession,
} from "../types/models";
import { fmtNum } from "../utils/format";
import { t } from "../i18n/ja";

export default function ResultPage() {
  const s = t();
  const { id } = useParams();
  const [session, setSession] = useState<TrainingSession>();
  const [stats, setStats] = useState<SessionStatistics>();
  const [throws, setThrows] = useState<ThrowRecord[]>([]);
  const [player, setPlayer] = useState<PlayerProfile>();
  const [equipment, setEquipment] = useState<EquipmentProfile>();
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [cardMessage, setCardMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const sess = await getSession(id);
      setSession(sess);
      setNote(sess?.sessionNote ?? "");
      const st = (await getStatistics(id)) ?? (await recalcAndSaveStatistics(id));
      setStats(st);
      setThrows(await getThrows(id));
      if (sess?.playerId) setPlayer(await getPlayer(sess.playerId));
      if (sess?.equipmentProfileId) {
        setEquipment(await getEquipmentProfile(sess.equipmentProfileId));
      }
    })();
  }, [id]);

  const profile = useMemo(
    () => (session ? getBoardProfile(session.boardProfileId) : undefined),
    [session]
  );
  const speed = useMemo(() => speedAccuracyStats(throws), [throws]);

  if (!session || !stats || !profile) return <p>{s.common.loading}</p>;

  const saveCard = async () => {
    setCardMessage("");
    try {
      const blob = await buildSummaryCardBlob({ session, stats, player, equipment });
      if (!blob) {
        setCardMessage(s.errors.downloadFailed);
        return;
      }
      const fileName = `darts-summary-${session.startedAt.slice(0, 10)}.png`;
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      const file = new File([blob], fileName, { type: "image/png" });
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], title: s.card.title });
          return;
        } catch {
          // 共有をキャンセル/失敗した場合はダウンロードにフォールバック
        }
      }
      downloadBlob(blob, fileName);
      setCardMessage(s.common.download + ": OK");
    } catch {
      setCardMessage(s.errors.downloadFailed);
    }
  };

  return (
    <div>
      <h1>{s.result.title}</h1>
      <StatsView stats={stats} session={session} />

      <h2>{s.scatter.title}</h2>
      <p className="muted small">{s.scatter.lead}</p>
      <LandingScatter throws={throws} profile={profile} />

      <h2>{s.speed.title}</h2>
      {speed.sampleCount < 3 ? (
        <p className="muted small">{s.speed.insufficient}</p>
      ) : (
        <div className="card">
          <p className="muted small">{s.speed.lead}</p>
          <div className="list-row">
            <span className="muted">{s.speed.sample}</span>
            <strong>{speed.sampleCount}</strong>
          </div>
          <div className="list-row">
            <span className="muted">{s.speed.correlation}</span>
            <strong>{fmtNum(speed.correlation, 2)}</strong>
          </div>
          <p className="muted small">
            {speed.correlation == null
              ? s.speed.naNote
              : speed.correlation > 0.2
                ? s.speed.posNote
                : speed.correlation < -0.2
                  ? s.speed.negNote
                  : s.speed.flatNote}
          </p>
          <SpeedAccuracyChart data={speed} />
        </div>
      )}

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
          <button className="btn" onClick={() => void saveCard()}>
            {s.card.save}
          </button>
          <Link className="btn" to={`/session/${session.id}/throws`}>
            {s.result.viewThrows}
          </Link>
          <Link className="btn" to={`/session/${session.id}/compare`}>
            {s.result.compare}
          </Link>
        </div>
        {cardMessage && <p className="ok-text small">{cardMessage}</p>}
      </div>
    </div>
  );
}
