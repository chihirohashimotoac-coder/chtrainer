import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getSession, getSessions, getStatistics } from "../db/db";
import {
  compareStatistics,
  isDissimilarComparison,
  rankComparisonCandidates,
} from "../domain/compare";
import { modeLabel } from "../export/markdown";
import type { SessionStatistics, TrainingSession } from "../types/models";
import { fmtDateTime, fmtNum, fmtNumDiff, fmtRate, fmtRateDiff } from "../utils/format";
import { t } from "../i18n/ja";

export default function ComparePage() {
  const s = t();
  const { id } = useParams();
  const [base, setBase] = useState<TrainingSession>();
  const [baseStats, setBaseStats] = useState<SessionStatistics>();
  const [others, setOthers] = useState<TrainingSession[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, SessionStatistics>>({});
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const sess = await getSession(id);
      setBase(sess);
      setBaseStats(await getStatistics(id));
      const all = (await getSessions()).filter(
        (x) => x.id !== id && x.status !== "active"
      );
      setOthers(all);
      const map: Record<string, SessionStatistics> = {};
      await Promise.all(
        all.map(async (x) => {
          const st = await getStatistics(x.id);
          if (st) map[x.id] = st;
        })
      );
      setStatsMap(map);
    })();
  }, [id]);

  const candidates = useMemo(
    () => (base ? rankComparisonCandidates(base, others) : []),
    [base, others]
  );

  if (!base || !baseStats) return <p>{s.common.loading}</p>;

  const toggle = (sessionId: string) => {
    setSelected((prev) =>
      prev.includes(sessionId)
        ? prev.filter((x) => x !== sessionId)
        : [...prev, sessionId]
    );
  };

  return (
    <div>
      <h1>{s.compare.title}</h1>
      <div className="card">
        <span className="muted small">{s.compare.baseSession}</span>
        <div>
          <strong>{modeLabel(base.trainingMode)}</strong>{" "}
          <span className="muted small">{fmtDateTime(base.startedAt)}</span>
        </div>
      </div>

      <h2>{s.compare.candidates}</h2>
      {candidates.length === 0 && <p className="muted">{s.sessions.empty}</p>}
      {candidates.map(({ session: cand, reasons }) => {
        const isSelected = selected.includes(cand.id);
        const hasStats = statsMap[cand.id] != null;
        return (
          <button
            key={cand.id}
            className={`card selectable${isSelected ? " selected" : ""}`}
            style={{ display: "block", width: "100%", textAlign: "left" }}
            onClick={() => hasStats && toggle(cand.id)}
            disabled={!hasStats}
            aria-pressed={isSelected}
          >
            <div className="list-row">
              <strong>{modeLabel(cand.trainingMode)}</strong>
              <span className="muted small">{fmtDateTime(cand.startedAt)}</span>
            </div>
            <div className="muted small">
              {reasons.join(" / ") || "-"}
              {!hasStats && ` (${s.errors.notEnoughData})`}
            </div>
            {isSelected && isDissimilarComparison(base, cand) && (
              <div className="warn-box">{s.compare.warning}</div>
            )}
          </button>
        );
      })}

      {selected.length === 0 && <p className="muted">{s.compare.noSelection}</p>}

      {selected.map((selId) => {
        const other = others.find((x) => x.id === selId);
        const otherStats = statsMap[selId];
        if (!other || !otherStats) return null;
        const c = compareStatistics(baseStats, otherStats);
        return (
          <div className="card" key={selId}>
            <h2>
              {s.compare.pastSession}: {fmtDateTime(other.startedAt)} (
              {modeLabel(other.trainingMode)})
            </h2>
            <div className="table-wrap">
              <table className="stats">
                <thead>
                  <tr>
                    <th></th>
                    <th>{s.compare.thisSession}</th>
                    <th>{s.compare.pastSession}</th>
                    <th>差</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{s.result.exactHitRate}</td>
                    <td>{fmtRate(c.hitRate.base)}</td>
                    <td>{fmtRate(c.hitRate.other)}</td>
                    <td>{fmtRateDiff(c.hitRate.diff)}</td>
                  </tr>
                  <tr>
                    <td>{s.result.averageErrorDistance}</td>
                    <td>{fmtNum(c.averageErrorDistance.base)}</td>
                    <td>{fmtNum(c.averageErrorDistance.other)}</td>
                    <td>{fmtNumDiff(c.averageErrorDistance.diff)}</td>
                  </tr>
                  {(["1", "2", "3"] as const).map((order) => (
                    <tr key={order}>
                      <td>
                        {order}投目 {s.result.hitRate}
                      </td>
                      <td>{fmtRate(c.byDartInSet[order].hitRate.base)}</td>
                      <td>{fmtRate(c.byDartInSet[order].hitRate.other)}</td>
                      <td>{fmtRateDiff(c.byDartInSet[order].hitRate.diff)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      {s.result.firstHalf} {s.result.hitRate}
                    </td>
                    <td>{fmtRate(c.firstHalfHitRate.base)}</td>
                    <td>{fmtRate(c.firstHalfHitRate.other)}</td>
                    <td>{fmtRateDiff(c.firstHalfHitRate.diff)}</td>
                  </tr>
                  <tr>
                    <td>
                      {s.result.secondHalf} {s.result.hitRate}
                    </td>
                    <td>{fmtRate(c.secondHalfHitRate.base)}</td>
                    <td>{fmtRate(c.secondHalfHitRate.other)}</td>
                    <td>{fmtRateDiff(c.secondHalfHitRate.diff)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3>{s.compare.byTargetDiff}</h3>
            <div className="table-wrap">
              <table className="stats">
                <thead>
                  <tr>
                    <th>{s.throws.target}</th>
                    <th>{s.compare.thisSession}</th>
                    <th>{s.compare.pastSession}</th>
                    <th>差</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(c.byTarget)
                    .sort()
                    .map((label) => {
                      const d = c.byTarget[label];
                      if (!d) return null;
                      return (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>{fmtRate(d.hitRate.base)}</td>
                          <td>{fmtRate(d.hitRate.other)}</td>
                          <td>{fmtRateDiff(d.hitRate.diff)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <h3>{s.compare.assessmentDiff}</h3>
            <AssessmentDiff base={base} other={other} />
          </div>
        );
      })}
    </div>
  );
}

function AssessmentDiff({
  base,
  other,
}: {
  base: TrainingSession;
  other: TrainingSession;
}) {
  const s = t();
  const rows = (["before", "middle", "after"] as const).map((timing) => {
    const a = base.assessments.find((x) => x.timing === timing);
    const b = other.assessments.find((x) => x.timing === timing);
    return { timing, a, b };
  });
  const label = {
    before: s.assessment.beforeTitle,
    middle: s.assessment.middleTitle,
    after: s.assessment.afterTitle,
  };
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr>
            <th></th>
            <th>{s.assessment.fatigue}</th>
            <th>{s.assessment.concentration}</th>
            <th>{s.assessment.pain}</th>
            <th>{s.assessment.confidence}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ timing, a, b }) => (
            <tr key={timing}>
              <td>{label[timing]}</td>
              <td>{a && b ? fmtNumDiff(a.fatigue - b.fatigue, 0) : "N/A"}</td>
              <td>
                {a && b ? fmtNumDiff(a.concentration - b.concentration, 0) : "N/A"}
              </td>
              <td>{a && b ? fmtNumDiff(a.pain - b.pain, 0) : "N/A"}</td>
              <td>
                {a && b ? fmtNumDiff(a.confidence - b.confidence, 0) : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
