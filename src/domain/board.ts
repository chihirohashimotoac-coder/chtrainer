import type { BoardProfile } from "../config/boardProfiles";
import type { Ring } from "../types/models";

/**
 * 座標系:
 *  - ボード中心が原点
 *  - 右が +x、上が +y
 *  - 外側ダブル外周の半径 = 1.0
 * 角度:
 *  - 20方向(真上)が0度、時計回りが正、0以上360未満
 */

export interface PolarPoint {
  radius: number;
  angleDeg: number;
}

/** ピクセル座標を正規化座標へ変換する */
export function normalizePoint(
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
  doubleOuterRadiusPx: number
): { x: number; y: number } {
  return {
    x: (pointerX - centerX) / doubleOuterRadiusPx,
    y: (centerY - pointerY) / doubleOuterRadiusPx,
  };
}

/** 正規化座標を極座標(半径・角度)へ変換する */
export function toPolar(x: number, y: number): PolarPoint {
  const radius = Math.hypot(x, y);
  if (radius === 0) return { radius: 0, angleDeg: 0 };
  let angleDeg = (Math.atan2(x, y) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;
  if (angleDeg >= 360) angleDeg -= 360;
  return { radius, angleDeg };
}

/** 極座標を正規化座標へ変換する */
export function fromPolar(radius: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: radius * Math.cos(rad) };
}

/** 角度からセクターナンバーを判定する */
export function numberAtAngle(angleDeg: number, profile: BoardProfile): number {
  const normalized = ((angleDeg % 360) + 360) % 360;
  const index = Math.floor(((normalized + 9) % 360) / 18);
  const n = profile.segmentOrder[index];
  return n ?? 20;
}

/**
 * 半径からリングを判定する。
 * 境界の扱い: 各リングの外周半径は「そのリングに含む」(<=)。
 */
export function ringAtRadius(radius: number, profile: BoardProfile): Ring {
  const r = profile.radii;
  if (radius <= r.innerBullOuter) return "inner_bull";
  if (radius <= r.outerBullOuter) return "outer_bull";
  if (radius < r.tripleInner) return "inner_single";
  if (radius <= r.tripleOuter) return "triple";
  if (radius < r.doubleInner) return "outer_single";
  if (radius <= r.doubleOuter) return "double";
  return "outboard";
}

export interface JudgedLanding {
  x: number;
  y: number;
  radius: number;
  angleDeg: number;
  ring: Ring;
  number?: number;
  score: number;
}

/** 正規化座標から着弾の完全な判定を行う */
export function judgePoint(x: number, y: number, profile: BoardProfile): JudgedLanding {
  const { radius, angleDeg } = toPolar(x, y);
  const ring = ringAtRadius(radius, profile);
  const base: JudgedLanding = { x, y, radius, angleDeg, ring, score: 0 };
  if (ring === "inner_bull") return { ...base, score: 50 };
  if (ring === "outer_bull") return { ...base, score: 25 };
  if (ring === "outboard") return { ...base, score: 0 };
  const number = numberAtAngle(angleDeg, profile);
  const multiplier = ring === "double" ? 2 : ring === "triple" ? 3 : 1;
  return { ...base, number, score: number * multiplier };
}

/** セクター中心の角度(度)を返す */
export function sectorCenterAngle(number: number, profile: BoardProfile): number {
  const index = profile.segmentOrder.indexOf(number);
  return index < 0 ? 0 : index * 18;
}

/** リングの半径中央値(帯の中心)を返す */
export function ringMidRadius(ring: Ring, profile: BoardProfile): number {
  const r = profile.radii;
  switch (ring) {
    case "inner_bull":
      return 0;
    case "outer_bull":
      return (r.innerBullOuter + r.outerBullOuter) / 2;
    case "inner_single":
      return (r.outerBullOuter + r.tripleInner) / 2;
    case "triple":
      return (r.tripleInner + r.tripleOuter) / 2;
    case "outer_single":
      return (r.tripleOuter + r.doubleInner) / 2;
    case "double":
      return (r.doubleInner + r.doubleOuter) / 2;
    default:
      return r.doubleOuter;
  }
}

/**
 * セグメント(ナンバー+リング)の代表点を返す。
 * 原則としてエリアの幾何学的中心(セクター中心角 x リング帯中央半径)を使用。
 */
export function segmentRepresentativePoint(
  ring: Ring,
  profile: BoardProfile,
  number?: number
): { x: number; y: number } {
  if (ring === "inner_bull" || ring === "outer_bull") return { x: 0, y: 0 };
  const angle = number != null ? sectorCenterAngle(number, profile) : 0;
  return fromPolar(ringMidRadius(ring, profile), angle);
}
