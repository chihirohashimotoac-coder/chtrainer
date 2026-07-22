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
import { AI_PROVIDERS } from "../export/aiLinks";
import { buildAnalysisZip } from "../export/zip";
import { MAX_EMBEDDED_MARKDOWN_CHARS } from "../config/constants";
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
  const [recentSessions, setRecentSessions] = useState<
    { session: TrainingSession; stats: SessionStatistics }[]
  >([]);
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
      // 長期トレンド: 同モードの直近セッション(最大10件・古い順)
      const sameMode = others
        .filter((x) => x.trainingMode === sess.trainingMode)
        .slice(0, 10)
        .reverse();
      const trend: { session: TrainingSession; stats: SessionStatistics }[] = [];
      for (const x of sameMode) {
        const st =
          (await getStatistics(x.id)) ?? (await recalcAndSaveStatistics(x.id));
        if (st) trend.push({ session: x, stats: st });
      }
      setRecentSessions(trend);
      const ranked = rankComparisonCandidates(sess, others).slice(0, 8);
      setCandidates(ranked.map((r) => r.session));
      const map: Record<string, SessionStatistics> = {};
      await Promise.all(
        ranked.map(async (r) => {
          const st =
            (await getStatistics(r.session.id)) ??
            (await recalcAndSaveStatistics(r.session.id));
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
        recentSessions,
        embedAllThrows: embedAll,
      });
      setMarkdown(md);
      setMessage("");
    } catch {
      setMessage(s.errors.genericError);
    }
  };

  const baseName = `darts-${timestampForFilename(session.startedAt)}`;
  // 実際の生成処理(buildAnalysisMarkdown)そのものでプレビュー文字数を算出する。
  // 生成は純粋関数なので、形式・比較対象の変更に即時追随し予測誤差が出ない。
  const previewChars = (() => {
    try {
      const comparisons = selectedCompare
        .map((cid) => {
          const cand = candidates.find((x) => x.id === cid);
          const st = candidateStats[cid];
          return cand && st ? { session: cand, stats: st } : null;
        })
        .filter((x): x is { session: TrainingSession; stats: SessionStatistics } => x != null);
      return buildAnalysisMarkdown({
        session,
        player,
        equipment,
        stats,
        throws,
        setNumberOf,
        comparisons,
        recentSessions,
        embedAllThrows: embedAll,
      }).length;
    } catch {
      return undefined;
    }
  })();
  const recommendAttachment =
    embedAll && previewChars != null && previewChars > MAX_EMBEDDED_MARKDOWN_CHARS;

  return (
    <div>
      <h1>{s.export.title}</h1>
      <p className="muted small">{s.export.usage}</p>
      {previewChars != null && (
        <p className="muted small">
          この形式で生成されるテキスト: {previewChars.toLocaleString()}文字 / 概算トークン数（参考値）: {Math.ceil(previewChars / 4).toLocaleString()}
        </p>
      )}
      {recommendAttachment && (
        <div className="info-box">
          全投擲埋め込みは{previewChars.toLocaleString()}文字になります。「集計＋CSV別添」を推奨します。
        </div>
      )}

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
          <p className="muted small">
            {markdown.length.toLocaleString()}文字 / 概算トークン数（参考値）: {Math.ceil(markdown.length / 4).toLocaleString()}
            {markdown.length > MAX_EMBEDDED_MARKDOWN_CHARS && " — 集計＋CSV別添を推奨します。"}
          </p>
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
            <button
              className="btn"
              onClick={async () => {
                try {
                  const csv = buildSessionCsv(session, throws, setNumberOf);
                  const zip = await buildAnalysisZip(markdown, csv, session);
                  downloadBlob(zip, `${baseName}.zip`);
                } catch {
                  setMessage(s.errors.downloadFailed);
                }
              }}
            >
              Markdown＋CSVをZIP保存
            </button>
          </div>
          {message && <p className="ok-text small">{message}</p>}

          <h2>{s.export.openInAi}</h2>
          <p className="muted small">{s.export.openInAiHint}</p>
          <div className="btn-row">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                className="btn"
                onClick={async () => {
                  // ポップアップブロックを避けるため、ユーザー操作と同じ同期フレーム
                  // 内でタブを先に開く(await の後だと Safari 等でブロックされ得る)。
                  // noopener 指定時は戻り値が null になり得るため参照には依存しない。
                  window.open(p.url, "_blank", "noopener,noreferrer");
                  const ok = await copyToClipboard(markdown);
                  setMessage(ok ? s.export.copiedOpen : s.errors.copyFailed);
                }}
              >
                {p.name}{s.export.openSuffix}
              </button>
            ))}
          </div>

          <h2>{s.export.preview}</h2>
          <div className="markdown-preview">{markdown}</div>
        </>
      )}
    </div>
  );
}
