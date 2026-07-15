import type { BoardProfile } from "../config/boardProfiles";
import type { LandingRecord, OutboardDirection, Ring } from "../types/models";
import { judgePoint, segmentRepresentativePoint, toPolar } from "./board";

/** 詳細座標入力から着弾レコードを作る */
export function landingFromCoordinate(
  x: number,
  y: number,
  profile: BoardProfile
): LandingRecord {
  const judged = judgePoint(x, y, profile);
  return {
    number: judged.number,
    ring: judged.ring,
    score: judged.score,
    x,
    y,
    radius: judged.radius,
    angleDeg: judged.angleDeg,
    positionPrecision: "coordinate",
  };
}

/**
 * 簡易入力(エリア選択)から着弾レコードを作る。
 * 座標はエリアの代表点(幾何学的中心)による概算値。
 */
export function landingFromSegment(
  ring: Ring,
  profile: BoardProfile,
  number?: number
): LandingRecord {
  const point = segmentRepresentativePoint(ring, profile, number);
  const { radius, angleDeg } = toPolar(point.x, point.y);
  const score =
    ring === "inner_bull"
      ? 50
      : ring === "outer_bull"
        ? 25
        : number != null
          ? number * (ring === "double" ? 2 : ring === "triple" ? 3 : 1)
          : 0;
  return {
    number:
      ring === "inner_bull" || ring === "outer_bull" ? undefined : number,
    ring,
    score,
    x: point.x,
    y: point.y,
    radius,
    angleDeg,
    positionPrecision: "segment_approximation",
  };
}

/** アウトボード(座標あり: 詳細入力の範囲内) */
export function landingOutboardWithCoordinate(
  x: number,
  y: number
): LandingRecord {
  const { radius, angleDeg } = toPolar(x, y);
  return {
    ring: "outboard",
    score: 0,
    x,
    y,
    radius,
    angleDeg,
    positionPrecision: "coordinate",
  };
}

/**
 * アウトボード(入力範囲外・方向のみ)。
 * 距離が不明なため架空の座標は生成しない。
 */
export function landingOutboardDirection(
  direction: OutboardDirection
): LandingRecord {
  return {
    ring: "outboard",
    score: 0,
    outboardDirection: direction,
    positionPrecision: direction === "unknown" ? "unknown" : "direction_only",
  };
}

/** バウンスアウト(原則、着弾位置不明) */
export function landingBounceOut(coords?: {
  x: number;
  y: number;
}): LandingRecord {
  if (coords) {
    const { radius, angleDeg } = toPolar(coords.x, coords.y);
    return {
      ring: "bounce_out",
      score: 0,
      x: coords.x,
      y: coords.y,
      radius,
      angleDeg,
      positionPrecision: "coordinate",
    };
  }
  return {
    ring: "bounce_out",
    score: 0,
    positionPrecision: "unknown",
  };
}
