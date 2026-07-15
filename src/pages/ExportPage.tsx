import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getEquipmentProfile,
  getPlayer,
  getSession,
  getSessions,
  getStatistics,
  getThrows,
  getThrowSets,
} from "../db/db";
import { rankComparisonCandidates } from "../domain/compare";
import { buildSessionCsv, csvToBlob } from "../export/csv";
import { copyToClipboard, downloadBlob, downloadText, timestampForFilename } from "../export/download";
import { buildAnalysisMarkdown, modeLabel } from "../export/markdown";
import { recalcAndSaveStatistics } from "../services/sessionService";
import type {
  EquipmentProfile,
  PlayerProfile,
  SessionStatistics,
  ThrowRecord,
  ThrowSet,
  TrainingSession,
} from "../types/models";
import { fmtDateTime } from "../utils/format";
import { t } from "../i18n/ja";

export default function ExportPage() {
  const s = t();
  const { id } = useParams();
  const [session, setSession] = useState<TrainingSession>();
  const [player, setPlayer] = useState<PlayerProfile>();
  const [equipment, setEquipment] = useState<EquipmentProfile>();
  const [stats, setStats] = useState<SessionStatistics>();
  const [throws, setThrows] = useState<ThrowRecord[]>([]);
  const [sets, setSets] = useState<ThrowSet[]>([]);
  const [candidates, setCandidates] = useState<TrainingSession[]>([]);
  const [candidateStats, setCandidateStats] = useState<
    Record<string, SessionStatistics>
  >({});
  const [selectedCompare, setSelectedCompare] = useState<string[]>([]);
  const [embedAll, setEmbedAll] = useState(true);
  const [markdown, setMarkdown] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const sess = await getSession(id);
      if (!sess) return;
      setSession(sess);
      setPlayer(await getPlayer(sess.playerId));
      if (sess.equipmentProfileId) {
        setEquipment(await getEquipmentProfile(sess.equipmentProfileId));
      }
      setStats(
        (await getStatistics(id)) ?? (await recalcAndSaveStatistics(id))
      );
      setThrows(await getThrows(id));
      setSets(await getThrowSets(id));
      const others = (await getSessions()).filter(
        (x) => x.id !== id && x.status !== "active"
      );
      const ranked = rankComparisonCandidates(sess, others).slice(0, 8);
      setCandidates(ranked.map((r) => r.session));
      const map: Record<string, SessionStatistics> = {};
      await Promise.all(
        ranked.map(async (r) => {
          const st = await getStatistics(r.session.id);
          if (st) map[r.session.id] = st;
        })
      );
      setCandidateStats(map);
    })();
  }, [id]);

  const setNumberOf = useMemo(() => {
    const map = new Map(sets.map((x) => [x.id, x.setNumber]));
    return (setId: string) => map.get(setId);
  }, [sets]);

  if (!session || !stats) return <p>{s.common.loading}</p>;

  const generate = () => {
    try {
      const comparisons = selectedCompare
        .map((cid) => {
          const cand = candidates.find((x) => x.id === cid);
          const st = candidateStats[cid];
          return cand && st ? { session: cand, stats: st } : null;
        })
        .filter((x): x is { session: TrainingSession; stats: SessionStatistics } => x != null);
      const md = buildAnalysisMarkdown({
        session,
        player,
        equipment,
        stats,
        throws,
        setNumberOf,
        comparisons,
        embedAllThrows: embedAll,
      });
      setMarkdown(md);
      setMessage("");
    } catch {
      setMessage(s.errors.genericError);
    }
  };

  const baseName = `darts-${timestampForFilename(session.startedAt)}`;

  return (
    <div>
      <h1>{s.export.title}</h1>
      <p className="muted small">{s.export.usage}</p>

      <fieldset>
        <legend>{s.export.format}</legend>
        <div className="choice-row">
          <button
            className={`choice${embedAll ? " selected" : ""}`}
            onClick={() => setEmbedAll(true)}
            aria-pressed={embedAll}
          >
            {s.export.fullEmbed}
          </button>
          <button
            className={`choice${!embedAll ? " selected" : ""}`}
            onClick={() => setEmbedAll(false)}
            aria-pressed={!embedAll}
          >
            {s.export.summaryCsv}
          </button>
        </div>
        <p className="muted small">
          {embedAll ? s.export.fullEmbedDesc : s.export.summaryCsvDesc}
        </p>
      </fieldset>

      <h2>{s.export.compareTargets}</h2>
      {candidates.length === 0 && <p className="muted">{s.sessions.empty}</p>}
      {candidates.map((cand) => {
        const isSelected = selectedCompare.includes(cand.id);
        const hasStats = candidateStats[cand.id] != null;
        return (
          <button
            key={cand.id}
            className={`card selectable${isSelected ? " selected" : ""}`}
            style={{ display: "block", width: "100%", textAlign: "left" }}
            disabled={!hasStats}
            onClick={() =>
              setSelectedCompare((prev) =>
                isSelected
                  ? prev.filter((x) => x !== cand.id)
                  : [...prev, cand.id]
              )
            }
            aria-pressed={isSelected}
          >
            <strong>{modeLabel(cand.trainingMode)}</strong>{" "}
            <span className="muted small">{fmtDateTime(cand.startedAt)}</span>
          </button>
        );
      })}

      <div className="action-bar">
        <button className="btn primary block" onClick={generate}>
          {s.export.generate}
        </button>
      </div>

      {message && <p className="error-text">{message}</p>}

      {markdown && (
        <>
          <div className="btn-row">
            <button
              className="btn"
              onClick={async () => {
                const ok = await copyToClipboard(markdown);
                setMessage(ok ? s.common.copied : s.errors.copyFailed);
              }}
            >
              {s.export.copyMarkdown}
            </button>
            <button
              className="btn"
              onClick={() => {
                try {
                  downloadText(markdown, `${baseName}.md`, "text/markdown;charset=utf-8");
                } catch {
                  setMessage(s.errors.downloadFailed);
                }
              }}
            >
              {s.export.saveMd}
            </button>
            <button
              className="btn"
              onClick={() => {
                try {
                  const csv = buildSessionCsv(session, throws, setNumberOf);
                  downloadBlob(csvToBlob(csv), `${baseName}.csv`);
                } catch {
                  setMessage(s.errors.csvFailed);
                }
              }}
            >
              {s.export.saveCsv}
            </button>
          </div>
          {message && <p className="ok-text small">{message}</p>}
          <h2>{s.export.preview}</h2>
          <div className="markdown-preview">{markdown}</div>
        </>
      )}
    </div>
  );
}
