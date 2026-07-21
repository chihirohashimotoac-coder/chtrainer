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
import { isGroupingOnlyTarget } from "./targets";

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

function isGroupingOnly(t: ThrowRecord): boolean {
  return isGroupingOnlyTarget(t.target);
}

function isScorable(t: ThrowRecord): boolean {
  return !isGroupingOnly(t);
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
  const scorable = throws.filter(isScorable);
  const hits = scorable.filter((t) => t.derived.exactHit).length;
  const outs = throws.filter(isOutboard).length;
  return {
    throwCount: count,
    scorableThrows: scorable.length,
    hitCount: hits,
    hitRate: scorable.length > 0 ? hits / scorable.length : undefined,
    averageErrorDistance: mean(errorDistances(throws)),
    outboardCount: outs,
    outboardRate: count > 0 ? outs / count : undefined,
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
  const scorable = throws.filter(isScorable);
  const hits = scorable.filter((t) => t.derived.exactHit).length;
  const outs = throws.filter(isOutboard).length;
  return {
    throwCount: count,
    scorableThrows: scorable.length,
    hitCount: hits,
    hitRate: scorable.length > 0 ? hits / scorable.length : undefined,
    averageErrorDistance: mean(errorDistances(throws)),
    outboardCount: outs,
    outboardRate: count > 0 ? outs / count : undefined,
  };
}

/**
 * クリケット換算のマーク数 (T=3, D=2, S=1, インナーブル=2, アウターブル=1)。
 * 狙いのナンバーと異なるナンバーへの着弾は0マーク。
 */
export function markValue(t: ThrowRecord): number {
  const target = t.target;
  const landing = t.landing;
  if (target.type === "bull_any") {
    if (landing.ring === "inner_bull") return 2;
    if (landing.ring === "outer_bull") return 1;
    return 0;
  }
  if (target.number == null || landing.number !== target.number) return 0;
  switch (landing.ring) {
    case "triple":
      return 3;
    case "double":
      return 2;
    case "inner_single":
    case "outer_single":
      return 1;
    default:
      return 0;
  }
}

/** クリケット専用統計を計算する */
export function calculateCricketStats(
  throws: readonly ThrowRecord[]
): import("../types/models").CricketStats {
  const marks = throws.map((t) => ({ t, m: markValue(t) }));
  const totalMarks = marks.reduce((a, x) => a + x.m, 0);
  const count = throws.length;
  const byTarget: import("../types/models").CricketStats["byTarget"] = {};
  for (const { t } of marks) {
    if (!byTarget[t.target.label]) {
      byTarget[t.target.label] = {
        throwCount: 0,
        totalMarks: 0,
        marksPerThreeDarts: 0,
        effectiveMarkRate: 0,
        noMarkRate: 0,
      };
    }
  }
  for (const label of Object.keys(byTarget)) {
    const group = marks.filter((x) => x.t.target.label === label);
    const groupMarks = group.reduce((a, x) => a + x.m, 0);
    const noMarks = group.filter((x) => x.m === 0).length;
    byTarget[label] = {
      throwCount: group.length,
      totalMarks: groupMarks,
      marksPerThreeDarts:
        group.length > 0 ? (groupMarks / group.length) * 3 : 0,
      effectiveMarkRate: group.length > 0 ? (group.length - noMarks) / group.length : 0,
      noMarkRate: group.length > 0 ? noMarks / group.length : 0,
    };
  }
  const noMarkCount = marks.filter((x) => x.m === 0).length;
  const transitionStats = (
    group: readonly { t: ThrowRecord; m: number }[]
  ): import("../types/models").CricketTransitionStats => {
    const groupMarks = group.reduce((sum, item) => sum + item.m, 0);
    if (group.length === 0) return { throwCount: 0, totalMarks: 0 };
    return {
      throwCount: group.length,
      totalMarks: groupMarks,
      marksPerDart: groupMarks / group.length,
      noMarkRate: group.filter((item) => item.m === 0).length / group.length,
    };
  };
  const withinSet = marks.filter(({ t }) => t.derived.sameSetAsPrevious === true);
  return {
    totalMarks,
    marksPerThreeDarts: count > 0 ? (totalMarks / count) * 3 : undefined,
    effectiveMarkRate: count > 0 ? (count - noMarkCount) / count : undefined,
    noMarkRate: count > 0 ? noMarkCount / count : undefined,
    byTarget,
    continuity: {
      sameTarget: transitionStats(
        withinSet.filter(({ t }) => t.derived.sameTargetAsPrevious === true)
      ),
      afterSwitch: transitionStats(
        withinSet.filter(({ t }) => t.derived.targetChangedFromPrevious === true)
      ),
    },
  };
}

/** 01練習専用統計を計算する */
export function calculateZeroOneStats(
  throws: readonly ThrowRecord[]
): import("../types/models").ZeroOneStats {
  const bulls = throws.filter((t) => t.target.type === "bull_any");
  const triples = throws.filter((t) => t.target.ring === "triple");
  const doubles = throws.filter((t) => t.target.ring === "double");
  const rate = (group: readonly ThrowRecord[]) =>
    group.length > 0
      ? group.filter((t) => t.derived.exactHit).length / group.length
      : undefined;
  // セット単位: 3投すべて命中したセットの割合(フィニッシュ成立率)
  const bySet = new Map<string, ThrowRecord[]>();
  for (const t of throws) {
    const list = bySet.get(t.setId) ?? [];
    list.push(t);
    bySet.set(t.setId, list);
  }
  const fullSets = [...bySet.values()].filter((set) => set.length === 3);
  const allHitSets = fullSets.filter((set) =>
    set.every((t) => t.derived.exactHit)
  );
  return {
    bullThrowCount: bulls.length,
    bullHitRate: rate(bulls),
    tripleThrowCount: triples.length,
    tripleHitRate: rate(triples),
    doubleThrowCount: doubles.length,
    doubleHitRate: rate(doubles),
    allHitSetRate:
      fullSets.length > 0 ? allHitSets.length / fullSets.length : undefined,
  };
}

/**
 * セッションの基本統計を計算する。
 * 内部値は丸めない(表示時にのみ丸める)。
 * mode を渡すとモード専用統計(クリケット/01)も付与する。
 */
export function calculateStatistics(
  sessionId: UUID,
  plannedThrowCount: number,
  throws: readonly ThrowRecord[],
  mode?: string,
  calculatedAt: string = nowIso()
): SessionStatistics {
  const sorted = throws
    .slice()
    .sort((a, b) => a.globalThrowNumber - b.globalThrowNumber);
  const completed = sorted.length;
  const scorable = sorted.filter(isScorable);
  const groupingOnly = sorted.filter(isGroupingOnly);
  const hits = scorable.filter((t) => t.derived.exactHit).length;
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
        outboardCount: 0,
      };
    }
  }
  for (const label of Object.keys(byTarget)) {
    const group = sorted.filter((t) => t.target.label === label);
    const targetScorable = group.filter(isScorable);
    const hitCount = targetScorable.filter((t) => t.derived.exactHit).length;
    byTarget[label] = {
      label,
      throwCount: group.length,
      scorableThrows: targetScorable.length,
      hitCount,
      hitRate:
        targetScorable.length > 0 ? hitCount / targetScorable.length : undefined,
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

  const groupingSets = new Map<string, ThrowRecord[]>();
  for (const dart of groupingOnly) {
    const list = groupingSets.get(dart.setId) ?? [];
    list.push(dart);
    groupingSets.set(dart.setId, list);
  }
  const pairDistances: number[] = [];
  const perSet: { maxPairDistance: number; averagePairDistance: number }[] = [];
  const d1d2List: number[] = [];
  const d2d3List: number[] = [];
  const d1d3List: number[] = [];
  let validSetCount = 0;
  let hasNonCoordinate = false;
  const groupingReasons = new Set<NonNullable<NonNullable<SessionStatistics["grouping"]>["unavailableReasons"]>[number]>();
  for (const set of groupingSets.values()) {
    if (set.length < 3) groupingReasons.add("fewer_than_three_throws");
    if (set.some((dart) => dart.landing.ring === "bounce_out")) {
      groupingReasons.add("bounce_out");
    }
    if (set.some((dart) => dart.landing.ring === "outboard")) {
      groupingReasons.add("outboard");
    }
    if (set.some((dart) => dart.landing.ring === "unknown")) {
      groupingReasons.add("unknown_position");
    }
    if (set.some((dart) => dart.landing.positionPrecision === "segment_approximation")) {
      groupingReasons.add("segment_approximation");
    }
    if (
      set.some(
        (dart) =>
          dart.landing.ring === "bounce_out" ||
          dart.landing.ring === "outboard" ||
          dart.landing.ring === "unknown"
      )
    ) {
      hasNonCoordinate = true;
      continue;
    }
    if (set.some((dart) => dart.landing.positionPrecision !== "coordinate")) {
      hasNonCoordinate = true;
      if (
        set.some(
          (dart) =>
            dart.landing.positionPrecision !== "segment_approximation" &&
            dart.landing.ring !== "bounce_out" &&
            dart.landing.ring !== "outboard"
        )
      ) {
        groupingReasons.add("unknown_position");
      }
      continue;
    }
    if (set.length < 3 || set.some((dart) => dart.landing.x == null || dart.landing.y == null)) {
      if (set.some((dart) => dart.landing.x == null || dart.landing.y == null)) {
        groupingReasons.add("unknown_position");
      }
      continue;
    }
    validSetCount += 1;
    // 投順どおりに並べて投順間距離(1→2, 2→3, 1→3)を測る
    const ordered = set.slice().sort((a, b) => a.dartInSet - b.dartInSet);
    const dist = (a: ThrowRecord, b: ThrowRecord) =>
      Math.hypot(
        (a.landing.x ?? 0) - (b.landing.x ?? 0),
        (a.landing.y ?? 0) - (b.landing.y ?? 0)
      );
    const setPairs: number[] = [];
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        setPairs.push(dist(ordered[i]!, ordered[j]!));
      }
    }
    pairDistances.push(...setPairs);
    perSet.push({
      maxPairDistance: Math.max(...setPairs),
      averagePairDistance: mean(setPairs) ?? 0,
    });
    if (ordered.length === 3) {
      d1d2List.push(dist(ordered[0]!, ordered[1]!));
      d2d3List.push(dist(ordered[1]!, ordered[2]!));
      d1d3List.push(dist(ordered[0]!, ordered[2]!));
    }
  }
  if (validSetCount === 0) {
    groupingReasons.add("no_valid_three_dart_coordinate_set");
  }
  const groupingStatus = validSetCount > 0 ? "available" : hasNonCoordinate ? "unavailable_non_coordinate" : "insufficient_data";
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    totalThrows: plannedThrowCount,
    completedThrows: completed,
    exactHits: hits,
    scorableThrows: scorable.length,
    scorableExactHitRate:
      scorable.length > 0 ? hits / scorable.length : undefined,
    groupingOnlyThrows: groupingOnly.length,
    errorSampleCount: computeErrorStats(sorted).sampleCount,
    exactHitRate: scorable.length > 0 ? hits / scorable.length : undefined,
    outboardCount: outboards,
    outboardRate: completed > 0 ? outboards / completed : undefined,
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
    ...(mode === "cricket" ? { cricket: calculateCricketStats(sorted) } : {}),
    ...(mode === "zero_one" ? { zeroOne: calculateZeroOneStats(sorted) } : {}),
    ...(groupingOnly.length > 0 ? { grouping: {
      status: groupingStatus,
      validSetCount,
      groupingThrowCount: validSetCount * 3,
      unavailableReasons: [...groupingReasons],
      averagePairDistance: mean(pairDistances),
      maximumPairDistance: pairDistances.length > 0 ? Math.max(...pairDistances) : undefined,
      medianPairDistance: median(pairDistances),
      perSet,
      averageDiameter: mean(perSet.map((x) => x.maxPairDistance)),
      medianDiameter: median(perSet.map((x) => x.maxPairDistance)),
      // 前半・後半グルーピング径: perSet は「3投すべてに詳細座標がある
      // グルーピング評価対象セット」だけを、セット番号順(=投擲順)で抽出した列。
      // これを実施順で半分に割り、奇数のときは前半を1セット多くする(ceil)。
      // 各区間はセット内最大距離(グルーピング径)の平均。分母0なら mean が undefined(N/A)。
      firstHalfAverageDiameter: mean(
        perSet.slice(0, Math.ceil(perSet.length / 2)).map((x) => x.maxPairDistance)
      ),
      secondHalfAverageDiameter: mean(
        perSet.slice(Math.ceil(perSet.length / 2)).map((x) => x.maxPairDistance)
      ),
      interDartDistances: {
        d1d2: mean(d1d2List),
        d2d3: mean(d2d3List),
        d1d3: mean(d1d3List),
      },
    } } : {}),
    calculatedAt,
  };
}
