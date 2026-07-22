import { useEffect, useMemo, useState } from "react";
import { getSessions, getStatistics } from "../db/db";
import { recalcAndSaveStatistics } from "../services/sessionService";
import { aggregateByEquipment } from "../domain/equipmentStats";
import { modeLabel } from "../export/markdown";
import { useApp } from "../state/AppContext";
import type { SessionStatistics, TrainingSession } from "../types/models";
import { fmtNum, fmtRate } from "../utils/format";
import { t } from "../i18n/ja";

/** セッティング(装備プロファイル)別の横断集計比較。 */
export default function EquipmentComparePage() {
  const s = t();
  const { equipmentProfiles } = useApp();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, SessionStatistics>>({});
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const all = (await getSessions()).filter((x) => x.status === "completed");
      setSessions(all);
      const map: Record<string, SessionStatistics> = {};
      await Promise.all(
        all.map(async (sess) => {
          const st =
            (await getStatistics(sess.id)) ??
            (await recalcAndSaveStatistics(sess.id));
          if (st) map[sess.id] = st;
        })
      );
      setStatsMap(map);
      setLoading(false);
    })();
  }, []);

  const modes = useMemo(
    () => [...new Set(sessions.map((x) => x.trainingMode))],
    [sessions]
  );

  const rows = useMemo(
    () =>
      aggregateByEquipment(sessions, statsMap, equipmentProfiles, {
        mode: mode || undefined,
      }),
    [sessions, statsMap, equipmentProfiles, mode]
  );

  if (loading) return <p>{s.common.loading}</p>;

  return (
    <div>
      <div className="top-bar">
        <h1>{s.equipCompare.title}</h1>
      </div>
      <p className="page-lead">{s.equipCompare.lead}</p>

      <label className="field">
        <span>{s.equipCompare.modeFilter}</span>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">{s.equipCompare.allModesMixed}</option>
          {modes.map((m) => (
            <option key={m} value={m}>
              {modeLabel(m)}
            </option>
          ))}
        </select>
      </label>
      {!mode && <div className="info-box">{s.equipCompare.mixWarning}</div>}

      {rows.length === 0 ? (
        <p className="muted">{s.equipCompare.empty}</p>
      ) : (
        <div className="table-wrap">
          <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
          <table className="stats">
            <thead>
              <tr>
                <th>{s.equipCompare.equipment}</th>
                <th>{s.equipCompare.sessions}</th>
                <th>{s.equipCompare.throws}</th>
                <th>{s.result.hitRate}</th>
                <th>{s.result.averageErrorDistance}</th>
                <th>{s.equipCompare.avgDiameter}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.equipmentId ?? "__none__"}>
                  <td>{r.name}</td>
                  <td>{r.sessionCount}</td>
                  <td>{r.throwCount}</td>
                  <td>{r.scorableThrows > 0 ? fmtRate(r.hitRate) : "N/A"}</td>
                  <td>{fmtNum(r.averageErrorDistance)}</td>
                  <td>{fmtNum(r.averageDiameter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="info-box na-legend">{s.equipCompare.note}</div>
    </div>
  );
}
