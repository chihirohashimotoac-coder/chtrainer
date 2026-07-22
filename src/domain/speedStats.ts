import type { ThrowRecord } from "../types/models";

/** 矢速×精度の1点(矢速 km/h と、その投擲の誤差距離)。 */
export interface SpeedErrorPoint {
  speedKmh: number;
  /** 正規化誤差距離(外側ダブル外周半径=1.0) */
  errorDistance: number;
}

export interface SpeedAccuracyResult {
  sampleCount: number;
  points: SpeedErrorPoint[];
  /**
   * ピアソン相関係数(-1..1)。正なら「速いほど誤差が大きい」傾向。
   * サンプル2未満、または一方の分散が0なら undefined(算出不能)。
   */
  correlation?: number;
  averageSpeedKmh?: number;
  averageErrorDistance?: number;
  minSpeedKmh?: number;
  maxSpeedKmh?: number;
  minErrorDistance?: number;
  maxErrorDistance?: number;
}

/**
 * 矢速(任意入力)と誤差距離の相関を求める。
 * 矢速と誤差距離の両方を持つ投擲だけを対象にする(概算入力の誤差も含む)。
 */
export function speedAccuracyStats(throws: ThrowRecord[]): SpeedAccuracyResult {
  const points: SpeedErrorPoint[] = [];
  for (const th of throws) {
    const speedKmh = th.speedKmh;
    const errorDistance = th.derived?.errorDistance;
    if (
      speedKmh != null &&
      Number.isFinite(speedKmh) &&
      errorDistance != null &&
      Number.isFinite(errorDistance)
    ) {
      points.push({ speedKmh, errorDistance });
    }
  }

  const n = points.length;
  if (n === 0) return { sampleCount: 0, points };

  const sumX = points.reduce((a, p) => a + p.speedKmh, 0);
  const sumY = points.reduce((a, p) => a + p.errorDistance, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    const dx = p.speedKmh - meanX;
    const dy = p.errorDistance - meanY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  const correlation = n >= 2 && denom > 0 ? sxy / denom : undefined;

  const speeds = points.map((p) => p.speedKmh);
  const errors = points.map((p) => p.errorDistance);
  return {
    sampleCount: n,
    points,
    correlation,
    averageSpeedKmh: meanX,
    averageErrorDistance: meanY,
    minSpeedKmh: Math.min(...speeds),
    maxSpeedKmh: Math.max(...speeds),
    minErrorDistance: Math.min(...errors),
    maxErrorDistance: Math.max(...errors),
  };
}
