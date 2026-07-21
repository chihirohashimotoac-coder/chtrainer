import type { SessionStatistics, TrainingSession } from "../types/models";
import { ALL_DIRECTIONS } from "../domain/stats";
import { directionLabel } from "../export/markdown";
import { STAT_DEFINITIONS } from "../config/statsDefinitions";
import { fmtNum, fmtRate } from "../utils/format";
import { t } from "../i18n/ja";

const GROUPING_REASON_LABELS: Record<string, string> = {
  no_valid_three_dart_coordinate_set: "有効な詳細座標3投セットがない",
  bounce_out: "バウンスアウトを含む",
  outboard: "アウトボードを含む",
  unknown_position: "位置不明を含む",
  fewer_than_three_throws: "3投未満",
  segment_approximation: "簡易入力(概算)を含む",
};

/** セッション統計の表示ブロック(結果画面・詳細画面で共用) */
export function StatsView({
  stats,
  session,
}: {
  stats: SessionStatistics;
  session?: TrainingSession;
}) {
  const s = t();
  const grouping = stats.grouping;
  return (
    <div className="stats-view">
      <h2>{s.result.overview}</h2>
      <div className="card kpi-card">
        {(
          [
            [s.result.totalThrows, String(stats.totalThrows)],
            [s.result.completedThrows, String(stats.completedThrows)],
            ["命中判定対象投擲数", String(stats.scorableThrows ?? stats.completedThrows)],
            ["グルーピング専用投擲数", String(stats.groupingOnlyThrows ?? 0)],
            [s.result.exactHits, (stats.scorableThrows ?? stats.completedThrows) > 0 ? String(stats.exactHits) : "N/A"],
            [s.result.exactHitRate, (stats.scorableThrows ?? stats.completedThrows) > 0 ? fmtRate(stats.exactHitRate) : "N/A"],
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

      {grouping && (
        <>
          <h2>{s.result.groupingStats}</h2>
          <div className="card">
            <p className="muted small">{s.result.groupingInfo}</p>
            <div className="list-row">
              <span className="muted">{s.result.groupingValidSets}</span>
              <strong>{grouping.validSetCount}</strong>
            </div>
            <div className="list-row">
              <span className="muted">{s.result.groupingThrowCount}</span>
              <strong>{grouping.groupingThrowCount ?? grouping.validSetCount * 3}</strong>
            </div>
            {grouping.validSetCount > 0 ? (
              <>
                <div className="list-row">
                  <span className="muted">{s.result.groupingAvgDiameter}</span>
                  <strong>{fmtNum(grouping.averageDiameter)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingMedianDiameter}</span>
                  <strong>{fmtNum(grouping.medianDiameter)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingAvgPair}</span>
                  <strong>{fmtNum(grouping.averagePairDistance)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingMaxPair}</span>
                  <strong>{fmtNum(grouping.maximumPairDistance)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingFirstHalf}</span>
                  <strong>{fmtNum(grouping.firstHalfAverageDiameter)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingSecondHalf}</span>
                  <strong>{fmtNum(grouping.secondHalfAverageDiameter)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingD1D2}</span>
                  <strong>{fmtNum(grouping.interDartDistances?.d1d2)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingD2D3}</span>
                  <strong>{fmtNum(grouping.interDartDistances?.d2d3)}</strong>
                </div>
                <div className="list-row">
                  <span className="muted">{s.result.groupingD1D3}</span>
                  <strong>{fmtNum(grouping.interDartDistances?.d1d3)}</strong>
                </div>
              </>
            ) : (
              <p className="muted small">{s.result.groupingNoValidSets}</p>
            )}
            {(grouping.unavailableReasons?.length ?? 0) > 0 && (
              <p className="muted small">
                {s.result.groupingExcluded}:{" "}
                {grouping.unavailableReasons
                  ?.map((r) => GROUPING_REASON_LABELS[r] ?? r)
                  .join(" / ")}
              </p>
            )}
          </div>
          {(grouping.perSet?.length ?? 0) > 0 && (
            <div className="table-wrap">
              <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
              <table className="stats">
                <thead>
                  <tr>
                    <th>{s.result.groupingSetNo}</th>
                    <th>{s.result.groupingSetMax}</th>
                    <th>{s.result.groupingSetAvg}</th>
                  </tr>
                </thead>
                <tbody>
                  {grouping.perSet?.map((row, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{fmtNum(row.maxPairDistance)}</td>
                      <td>{fmtNum(row.averagePairDistance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

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
            <p className="muted small">
              {stats.groupingOnlyThrows > 0
                ? s.result.groupingNoErrorStats
                : s.result.noCoordinateData}
            </p>
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

      {stats.cricket && (
        <>
          <h2>{s.result.cricketStats}</h2>
          <div className="card">
            <div className="list-row">
              <span className="muted">{s.result.totalMarks}</span>
              <strong>{stats.cricket.totalMarks}</strong>
            </div>
            <div className="list-row">
              <span className="muted">{s.result.marksPerThree}</span>
              <strong>{fmtNum(stats.cricket.marksPerThreeDarts, 2)}</strong>
            </div>
            <div className="list-row">
              <span className="muted">{s.result.effectiveMarkRate}</span>
              <strong>{fmtRate(stats.cricket.effectiveMarkRate)}</strong>
            </div>
            <div className="list-row">
              <span className="muted">{s.result.noMarkRate}</span>
              <strong>{fmtRate(stats.cricket.noMarkRate)}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
            <table className="stats">
              <thead>
                <tr>
                  <th>{s.throws.target}</th>
                  <th>{s.result.throwCount}</th>
                  <th>{s.result.totalMarks}</th>
                  <th>{s.result.marksPerThree}</th>
                  <th>{s.result.effectiveMarkRate}</th>
                  <th>{s.result.noMarkRate}</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(stats.cricket.byTarget)
                  .sort()
                  .map((label) => {
                    const g = stats.cricket?.byTarget[label];
                    if (!g) return null;
                    return (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{g.throwCount}</td>
                        <td>{g.totalMarks}</td>
                        <td>{fmtNum(g.marksPerThreeDarts, 2)}</td>
                        <td>{fmtRate(g.effectiveMarkRate)}</td>
                        <td>{fmtRate(g.noMarkRate)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <h3>セット内のターゲット継続・切替比較</h3>
          <div className="table-wrap">
            <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
            <table className="stats">
              <thead>
                <tr><th>条件</th><th>投擲数</th><th>総マーク</th><th>1投平均マーク</th><th>ノーマーク率</th></tr>
              </thead>
              <tbody>
                {([
                  ["同一ターゲット継続", stats.cricket.continuity?.sameTarget],
                  ["セット内切替直後", stats.cricket.continuity?.afterSwitch],
                ] as const).map(([label, group]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{group?.throwCount ?? 0}</td>
                    <td>{group?.totalMarks ?? 0}</td>
                    <td>{group && group.throwCount > 0 ? fmtNum(group.marksPerDart, 2) : "未測定"}</td>
                    <td>{group && group.throwCount > 0 ? fmtRate(group.noMarkRate) : "分析不能"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stats.zeroOne && (
        <>
          <h2>{s.result.zeroOneStats}</h2>
          <div className="card">
            {stats.zeroOne.bullThrowCount > 0 && (
              <div className="list-row">
                <span className="muted">{s.result.bullHitRate}</span>
                <strong>{fmtRate(stats.zeroOne.bullHitRate)}</strong>
              </div>
            )}
            {stats.zeroOne.tripleThrowCount > 0 && (
              <div className="list-row">
                <span className="muted">{s.result.tripleHitRate}</span>
                <strong>{fmtRate(stats.zeroOne.tripleHitRate)}</strong>
              </div>
            )}
            {stats.zeroOne.doubleThrowCount > 0 && (
              <div className="list-row">
                <span className="muted">{s.result.doubleHitRate}</span>
                <strong>{fmtRate(stats.zeroOne.doubleHitRate)}</strong>
              </div>
            )}
            {stats.zeroOne.allHitSetRate != null && (
              <div className="list-row">
                <span className="muted">
                  {session?.arrangement === "fixed_three"
                    ? s.result.allHitSetRateFinish
                    : s.result.allHitSetRate}
                </span>
                <strong>{fmtRate(stats.zeroOne.allHitSetRate)}</strong>
              </div>
            )}
          </div>
        </>
      )}

      <h2>{s.result.byDartOrder}</h2>
      <div className="table-wrap">
        <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
        <table className="stats">
          <thead>
            <tr>
              <th>{s.throws.order}</th>
              <th>{s.result.throwCount}</th>
              <th>{s.result.scorableThrowCount}</th>
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
                  <td>{d.scorableThrows ?? d.throwCount}</td>
                  <td>{(d.scorableThrows ?? d.throwCount) > 0 ? d.hitCount : "N/A"}</td>
                  <td>{(d.scorableThrows ?? d.throwCount) > 0 ? fmtRate(d.hitRate) : "N/A"}</td>
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
        <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
        <table className="stats">
          <thead>
            <tr>
              <th>{s.throws.target}</th>
              <th>{s.result.throwCount}</th>
              <th>{s.result.scorableThrowCount}</th>
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
                    <td>{g.scorableThrows ?? g.throwCount}</td>
                    <td>{(g.scorableThrows ?? g.throwCount) > 0 ? g.hitCount : "N/A"}</td>
                    <td>{(g.scorableThrows ?? g.throwCount) > 0 ? fmtRate(g.hitRate) : "N/A"}</td>
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
        <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
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
        <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
        <table className="stats">
          <thead>
            <tr>
              <th></th>
              <th>{s.result.throwCount}</th>
              <th>{s.result.scorableThrowCount}</th>
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
                <td>{h.scorableThrows ?? h.throwCount}</td>
                <td>{(h.scorableThrows ?? h.throwCount) > 0 ? fmtRate(h.hitRate) : "N/A"}</td>
                <td>{fmtNum(h.averageErrorDistance)}</td>
                <td>{fmtRate(h.outboardRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="info-box na-legend">
        <strong>N/A：</strong>このラウンドでは命中・誤差を評価しない、または判定に必要なデータがない項目です。R1グルーピングは命中率を測定しないためN/Aです。
      </div>

      <details className="card">
        <summary>
          <strong>{s.result.statsHelpTitle}</strong>
        </summary>
        <dl>
          {STAT_DEFINITIONS.map(({ term, definition }) => (
            <div key={term} style={{ margin: "0.4rem 0" }}>
              <dt>
                <strong>{term}</strong>
              </dt>
              <dd className="muted small" style={{ margin: 0 }}>
                {definition}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
