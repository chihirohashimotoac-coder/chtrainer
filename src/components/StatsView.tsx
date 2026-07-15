import type { SessionStatistics } from "../types/models";
import { ALL_DIRECTIONS } from "../domain/stats";
import { directionLabel } from "../export/markdown";
import { fmtNum, fmtRate } from "../utils/format";
import { t } from "../i18n/ja";

/** セッション統計の表示ブロック(結果画面・詳細画面で共用) */
export function StatsView({ stats }: { stats: SessionStatistics }) {
  const s = t();
  return (
    <div>
      <h2>{s.result.overview}</h2>
      <div className="card">
        {(
          [
            [s.result.totalThrows, String(stats.totalThrows)],
            [s.result.completedThrows, String(stats.completedThrows)],
            [s.result.exactHits, String(stats.exactHits)],
            [s.result.exactHitRate, fmtRate(stats.exactHitRate)],
            [
              s.result.outboardCount,
              `${stats.outboardCount} (${fmtRate(stats.outboardRate)})`,
            ],
            [s.result.bounceOutCount, String(stats.bounceOutCount)],
            [s.result.coordinateInputCount, String(stats.coordinateInputCount)],
            [s.result.approximateInputCount, String(stats.approximateInputCount)],
          ] as const
        ).map(([label, value]) => (
          <div className="list-row" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <h2>{s.result.errorStats}</h2>
      {(
        [
          [s.result.coordinateOnly, stats.coordinateError],
          [s.result.combinedApprox, stats.combinedError],
        ] as const
      ).map(([title, err]) => (
        <div className="card" key={title}>
          <h3>{title}</h3>
          {err.sampleCount === 0 ? (
            <p className="muted small">{s.result.noCoordinateData}</p>
          ) : (
            <>
              <div className="list-row">
                <span className="muted">{s.result.throwCount}</span>
                <strong>{err.sampleCount}</strong>
              </div>
              <div className="list-row">
                <span className="muted">{s.result.averageErrorDistance}</span>
                <strong>{fmtNum(err.averageErrorDistance)}</strong>
              </div>
              <div className="list-row">
                <span className="muted">{s.result.medianErrorDistance}</span>
                <strong>{fmtNum(err.medianErrorDistance)}</strong>
              </div>
              <div className="list-row">
                <span className="muted">{s.result.averageErrorX}</span>
                <strong>{fmtNum(err.averageErrorX)}</strong>
              </div>
              <div className="list-row">
                <span className="muted">{s.result.averageErrorY}</span>
                <strong>{fmtNum(err.averageErrorY)}</strong>
              </div>
            </>
          )}
        </div>
      ))}

      <h2>{s.result.byDartOrder}</h2>
      <div className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              <th>{s.throws.order}</th>
              <th>{s.result.throwCount}</th>
              <th>{s.result.hitCount}</th>
              <th>{s.result.hitRate}</th>
              <th>{s.result.averageErrorDistance}</th>
              <th>{s.result.outboardRate}</th>
            </tr>
          </thead>
          <tbody>
            {(["1", "2", "3"] as const).map((order) => {
              const d = stats.byDartInSet[order];
              return (
                <tr key={order}>
                  <td>{order}投目</td>
                  <td>{d.throwCount}</td>
                  <td>{d.hitCount}</td>
                  <td>{fmtRate(d.hitRate)}</td>
                  <td>{fmtNum(d.averageErrorDistance)}</td>
                  <td>{fmtRate(d.outboardRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>{s.result.byTarget}</h2>
      <div className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              <th>{s.throws.target}</th>
              <th>{s.result.throwCount}</th>
              <th>{s.result.hitCount}</th>
              <th>{s.result.hitRate}</th>
              <th>{s.result.averageErrorDistance}</th>
              <th>{s.result.mainMissDirection}</th>
              <th>{s.result.outboardCount}</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(stats.byTarget)
              .sort()
              .map((label) => {
                const g = stats.byTarget[label];
                if (!g) return null;
                return (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{g.throwCount}</td>
                    <td>{g.hitCount}</td>
                    <td>{fmtRate(g.hitRate)}</td>
                    <td>{fmtNum(g.averageErrorDistance)}</td>
                    <td>{directionLabel(g.mainMissDirection)}</td>
                    <td>{g.outboardCount}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <h2>{s.result.byDirection}</h2>
      <div className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              {ALL_DIRECTIONS.map((d) => (
                <th key={d}>{directionLabel(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {ALL_DIRECTIONS.map((d) => (
                <td key={d}>{stats.byDirection[d]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <h2>{s.result.halves}</h2>
      <div className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              <th></th>
              <th>{s.result.throwCount}</th>
              <th>{s.result.hitRate}</th>
              <th>{s.result.averageErrorDistance}</th>
              <th>{s.result.outboardRate}</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                [s.result.firstHalf, stats.firstHalf],
                [s.result.secondHalf, stats.secondHalf],
              ] as const
            ).map(([label, h]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{h.throwCount}</td>
                <td>{fmtRate(h.hitRate)}</td>
                <td>{fmtNum(h.averageErrorDistance)}</td>
                <td>{fmtRate(h.outboardRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
