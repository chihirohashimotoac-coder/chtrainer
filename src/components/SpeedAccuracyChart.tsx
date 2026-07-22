import type { SpeedAccuracyResult } from "../domain/speedStats";

/**
 * 矢速(X, km/h)×誤差距離(Y, 正規化)の散布図。インラインSVGで軸つき描画。
 * テーマのトークンを currentColor 経由で使い、配色はテーマに追従する。
 */
export function SpeedAccuracyChart({ data }: { data: SpeedAccuracyResult }) {
  const W = 320;
  const H = 200;
  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 26;

  const minX = data.minSpeedKmh ?? 0;
  const maxX = data.maxSpeedKmh ?? 1;
  const maxY = Math.max(data.maxErrorDistance ?? 0.001, 0.001);
  const spanX = maxX - minX || 1;

  const sx = (v: number) => padL + ((v - minX) / spanX) * (W - padL - padR);
  const sy = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="矢速と誤差距離の散布図"
      style={{ maxWidth: 420, display: "block" }}
    >
      {/* 軸 */}
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" strokeWidth={1} opacity={0.4} />
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeWidth={1} opacity={0.4} />
      {/* Y目盛(0 と max) */}
      <text x={padL - 4} y={H - padB} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="currentColor" opacity={0.7}>0</text>
      <text x={padL - 4} y={padT + 4} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="currentColor" opacity={0.7}>{maxY.toFixed(2)}</text>
      {/* X目盛(min と max) */}
      <text x={padL} y={H - padB + 10} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.7}>{minX.toFixed(0)}</text>
      <text x={W - padR} y={H - padB + 10} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.7}>{maxX.toFixed(0)}</text>
      <text x={(padL + W - padR) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.7}>km/h</text>

      {/* 平均線 */}
      {data.averageErrorDistance != null && (
        <line
          x1={padL}
          y1={sy(data.averageErrorDistance)}
          x2={W - padR}
          y2={sy(data.averageErrorDistance)}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.3}
        />
      )}

      {/* 点 */}
      {data.points.map((p, i) => (
        <circle key={i} cx={sx(p.speedKmh)} cy={sy(p.errorDistance)} r={2.6} fill="#4fc3ff" opacity={0.85} />
      ))}
    </svg>
  );
}
