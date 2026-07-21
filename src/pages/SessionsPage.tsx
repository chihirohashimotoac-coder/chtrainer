import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSessions, getStatistics } from "../db/db";
import { recalcAndSaveStatistics } from "../services/sessionService";
import { modeLabel } from "../export/markdown";
import { targetSignature } from "../domain/compare";
import { useApp } from "../state/AppContext";
import type { SessionStatistics, TrainingSession } from "../types/models";
import { fmtDateTime, fmtRate } from "../utils/format";
import { t } from "../i18n/ja";

export default function SessionsPage() {
  const s = t();
  const { equipmentProfiles } = useApp();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, SessionStatistics>>({});
  const [filterMode, setFilterMode] = useState("");
  const [filterBoard, setFilterBoard] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    void (async () => {
      const all = await getSessions();
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
    })();
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((sess) => {
      if (filterMode && sess.trainingMode !== filterMode) return false;
      if (filterBoard && sess.boardType !== filterBoard) return false;
      if (filterStatus && sess.status !== filterStatus) return false;
      if (filterEquipment && sess.equipmentProfileId !== filterEquipment)
        return false;
      if (
        filterTarget &&
        !targetSignature(sess).toLowerCase().includes(filterTarget.toLowerCase())
      )
        return false;
      const day = sess.startedAt.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
  }, [sessions, filterMode, filterBoard, filterStatus, filterEquipment, filterTarget, dateFrom, dateTo]);

  const modes = [...new Set(sessions.map((x) => x.trainingMode))];

  return (
    <div>
      <div className="top-bar">
        <h1>{s.sessions.title}</h1>
        <button
          className="btn small"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          {s.sessions.filter}
        </button>
      </div>

      {showFilters && (
        <div className="card">
          <label className="field">
            <span>{s.sessions.filterMode}</span>
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
              <option value="">{s.sessions.all}</option>
              {modes.map((m) => (
                <option key={m} value={m}>
                  {modeLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{s.sessions.filterBoard}</span>
            <select value={filterBoard} onChange={(e) => setFilterBoard(e.target.value)}>
              <option value="">{s.sessions.all}</option>
              <option value="steel">{s.player.steel}</option>
              <option value="soft">{s.player.soft}</option>
            </select>
          </label>
          <label className="field">
            <span>{s.sessions.filterStatus}</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">{s.sessions.all}</option>
              <option value="completed">{s.sessions.completed}</option>
              <option value="aborted">{s.sessions.aborted}</option>
            </select>
          </label>
          {equipmentProfiles.length > 0 && (
            <label className="field">
              <span>{s.sessions.filterEquipment}</span>
              <select
                value={filterEquipment}
                onChange={(e) => setFilterEquipment(e.target.value)}
              >
                <option value="">{s.sessions.all}</option>
                {equipmentProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>{s.sessions.filterTarget}</span>
            <input
              type="text"
              value={filterTarget}
              onChange={(e) => setFilterTarget(e.target.value)}
              placeholder="T20"
            />
          </label>
          <label className="field">
            <span>{s.sessions.filterDateFrom}</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>{s.sessions.filterDateTo}</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
      )}

      {filtered.length === 0 && <p className="muted">{s.sessions.empty}</p>}
      {filtered.map((sess) => {
        const st = statsMap[sess.id];
        const equipment = equipmentProfiles.find(
          (e) => e.id === sess.equipmentProfileId
        );
        return (
          <Link
            key={sess.id}
            to={`/session/${sess.id}`}
            className="card selectable"
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <div className="list-row">
              <strong>{modeLabel(sess.trainingMode)}</strong>
              <span
                className={`badge${sess.status === "completed" ? " ok" : sess.status === "aborted" ? " warn" : ""}`}
              >
                {sess.status === "completed"
                  ? s.sessions.completed
                  : sess.status === "aborted"
                    ? s.sessions.aborted
                    : s.sessions.active}
              </span>
            </div>
            <div className="muted small">
              {fmtDateTime(sess.startedAt)} /{" "}
              {sess.status === "completed"
                ? `${sess.plannedThrowCount}${s.sets.throwsUnit}`
                : `${st?.completedThrows ?? 0}/${sess.plannedThrowCount}${s.sets.throwsUnit} (${s.sessions.progress} ${sess.plannedThrowCount > 0 ? (((st?.completedThrows ?? 0) / sess.plannedThrowCount) * 100).toFixed(1) : "0.0"}%)`}{" "}
              / {sess.boardType === "steel" ? s.player.steel : s.player.soft}
              {equipment ? ` / ${equipment.name}` : ""}
            </div>
            <div className="muted small">
              {s.sessions.hitRate}:{" "}
              {st ? fmtRate(st.exactHitRate) : "N/A"} / {s.sessions.condition}:{" "}
              {sess.dailyCondition === "better_than_usual"
                ? s.preSession.better
                : sess.dailyCondition === "usual"
                  ? s.preSession.usual
                  : s.preSession.worse}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
