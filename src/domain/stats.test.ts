import { describe, expect, it } from "vitest";
import {
  calculateCricketStats,
  calculateStatistics,
  calculateZeroOneStats,
  markValue,
  mean,
  median,
} from "./stats";
import { buildThrows, handComputedThrows, mixedPrecisionThrows, T20, D16 } from "../test/fixtures";
import { STEEL_BOARD } from "../config/boardProfiles";
import { landingFromCoordinate, landingFromSegment } from "../domain/landing";
import { makeBullAnyTarget, makeSegmentTarget } from "../domain/targets";

describe("mean / median (平均値・中央値)", () => {
  it("空配列はundefined", () => {
    expect(mean([])).toBeUndefined();
    expect(median([])).toBeUndefined();
  });
  it("平均値", () => {
    expect(mean([1, 2, 3, 4])).toBeCloseTo(2.5);
  });
  it("中央値(奇数個)", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("中央値(偶数個)", () => {
    expect(median([4, 1, 3, 2])).toBeCloseTo(2.5);
  });
});

describe("calculateStatistics (手計算値との照合)", () => {
  const throws = handComputedThrows();
  const stats = calculateStatistics("session-1", 6, throws);

  it("全体集計", () => {
    expect(stats.totalThrows).toBe(6);
    expect(stats.completedThrows).toBe(6);
    expect(stats.exactHits).toBe(1);
    expect(stats.exactHitRate).toBeCloseTo(1 / 6);
    expect(stats.outboardCount).toBe(1);
    expect(stats.outboardRate).toBeCloseTo(1 / 6);
    expect(stats.bounceOutCount).toBe(1);
  });

  it("入力方式の内訳", () => {
    // 座標入力4投 + 方向のみ1投 + 不明1投
    expect(stats.coordinateInputCount).toBe(4);
    expect(stats.approximateInputCount).toBe(0);
  });

  it("誤差統計 (平均0.15、中央値0.15)", () => {
    expect(stats.coordinateError.sampleCount).toBe(4);
    expect(stats.coordinateError.averageErrorDistance).toBeCloseTo(0.15);
    expect(stats.coordinateError.medianErrorDistance).toBeCloseTo(0.15);
    // 平均誤差X = (0 + 0.1 + 0 - 0.3)/4 = -0.05
    expect(stats.coordinateError.averageErrorX).toBeCloseTo(-0.05);
    // 平均誤差Y = (0 + 0 + 0.2 + 0)/4 = 0.05
    expect(stats.coordinateError.averageErrorY).toBeCloseTo(0.05);
  });

  it("方向別集計 (中心1・右1・上2・左1)", () => {
    expect(stats.byDirection.center).toBe(1);
    expect(stats.byDirection.right).toBe(1);
    expect(stats.byDirection.up).toBe(2); // 座標の上1 + 方向のみの上1
    expect(stats.byDirection.left).toBe(1);
    expect(stats.byDirection.down).toBe(0);
  });

  it("投順別集計", () => {
    // 1投目: throw1(命中), throw4(左0.3) → 命中率1/2
    expect(stats.byDartInSet["1"].throwCount).toBe(2);
    expect(stats.byDartInSet["1"].hitCount).toBe(1);
    expect(stats.byDartInSet["1"].hitRate).toBeCloseTo(0.5);
    expect(stats.byDartInSet["1"].averageErrorDistance).toBeCloseTo(0.15);
    // 3投目: throw3(上0.2), throw6(アウトボード方向のみ)
    expect(stats.byDartInSet["3"].throwCount).toBe(2);
    expect(stats.byDartInSet["3"].outboardCount).toBe(1);
    expect(stats.byDartInSet["3"].outboardRate).toBeCloseTo(0.5);
  });

  it("ターゲット別集計", () => {
    const t20 = stats.byTarget["T20"];
    expect(t20).toBeDefined();
    expect(t20?.throwCount).toBe(6);
    expect(t20?.hitCount).toBe(1);
    expect(t20?.hitRate).toBeCloseTo(1 / 6);
    // 外れ方向の最頻: 上2回 (右1・左1)
    expect(t20?.mainMissDirection).toBe("up");
  });

  it("前半・後半集計 (前半3投・後半3投)", () => {
    expect(stats.firstHalf.throwCount).toBe(3);
    expect(stats.secondHalf.throwCount).toBe(3);
    expect(stats.firstHalf.hitCount).toBe(1);
    expect(stats.firstHalf.hitRate).toBeCloseTo(1 / 3);
    // 前半誤差 = (0 + 0.1 + 0.2)/3 = 0.1
    expect(stats.firstHalf.averageErrorDistance).toBeCloseTo(0.1);
    // 後半誤差 = 0.3のみ
    expect(stats.secondHalf.averageErrorDistance).toBeCloseTo(0.3);
    expect(stats.secondHalf.outboardCount).toBe(1);
  });
});

describe("座標入力と簡易入力の分離", () => {
  const stats = calculateStatistics("session-1", 3, mixedPrecisionThrows());
  it("座標のみの統計と概算込みの統計を分ける", () => {
    expect(stats.coordinateInputCount).toBe(1);
    expect(stats.approximateInputCount).toBe(2);
    expect(stats.coordinateError.sampleCount).toBe(1);
    expect(stats.combinedError.sampleCount).toBe(3);
  });
});

describe("クリケット統計 (マーク換算)", () => {
  const bull = makeBullAnyTarget();
  // T20狙い: T20(3), S20(1), S5(0=別ナンバー) / Bull狙い: IB(2), OB(1), S20(0)
  const throws = buildThrows(
    [
      { target: T20, landing: landingFromSegment("triple", STEEL_BOARD, 20) },
      { target: T20, landing: landingFromSegment("outer_single", STEEL_BOARD, 20) },
      { target: T20, landing: landingFromSegment("outer_single", STEEL_BOARD, 5) },
      { target: bull, landing: landingFromSegment("inner_bull", STEEL_BOARD) },
      { target: bull, landing: landingFromSegment("outer_bull", STEEL_BOARD) },
      { target: bull, landing: landingFromSegment("outer_single", STEEL_BOARD, 20) },
    ],
    6
  );

  it("markValue: T=3, S=1, 別ナンバー=0, IB=2, OB=1", () => {
    expect(throws.map((t) => markValue(t))).toEqual([3, 1, 0, 2, 1, 0]);
  });

  it("MPR相当・有効マーク率・ノーマーク率", () => {
    const c = calculateCricketStats(throws);
    expect(c.totalMarks).toBe(7);
    // 7マーク / 6投 × 3 = 3.5
    expect(c.marksPerThreeDarts).toBeCloseTo(3.5);
    expect(c.effectiveMarkRate).toBeCloseTo(4 / 6);
    expect(c.noMarkRate).toBeCloseTo(2 / 6);
    expect(c.byTarget["T20"]?.totalMarks).toBe(4);
    expect(c.byTarget["T20"]?.marksPerThreeDarts).toBeCloseTo(4);
    expect(c.byTarget["T20"]?.effectiveMarkRate).toBeCloseTo(2 / 3);
    expect(c.byTarget["Bull"]?.totalMarks).toBe(3);
  });

  it("mode=cricket でセッション統計に付与される", () => {
    const stats = calculateStatistics("s", 6, throws, "cricket");
    expect(stats.cricket).toBeDefined();
    const statsNoMode = calculateStatistics("s", 6, throws);
    expect(statsNoMode.cricket).toBeUndefined();
  });

  it("同一継続とセット内切替直後を独立集計し、セット先頭を除外する", () => {
    const t19 = makeSegmentTarget("triple", STEEL_BOARD, 19);
    const mixed = buildThrows([
      { target: T20, landing: landingFromSegment("triple", STEEL_BOARD, 20) },
      { target: T20, landing: landingFromSegment("outer_single", STEEL_BOARD, 20) },
      { target: t19, landing: landingFromSegment("triple", STEEL_BOARD, 19) },
      { target: T20, landing: landingFromSegment("triple", STEEL_BOARD, 20) },
      { target: t19, landing: landingFromSegment("outer_single", STEEL_BOARD, 19) },
      { target: t19, landing: landingFromSegment("triple", STEEL_BOARD, 19) },
    ], 6);
    const c = calculateCricketStats(mixed);
    expect(c.continuity.sameTarget.throwCount).toBe(2);
    expect(c.continuity.sameTarget.totalMarks).toBe(4);
    expect(c.continuity.afterSwitch.throwCount).toBe(2);
    expect(c.continuity.afterSwitch.totalMarks).toBe(4);
    expect(mixed[3]?.derived.sameSetAsPrevious).toBe(false);
    expect(mixed[3]?.derived.targetChangedFromPrevious).toBe(false);
  });

  it("切替サンプル0件は未測定値としてundefinedを保持する", () => {
    const sameTargetOnly = buildThrows([
      { target: T20, landing: landingFromSegment("triple", STEEL_BOARD, 20) },
      { target: T20, landing: landingFromSegment("triple", STEEL_BOARD, 20) },
      { target: T20, landing: landingFromSegment("triple", STEEL_BOARD, 20) },
    ], 3);
    const c = calculateCricketStats(sameTargetOnly);
    expect(c.continuity.afterSwitch).toEqual({ throwCount: 0, totalMarks: 0 });
    expect(c.continuity.afterSwitch.marksPerDart).toBeUndefined();
  });
});

describe("01統計", () => {
  // セット1: T20全命中 / セット2: D16へ2命中1外し
  const rep20 = T20.representativePoint;
  const rep16 = D16.representativePoint;
  const throws = buildThrows(
    [
      { target: T20, landing: landingFromCoordinate(rep20.x, rep20.y, STEEL_BOARD) },
      { target: T20, landing: landingFromCoordinate(rep20.x, rep20.y, STEEL_BOARD) },
      { target: T20, landing: landingFromCoordinate(rep20.x, rep20.y, STEEL_BOARD) },
      { target: D16, landing: landingFromCoordinate(rep16.x, rep16.y, STEEL_BOARD) },
      { target: D16, landing: landingFromCoordinate(rep16.x, rep16.y, STEEL_BOARD) },
      { target: D16, landing: landingFromCoordinate(0, 0, STEEL_BOARD) },
    ],
    6
  );

  it("トリプル/ダブル命中率とフィニッシュ成立率", () => {
    const z = calculateZeroOneStats(throws);
    expect(z.tripleThrowCount).toBe(3);
    expect(z.tripleHitRate).toBeCloseTo(1);
    expect(z.doubleThrowCount).toBe(3);
    expect(z.doubleHitRate).toBeCloseTo(2 / 3);
    // セット1は3投全命中、セット2は2/3 → 成立率 1/2
    expect(z.allHitSetRate).toBeCloseTo(0.5);
  });

  it("mode=zero_one でセッション統計に付与される", () => {
    const stats = calculateStatistics("s", 6, throws, "zero_one");
    expect(stats.zeroOne).toBeDefined();
    expect(stats.zeroOne?.doubleHitRate).toBeCloseTo(2 / 3);
  });
});

describe("データ不足時の挙動", () => {
  it("0投でもゼロ除算しない", () => {
    const stats = calculateStatistics("session-1", 60, []);
    expect(stats.exactHitRate).toBe(0);
    expect(stats.outboardRate).toBe(0);
    expect(stats.coordinateError.averageErrorDistance).toBeUndefined();
    expect(stats.firstHalf.throwCount).toBe(0);
  });

  it("セッション中断(計画60投中6投)でも統計が出る", () => {
    const stats = calculateStatistics("session-1", 60, handComputedThrows());
    expect(stats.totalThrows).toBe(60);
    expect(stats.completedThrows).toBe(6);
    expect(stats.exactHitRate).toBeCloseTo(1 / 6);
  });
});

describe("命中判定対象とグルーピングの分離", () => {
  it("v1の自由選択R1もラベルに依存せず命中率から除外する", () => {
    const legacyGroupingTarget = {
      ...T20,
      id: "legacy-r1",
      label: "locale-independent legacy target",
      type: "custom_selection" as const,
      areas: [],
    };
    const records = buildThrows([{ target: legacyGroupingTarget, landing: landingFromCoordinate(0, 0, STEEL_BOARD) }], 1);
    const result = calculateStatistics("legacy", 1, records, "skill_check");
    expect(result.groupingOnlyThrows).toBe(1);
    expect(result.scorableThrows).toBe(0);
  });
  it("R1の15投を除外し3/45を命中率とする", () => {
    const groupingTarget = { ...T20, id: "grouping", evaluationKind: "grouping_only" as const, roundId: "skill-r1", roundKind: "grouping" as const, requiredInputPrecision: "coordinate" as const };
    const specs = Array.from({ length: 60 }, (_, index) => ({
      target: index < 15 ? groupingTarget : T20,
      landing: landingFromCoordinate(
        T20.representativePoint.x + (index >= 18 ? 0.2 : 0),
        T20.representativePoint.y,
        STEEL_BOARD
      ),
    }));
    const records = buildThrows(specs, 60);
    records.forEach((record, index) => {
      record.derived.exactHit = index >= 15 && index < 18;
    });
    const stats = calculateStatistics("skill", 60, records, "skill_check");
    expect(stats.completedThrows).toBe(60);
    expect(stats.groupingOnlyThrows).toBe(15);
    expect(stats.scorableThrows).toBe(45);
    expect(stats.exactHits).toBe(3);
    expect(stats.scorableExactHitRate).toBeCloseTo(3 / 45);
    expect(stats.exactHitRate).toBeCloseTo(3 / 45);
    expect(stats.byDartInSet["1"].scorableThrows).toBe(15);
  });

  it("簡易入力のR1は精密グルーピング分析不能", () => {
    const target = { ...T20, evaluationKind: "grouping_only" as const };
    const records = buildThrows(Array.from({ length: 3 }, () => ({
      target,
      landing: landingFromSegment("triple", STEEL_BOARD, 20),
      setId: "r1-set",
    })), 3);
    const stats = calculateStatistics("skill", 3, records, "skill_check");
    expect(stats.grouping?.status).toBe("unavailable_non_coordinate");
    expect(stats.grouping?.averagePairDistance).toBeUndefined();
    expect(stats.grouping?.unavailableReasons).toEqual(
      expect.arrayContaining([
        "segment_approximation",
        "no_valid_three_dart_coordinate_set",
      ])
    );
  });
});
