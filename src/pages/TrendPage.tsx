import { useEffect, useMemo, useState } from "react";
import { getSessions } from "../db/db";
import { getStatistics } from "../db/db";
import { recalcAndSaveStatistics } from "../services/sessionService";
import { modeLabel, scoringStyleLabel } from "../export/markdown";
import type { SessionStatistics, TrainingSession } from "../types/models";
import { fmtDateTime, fmtNum, fmtRate } from "../utils/format";
import { t } from "../i18n/ja";

interface TrendRow {
  session: TrainingSession;
  stats: SessionStatistics;
}

/**
 * 長期トレンド: 同一トレーニングモードのセッションだけを時系列で比較する。
 * 分母のない率はN/Aのまま表示し、0として扱わない。
 */
export default function TrendPage() {
  const s = t();
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [mode, setMode] = useState<string>("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const sessions = (await getSessions()).filter(
          (x) => x.status !== "active"
        );
        const withStats: TrendRow[] = [];
        for (const session of sessions) {
          const stats =
            (await getStatistics(session.id)) ??
            (await recalcAndSaveStatistics(session.id));
          if (stats) withStats.push({ session, stats });
        }
        setRows(withStats);
        if (withStats.length > 0) {
          setMode(withStats[0]!.session.trainingMode);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const modes = useMemo(
    () => [...new Set(rows.map((r) => r.session.trainingMode))],
    [rows]
  );

  const filtered = useMemo(() => {
    const sameMode = rows.filter((r) => r.session.trainingMode === mode);
    const sorted = sameMode.sort((a, b) =>
      a.session.startedAt.localeCompare(b.session.startedAt)
    );
    return order === "asc" ? sorted : sorted.slice().reverse();
  }, [rows, mode, order]);

  const isCricket = mode === "cricket";
  const isSkill = mode === "skill_check";
  const isZeroOne = mode === "zero_one";

  if (loading) return <p>{s.common.loading}</p>;

  return (
    <div>
      <h1>{s.trend.title}</h1>
      <p className="muted small">{s.trend.info}</p>

      <div className="choice-row" style={{ margin: "0.4rem 0" }}>
        {modes.map((m) => (
          <button
            key={m}
            className={`choice${mode === m ? " selected" : ""}`}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
          >
            {modeLabel(m)}
          </button>
        ))}
      </div>
      <div className="choice-row" style={{ margin: "0.4rem 0" }}>
        <button
          className={`choice${order === "asc" ? " selected" : ""}`}
          onClick={() => setOrder("asc")}
          aria-pressed={order === "asc"}
        >
          {s.trend.orderAsc}
        </button>
        <button
          className={`choice${order === "desc" ? " selected" : ""}`}
          onClick={() => setOrder("desc")}
          aria-pressed={order === "desc"}
        >
          {s.trend.orderDesc}
        </button>
      </div>

      {isSkill && <p className="muted small">{s.trend.skillStyleNote}</p>}

      {filtered.length === 0 && <p className="muted">{s.sessions.empty}</p>}
      {filtered.length === 1 && (
        <div className="info-box">{s.trend.needTwo}</div>
      )}
      {filtered.length > 0 && (
        <div className="table-wrap">
          <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
          <table className="stats">
            <thead>
              <tr>
                <th>{s.sessions.date}</th>
                <th>{s.sessions.status}</th>
                <th>{s.result.completedThrows}</th>
                <th>{s.result.exactHitRate}</th>
                <th>{s.result.averageErrorDistance}</th>
                <th>{s.result.outboardRate}</th>
                <th>1投目{s.result.hitRate}</th>
                <th>2投目{s.result.hitRate}</th>
                <th>3投目{s.result.hitRate}</th>
                {isSkill && <th>{s.preSession.scoringStyle}</th>}
                {isSkill && <th>{s.trend.groupingDiameter}</th>}
                {isCricket && <th>{s.result.marksPerThree}</th>}
                {isCricket && <th>{s.result.effectiveMarkRate}</th>}
                {isZeroOne && <th>{s.result.bullHitRate}</th>}
                {isZeroOne && <th>{s.result.tripleHitRate}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ session, stats }) => (
                <tr key={session.id}>
                  <td>{fmtDateTime(session.startedAt)}</td>
                  <td>
                    {session.status === "completed"
                      ? s.sessions.completed
                      : `${s.sessions.aborted} ${stats.completedThrows}/${session.plannedThrowCount}${s.sets.throwsUnit}`}
                  </td>
                  <td>{stats.completedThrows}</td>
                  <td>{fmtRate(stats.exactHitRate)}</td>
                  <td>{fmtNum(stats.combinedError.averageErrorDistance)}</td>
                  <td>{fmtRate(stats.outboardRate)}</td>
                  <td>{fmtRate(stats.byDartInSet["1"].hitRate)}</td>
                  <td>{fmtRate(stats.byDartInSet["2"].hitRate)}</td>
                  <td>{fmtRate(stats.byDartInSet["3"].hitRate)}</td>
                  {isSkill && (
                    <td>
                      {session.scoringStyle
                        ? scoringStyleLabel(session.scoringStyle).split("(")[0]
                        : "N/A"}
                    </td>
                  )}
                  {isSkill && <td>{fmtNum(stats.grouping?.averageDiameter)}</td>}
                  {isCricket && (
                    <td>{fmtNum(stats.cricket?.marksPerThreeDarts, 2)}</td>
                  )}
                  {isCricket && (
                    <td>{fmtRate(stats.cricket?.effectiveMarkRate)}</td>
                  )}
                  {isZeroOne && (
                    <td>
                      {stats.zeroOne && stats.zeroOne.bullThrowCount > 0
                        ? fmtRate(stats.zeroOne.bullHitRate)
                        : "N/A"}
                    </td>
                  )}
                  {isZeroOne && (
                    <td>
                      {stats.zeroOne && stats.zeroOne.tripleThrowCount > 0
                        ? fmtRate(stats.zeroOne.tripleHitRate)
                        : "N/A"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">{s.trend.naNote}</p>
    </div>
  );
}
