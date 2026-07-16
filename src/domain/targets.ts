import type { BoardProfile } from "../config/boardProfiles";
import type {
  LandingRecord,
  Ring,
  TargetArea,
  TargetDefinition,
} from "../types/models";
import { segmentRepresentativePoint } from "./board";
import { newId } from "../utils/id";

/** ターゲットのラベルを生成する (T20, D16, S5, Bull 等) */
export function segmentLabel(ring: Ring, number?: number): string {
  switch (ring) {
    case "triple":
      return `T${number}`;
    case "double":
      return `D${number}`;
    case "inner_single":
    case "outer_single":
      return `S${number}`;
    case "inner_bull":
      return "インナーブル";
    case "outer_bull":
      return "アウターブル";
    default:
      return "?";
  }
}

/** 単一セグメントを狙うターゲットを作る */
export function makeSegmentTarget(
  ring: Ring,
  profile: BoardProfile,
  number?: number
): TargetDefinition {
  return {
    id: newId(),
    label: segmentLabel(ring, number),
    type: "exact_segment",
    number,
    ring,
    representativePoint: segmentRepresentativePoint(ring, profile, number),
  };
}

/** Bull全体(インナー・アウター両方を命中とする)ターゲット */
export function makeBullAnyTarget(): TargetDefinition {
  return {
    id: newId(),
    label: "Bull",
    type: "bull_any",
    representativePoint: { x: 0, y: 0 },
  };
}

/** ナンバー全体(シングル・ダブル・トリプルすべて命中)ターゲット */
export function makeNumberSectorTarget(
  number: number,
  profile: BoardProfile
): TargetDefinition {
  return {
    id: newId(),
    label: `${number}全体`,
    type: "number_sector",
    number,
    // セクターの主要部分であるアウターシングル帯の中心を代表点とする(近似)
    representativePoint: segmentRepresentativePoint("outer_single", profile, number),
  };
}

/** 任意の複数エリアを命中と見なすターゲット */
export function makeCustomTarget(
  label: string,
  areas: TargetArea[],
  profile: BoardProfile
): TargetDefinition {
  const first = areas[0];
  const rep = first
    ? segmentRepresentativePoint(first.ring, profile, first.number)
    : { x: 0, y: 0 };
  return {
    id: newId(),
    label,
    type: "custom_selection",
    areas,
    representativePoint: rep,
  };
}

/**
 * ランダムターゲット用の全ボードプール:
 * S1〜S20・D1〜D20・T1〜T20・Bull全体 (計61ターゲット)。
 */
export function buildFullRandomPool(profile: BoardProfile): TargetDefinition[] {
  const pool: TargetDefinition[] = [];
  for (let n = 1; n <= 20; n++) {
    pool.push(makeSegmentTarget("outer_single", profile, n));
    pool.push(makeSegmentTarget("double", profile, n));
    pool.push(makeSegmentTarget("triple", profile, n));
  }
  pool.push(makeBullAnyTarget());
  return pool;
}

function isSingleRing(ring: Ring): boolean {
  return ring === "inner_single" || ring === "outer_single";
}

function areaMatches(area: TargetArea, landing: LandingRecord): boolean {
  if (area.ring === "inner_bull" || area.ring === "outer_bull") {
    return landing.ring === area.ring;
  }
  if (isSingleRing(area.ring)) {
    // シングル狙いはインナー/アウターを区別せず同ナンバーのシングルで命中とする
    return isSingleRing(landing.ring) && landing.number === area.number;
  }
  return landing.ring === area.ring && landing.number === area.number;
}

/** ターゲットに対する完全命中判定 */
export function isExactHit(target: TargetDefinition, landing: LandingRecord): boolean {
  if (landing.ring === "outboard" || landing.ring === "bounce_out" || landing.ring === "unknown") {
    return false;
  }
  switch (target.type) {
    case "bull_any":
      return landing.ring === "inner_bull" || landing.ring === "outer_bull";
    case "number_sector":
      return (
        landing.number === target.number &&
        (isSingleRing(landing.ring) ||
          landing.ring === "double" ||
          landing.ring === "triple")
      );
    case "exact_segment": {
      if (target.ring == null) return false;
      return areaMatches({ ring: target.ring, number: target.number }, landing);
    }
    case "custom_selection":
      return (target.areas ?? []).some((a) => areaMatches(a, landing));
  }
}

/** 2つのターゲットが同一の狙いかどうか(ターゲット変更判定用) */
export function isSameTarget(a: TargetDefinition, b: TargetDefinition): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bull_any") return true;
  if (a.type === "custom_selection") return a.label === b.label;
  return a.number === b.number && a.ring === b.ring;
}
