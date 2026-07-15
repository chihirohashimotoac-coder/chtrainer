import { describe, expect, it } from "vitest";
import { calculateStatistics, mean, median } from "./stats";
import { handComputedThrows, mixedPrecisionThrows } from "../test/fixtures";

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
