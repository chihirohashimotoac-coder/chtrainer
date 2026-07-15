import { SCHEMA_VERSION } from "../types/models";
import type {
  DartOrderStats,
  ErrorStats,
  HalfStats,
  MissDirection,
  SessionStatistics,
  TargetStats,
  ThrowRecord,
  UUID,
} from "../types/models";
import { nowIso } from "../utils/id";

export function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export const ALL_DIRECTIONS: MissDirection[] = [
  "center",
  "up",
  "up_right",
  "right",
  "down_right",
  "down",
  "down_left",
  "left",
  "up_left",
];

function emptyDirectionRecord(): Record<MissDirection, number> {
  const rec = {} as Record<MissDirection, number>;
  for (const d of ALL_DIRECTIONS) rec[d] = 0;
  return rec;
}

function isOutboard(t: ThrowRecord): boolean {
  return t.landing.ring === "outboard";
}

function isBounceOut(t: ThrowRecord): boolean {
  return t.landing.ring === "bounce_out";
}

function errorDistances(throws: readonly ThrowRecord[]): number[] {
  return throws
    .map((t) => t.derived.errorDistance)
    .filter((d): d is number => d != null);
}

function computeErrorStats(throws: readonly ThrowRecord[]): ErrorStats {
  const withError = throws.filter((t) => t.derived.errorDistance != null);
  const xs = withError
    .map((t) => t.derived.errorX)
    .filter((v): v is number => v != null);
  const ys = withError
    .map((t) => t.derived.errorY)
    .filter((v): v is number => v != null);
  const byDirection = emptyDirectionRecord();
  for (const t of throws) {
    const dir = t.derived.missDirection;
    if (dir) byDirection[dir] += 1;
  }
  return {
    sampleCount: withError.length,
    averageErrorDistance: mean(errorDistances(withError)),
    medianErrorDistance: median(errorDistances(withError)),
    averageErrorX: mean(xs),
    averageErrorY: mean(ys),
    byDirection,
  };
}

function computeDartOrderStats(throws: readonly ThrowRecord[]): DartOrderStats {
  const count = throws.length;
  const hits = throws.filter((t) => t.derived.exactHit).length;
  const outs = throws.filter(isOutboard).length;
  return {
    throwCount: count,
    hitCount: hits,
    hitRate: count > 0 ? hits / count : 0,
    averageErrorDistance: mean(errorDistances(throws)),
    outboardCount: outs,
    outboardRate: count > 0 ? outs / count : 0,
  };
}

function mainDirection(
  throws: readonly ThrowRecord[]
): MissDirection | undefined {
  const counts = emptyDirectionRecord();
  let total = 0;
  for (const t of throws) {
    const dir = t.derived.missDirection;
    if (dir && dir !== "center" && !t.derived.exactHit) {
      counts[dir] += 1;
      total += 1;
    }
  }
  if (total === 0) return undefined;
  let best: MissDirection | undefined;
  let bestCount = 0;
  for (const d of ALL_DIRECTIONS) {
    if (counts[d] > bestCount) {
      best = d;
      bestCount = counts[d];
    }
  }
  return best;
}

function computeHalfStats(throws: readonly ThrowRecord[]): HalfStats {
  const count = throws.length;
  const hits = throws.filter((t) => t.derived.exactHit).length;
  const outs = throws.filter(isOutboard).length;
  return {
    throwCount: count,
    hitCount: hits,
    hitRate: count > 0 ? hits / count : 0,
    averageErrorDistance: mean(errorDistances(throws)),
    outboardCount: outs,
    outboardRate: count > 0 ? outs / count : 0,
  };
}

/**
 * セッションの基本統計を計算する。
 * 内部値は丸めない(表示時にのみ丸める)。
 */
export function calculateStatistics(
  sessionId: UUID,
  plannedThrowCount: number,
  throws: readonly ThrowRecord[]
): SessionStatistics {
  const sorted = throws
    .slice()
    .sort((a, b) => a.globalThrowNumber - b.globalThrowNumber);
  const completed = sorted.length;
  const hits = sorted.filter((t) => t.derived.exactHit).length;
  const outboards = sorted.filter(isOutboard).length;
  const bounceOuts = sorted.filter(isBounceOut).length;
  const coordinateThrows = sorted.filter(
    (t) => t.landing.positionPrecision === "coordinate"
  );
  const approxThrows = sorted.filter(
    (t) => t.landing.positionPrecision === "segment_approximation"
  );

  const byDartInSet = {
    "1": computeDartOrderStats(sorted.filter((t) => t.dartInSet === 1)),
    "2": computeDartOrderStats(sorted.filter((t) => t.dartInSet === 2)),
    "3": computeDartOrderStats(sorted.filter((t) => t.dartInSet === 3)),
  };

  const byTarget: Record<string, TargetStats> = {};
  for (const t of sorted) {
    const label = t.target.label;
    if (!byTarget[label]) {
      byTarget[label] = {
        label,
        throwCount: 0,
        hitCount: 0,
        hitRate: 0,
        outboardCount: 0,
      };
    }
  }
  for (const label of Object.keys(byTarget)) {
    const group = sorted.filter((t) => t.target.label === label);
    const hitCount = group.filter((t) => t.derived.exactHit).length;
    byTarget[label] = {
      label,
      throwCount: group.length,
      hitCount,
      hitRate: group.length > 0 ? hitCount / group.length : 0,
      averageErrorDistance: mean(errorDistances(group)),
      mainMissDirection: mainDirection(group),
      outboardCount: group.filter(isOutboard).length,
    };
  }

  const byDirection = emptyDirectionRecord();
  for (const t of sorted) {
    const dir = t.derived.missDirection;
    if (dir) byDirection[dir] += 1;
  }

  // 前半・後半は「完了した投擲」を投擲順で半分に割る(奇数は前半に多く)
  const halfIndex = Math.ceil(completed / 2);
  const firstHalf = computeHalfStats(sorted.slice(0, halfIndex));
  const secondHalf = computeHalfStats(sorted.slice(halfIndex));

  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    totalThrows: plannedThrowCount,
    completedThrows: completed,
    exactHits: hits,
    exactHitRate: completed > 0 ? hits / completed : 0,
    outboardCount: outboards,
    outboardRate: completed > 0 ? outboards / completed : 0,
    bounceOutCount: bounceOuts,
    coordinateInputCount: coordinateThrows.length,
    approximateInputCount: approxThrows.length,
    coordinateError: computeErrorStats(coordinateThrows),
    combinedError: computeErrorStats(sorted),
    byDartInSet,
    byTarget,
    byDirection,
    firstHalf,
    secondHalf,
    calculatedAt: nowIso(),
  };
}
