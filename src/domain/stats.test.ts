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
import { SOFT_BOARD, STEEL_BOARD } from "../config/boardProfiles";
import { landingFromCoordinate, landingFromSegment, landingBounceOut } from "../domain/landing";
import { makeBullAnyTarget, makeSegmentTarget } from "../domain/targets";
import { buildSkillCheckPlan } from "../domain/skillCheck";

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
  it("0投なら率は0ではなくN/A(undefined)になる", () => {
    const stats = calculateStatistics("session-1", 60, []);
    expect(stats.exactHitRate).toBeUndefined();
    expect(stats.scorableExactHitRate).toBeUndefined();
    expect(stats.outboardRate).toBeUndefined();
    expect(stats.coordinateError.averageErrorDistance).toBeUndefined();
    expect(stats.firstHalf.throwCount).toBe(0);
    expect(stats.firstHalf.hitRate).toBeUndefined();
    expect(stats.byDartInSet["1"].hitRate).toBeUndefined();
  });

  it("命中判定対象が存在し命中0件なら0.0%(0)を返す", () => {
    // T20狙いで全投S5へ外れる10投
    const missSpecs = Array.from({ length: 10 }, () => ({
      target: T20,
      landing: landingFromSegment("outer_single", STEEL_BOARD, 5),
    }));
    const stats = calculateStatistics(
      "session-zero",
      10,
      buildThrows(missSpecs, 10)
    );
    expect(stats.scorableThrows).toBe(10);
    expect(stats.exactHitRate).toBe(0);
  });

  it("R1グルーピング統計: セット別距離・径・前後半・投順間距離を計算する", () => {
    const groupingTarget = buildSkillCheckPlan(SOFT_BOARD, 20)[0]![0]!;
    // セットA: (0,0)(0.3,0)(0,0.4) → ペア距離 0.3 / 0.5 / 0.4
    // セットB: (0,0)(0.1,0)(0,0.1) → ペア距離 0.1 / √0.02 / 0.1
    const coords: [number, number][][] = [
      [
        [0, 0],
        [0.3, 0],
        [0, 0.4],
      ],
      [
        [0, 0],
        [0.1, 0],
        [0, 0.1],
      ],
    ];
    const throws = buildThrows(
      coords.flatMap((set, setIndex) =>
        set.map(([x, y]) => ({
          target: groupingTarget,
          setId: `g-set-${setIndex}`,
          landing: landingFromCoordinate(x, y, SOFT_BOARD),
        }))
      ),
      6
    );
    const stats = calculateStatistics("session-g", 6, throws, "skill_check");
    const g = stats.grouping!;
    expect(g.validSetCount).toBe(2);
    expect(g.groupingThrowCount).toBe(6);
    expect(g.perSet).toHaveLength(2);
    expect(g.perSet![0]!.maxPairDistance).toBeCloseTo(0.5);
    expect(g.perSet![0]!.averagePairDistance).toBeCloseTo(0.4);
    const dB = Math.hypot(0.1, 0.1);
    expect(g.perSet![1]!.maxPairDistance).toBeCloseTo(dB);
    // グルーピング径 = セット内最大距離。平均・中央値・前後半
    expect(g.averageDiameter).toBeCloseTo((0.5 + dB) / 2);
    expect(g.medianDiameter).toBeCloseTo((0.5 + dB) / 2);
    expect(g.firstHalfAverageDiameter).toBeCloseTo(0.5);
    expect(g.secondHalfAverageDiameter).toBeCloseTo(dB);
    // 投順間距離(1→2, 2→3, 1→3 の各セット平均)
    expect(g.interDartDistances?.d1d2).toBeCloseTo((0.3 + 0.1) / 2);
    expect(g.interDartDistances?.d2d3).toBeCloseTo((0.5 + dB) / 2);
    expect(g.interDartDistances?.d1d3).toBeCloseTo((0.4 + 0.1) / 2);
  });

  it("ブル反復練習(通常ターゲット)でもグルーピング実測値を出力する", () => {
    // グルーピング専用ターゲットではなく通常のBull狙いを3投×2セット反復する。
    const bull = makeBullAnyTarget();
    // セットA: (0,0)(0.3,0)(0,0.4) → ペア距離 0.3 / 0.5 / 0.4
    // セットB: (0,0)(0.1,0)(0,0.1) → ペア距離 0.1 / √0.02 / 0.1
    const coords: [number, number][][] = [
      [
        [0, 0],
        [0.3, 0],
        [0, 0.4],
      ],
      [
        [0, 0],
        [0.1, 0],
        [0, 0.1],
      ],
    ];
    const throws = buildThrows(
      coords.flatMap((set, setIndex) =>
        set.map(([x, y]) => ({
          target: bull,
          setId: `bull-set-${setIndex}`,
          landing: landingFromCoordinate(x, y, SOFT_BOARD),
        }))
      ),
      6
    );
    const stats = calculateStatistics("session-bull", 6, throws, "bull");
    // グルーピング専用投擲は存在しないが、同一ターゲット反復なので grouping が出る
    expect(stats.groupingOnlyThrows).toBe(0);
    const g = stats.grouping!;
    expect(g).toBeDefined();
    expect(g.status).toBe("available");
    expect(g.validSetCount).toBe(2);
    expect(g.groupingThrowCount).toBe(6);
    expect(g.perSet).toHaveLength(2);
    expect(g.perSet![0]!.maxPairDistance).toBeCloseTo(0.5);
    const dB = Math.hypot(0.1, 0.1);
    expect(g.averageDiameter).toBeCloseTo((0.5 + dB) / 2);
  });

  it("セット内でターゲットが変わる(ランダム出題)場合はグルーピング対象外", () => {
    // 各セットの3投が別ターゲット → グルーピングは狙いの違いに由来するため出力しない
    const bull = makeBullAnyTarget();
    const specs = [
      { target: T20, setId: "mix-set", landing: landingFromCoordinate(0, 0, SOFT_BOARD) },
      { target: D16, setId: "mix-set", landing: landingFromCoordinate(0.1, 0, SOFT_BOARD) },
      { target: bull, setId: "mix-set", landing: landingFromCoordinate(0, 0.1, SOFT_BOARD) },
    ];
    const stats = calculateStatistics("session-mix", 3, buildThrows(specs, 3), "single");
    expect(stats.grouping).toBeUndefined();
  });

  it("R1グルーピングのみのセッションは命中率が全レイヤーでN/Aになる", () => {
    const groupingTarget = buildSkillCheckPlan(SOFT_BOARD, 20)[0]![0]!;
    const throws = buildThrows(
      [0, 0.01, -0.01].map((x) => ({
        target: groupingTarget,
        setId: "r1-set",
        landing: landingFromCoordinate(x, 0, SOFT_BOARD),
      })),
      3
    );
    const stats = calculateStatistics("session-r1", 60, throws, "skill_check");
    expect(stats.scorableThrows).toBe(0);
    expect(stats.exactHitRate).toBeUndefined();
    expect(stats.byDartInSet["1"].hitRate).toBeUndefined();
    expect(stats.firstHalf.hitRate).toBeUndefined();
    expect(stats.secondHalf.hitRate).toBeUndefined();
    for (const label of Object.keys(stats.byTarget)) {
      expect(stats.byTarget[label]?.hitRate).toBeUndefined();
    }
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

describe("R1グルーピングの前半・後半(有効セットをセット番号順に分割)", () => {
  const groupingTarget = buildSkillCheckPlan(SOFT_BOARD, 20, "fat_bull")[0]![0]!;
  // 各セットを [(0,0),(d,0),(0,0)] で作ると、そのセットのグルーピング径(最大ペア距離)= d。
  // "excluded" はバウンスアウトを含み、グルーピング評価対象外になる。
  function groupingThrows(sets: (number | "excluded")[]) {
    const specs = sets.flatMap((set, i) => {
      const setId = `g-${i + 1}`;
      if (set === "excluded") {
        return [
          { target: groupingTarget, setId, landing: landingFromCoordinate(0, 0, SOFT_BOARD) },
          { target: groupingTarget, setId, landing: landingBounceOut() },
          { target: groupingTarget, setId, landing: landingFromCoordinate(0, 0, SOFT_BOARD) },
        ];
      }
      return [
        { target: groupingTarget, setId, landing: landingFromCoordinate(0, 0, SOFT_BOARD) },
        { target: groupingTarget, setId, landing: landingFromCoordinate(set, 0, SOFT_BOARD) },
        { target: groupingTarget, setId, landing: landingFromCoordinate(0, 0, SOFT_BOARD) },
      ];
    });
    return buildThrows(specs, specs.length);
  }
  const grouping = (sets: (number | "excluded")[]) =>
    calculateStatistics("g", 60, groupingThrows(sets), "skill_check").grouping!;

  it("有効セット数が偶数: 前半・後半を均等に割る", () => {
    const g = grouping([0.2, 0.4]);
    expect(g.validSetCount).toBe(2);
    expect(g.firstHalfAverageDiameter).toBeCloseTo(0.2);
    expect(g.secondHalfAverageDiameter).toBeCloseTo(0.4);
  });

  it("有効セット数が奇数: 前半を1セット多くする", () => {
    const g = grouping([0.2, 0.4, 0.6]);
    expect(g.validSetCount).toBe(3);
    // 前半 = [0.2, 0.4] の平均 = 0.3 / 後半 = [0.6]
    expect(g.firstHalfAverageDiameter).toBeCloseTo(0.3);
    expect(g.secondHalfAverageDiameter).toBeCloseTo(0.6);
  });

  it("途中に対象外セットがあると、除外後の有効セット列で分割する", () => {
    const g = grouping([0.2, "excluded", 0.6]);
    expect(g.validSetCount).toBe(2);
    expect(g.perSet).toHaveLength(2);
    expect(g.firstHalfAverageDiameter).toBeCloseTo(0.2);
    expect(g.secondHalfAverageDiameter).toBeCloseTo(0.6);
  });

  it("先頭が対象外でも、有効セット順は維持される", () => {
    const g = grouping(["excluded", 0.2, 0.4]);
    expect(g.validSetCount).toBe(2);
    expect(g.firstHalfAverageDiameter).toBeCloseTo(0.2);
    expect(g.secondHalfAverageDiameter).toBeCloseTo(0.4);
  });

  it("末尾が対象外でも、有効セット順は維持される", () => {
    const g = grouping([0.2, 0.4, "excluded"]);
    expect(g.validSetCount).toBe(2);
    expect(g.firstHalfAverageDiameter).toBeCloseTo(0.2);
    expect(g.secondHalfAverageDiameter).toBeCloseTo(0.4);
  });

  it("有効セット1件: 前半のみ、後半はN/A", () => {
    const g = grouping([0.3]);
    expect(g.validSetCount).toBe(1);
    expect(g.firstHalfAverageDiameter).toBeCloseTo(0.3);
    expect(g.secondHalfAverageDiameter).toBeUndefined();
  });

  it("有効セット0件: 前半・後半ともにN/A", () => {
    const g = grouping(["excluded"]);
    expect(g.validSetCount).toBe(0);
    expect(g.firstHalfAverageDiameter).toBeUndefined();
    expect(g.secondHalfAverageDiameter).toBeUndefined();
  });
});
