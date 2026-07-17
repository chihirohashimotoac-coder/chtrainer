import { CENTER_NEAR_THRESHOLD } from "../config/constants";
import type {
  DerivedRecord,
  LandingRecord,
  MissDirection,
  TargetDefinition,
} from "../types/models";
import { toPolar } from "./board";
import { isExactHit, isSameTarget } from "./targets";

/**
 * 誤差ベクトルの角度(上=0度、時計回り)から8方向へ分類する。
 * 誤差距離が閾値未満なら「中心付近」。
 */
export function classifyMissDirection(
  errorX: number,
  errorY: number,
  threshold: number = CENTER_NEAR_THRESHOLD
): MissDirection {
  const distance = Math.hypot(errorX, errorY);
  if (distance < threshold) return "center";
  const { angleDeg } = toPolar(errorX, errorY);
  const bins: MissDirection[] = [
    "up",
    "up_right",
    "right",
    "down_right",
    "down",
    "down_left",
    "left",
    "up_left",
  ];
  const index = Math.floor(((angleDeg + 22.5) % 360) / 45);
  return bins[index] ?? "up";
}

/** アウトボード方向(手動選択)を誤差方向として利用するための変換 */
export function outboardDirectionToMiss(
  dir: string | undefined
): MissDirection | undefined {
  switch (dir) {
    case "up":
    case "up_right":
    case "right":
    case "down_right":
    case "down":
    case "down_left":
    case "left":
    case "up_left":
      return dir;
    default:
      return undefined;
  }
}

export interface DeriveContext {
  previousTarget?: TargetDefinition;
  previousWasHit?: boolean;
  sameSetAsPrevious?: boolean;
  /** この投擲の通し番号 (1始まり) */
  globalThrowNumber: number;
  plannedThrowCount: number;
}

/** 着弾と狙いから派生データを計算する */
export function deriveThrow(
  target: TargetDefinition,
  landing: LandingRecord,
  ctx: DeriveContext
): DerivedRecord {
  const exactHit = isExactHit(target, landing);
  const sameSetAsPrevious = ctx.sameSetAsPrevious ?? false;
  // セットの1投目は、前セットとのターゲット差を「切替直後」に数えない。
  const targetChangedFromPrevious =
    sameSetAsPrevious &&
    ctx.previousTarget != null &&
    !isSameTarget(ctx.previousTarget, target);
  const sessionProgress =
    ctx.plannedThrowCount > 0
      ? ctx.globalThrowNumber / ctx.plannedThrowCount
      : 0;

  const base: DerivedRecord = {
    exactHit,
    targetChangedFromPrevious,
    previousThrowWasHit: sameSetAsPrevious ? ctx.previousWasHit : undefined,
    sameSetAsPrevious,
    previousThrowWasHitInSameSet: sameSetAsPrevious ? ctx.previousWasHit : undefined,
    sameTargetAsPrevious: sameSetAsPrevious && ctx.previousTarget != null
      ? !targetChangedFromPrevious
      : undefined,
    sessionProgress,
  };

  // フリーターゲット(狙う場所が自由なグルーピングラウンド等): 代表点が
  // 存在しないため、固定点への誤差・ズレ方向は記録しない(座標は残る)
  const isFreeTarget =
    target.type === "custom_selection" && (target.areas?.length ?? 0) === 0;
  if (isFreeTarget) return base;

  if (landing.x != null && landing.y != null) {
    const errorX = landing.x - target.representativePoint.x;
    const errorY = landing.y - target.representativePoint.y;
    const errorDistance = Math.hypot(errorX, errorY);
    const { angleDeg } = toPolar(errorX, errorY);
    return {
      ...base,
      errorX,
      errorY,
      errorDistance,
      errorAngleDeg: errorDistance === 0 ? 0 : angleDeg,
      missDirection: classifyMissDirection(errorX, errorY),
    };
  }

  // 座標なし: アウトボード方向のみの場合は方向だけ記録する
  const missDirection = outboardDirectionToMiss(landing.outboardDirection);
  if (missDirection) {
    return { ...base, missDirection };
  }
  return base;
}
