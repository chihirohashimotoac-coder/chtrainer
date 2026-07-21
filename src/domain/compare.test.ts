import { describe, expect, it } from "vitest";
import { fixtureSession, handComputedThrows } from "../test/fixtures";
import { calculateStatistics } from "./stats";
import {
  compareStatistics,
  isDissimilarComparison,
  rankComparisonCandidates,
  rankDissimilarCandidates,
} from "./compare";

describe("比較候補のスコアリング形式対応", () => {
  const base = fixtureSession({
    id: "base",
    trainingMode: "skill_check",
    scoringStyle: "fit_bull",
    startedAt: "2026-07-01T10:00:00.000Z",
  });
  const sameStyle = fixtureSession({
    id: "same-style",
    trainingMode: "skill_check",
    scoringStyle: "fit_bull",
    startedAt: "2026-06-01T10:00:00.000Z",
  });
  const otherStyle = fixtureSession({
    id: "other-style",
    trainingMode: "skill_check",
    scoringStyle: "steel",
    startedAt: "2026-06-30T10:00:00.000Z",
  });

  it("同じスコアリング形式のセッションを優先する", () => {
    const ranked = rankComparisonCandidates(base, [otherStyle, sameStyle]);
    expect(ranked[0]?.session.id).toBe("same-style");
    expect(ranked[0]?.reasons).toContain("同じスコアリング形式");
    expect(ranked[1]?.reasons).not.toContain("同じスコアリング形式");
  });

  it("形式未記録の旧セッションには形式ボーナスを与えない", () => {
    const legacy = fixtureSession({
      id: "legacy",
      trainingMode: "skill_check",
      startedAt: "2026-06-01T10:00:00.000Z",
    });
    const ranked = rankComparisonCandidates(base, [legacy]);
    expect(ranked[0]?.reasons).not.toContain("同じスコアリング形式");
  });

  it("形式が異なる比較は「条件が大きく異なる」と判定する", () => {
    expect(isDissimilarComparison(base, otherStyle)).toBe(true);
    expect(isDissimilarComparison(base, sameStyle)).toBe(false);
    // 片方が未記録(旧データ)の場合は形式差では非類似としない
    const legacy = fixtureSession({
      id: "legacy",
      trainingMode: "skill_check",
    });
    expect(isDissimilarComparison(base, legacy)).toBe(false);
  });
});

describe("比較候補のモード互換性", () => {
  const base = fixtureSession({
    id: "base-skill",
    trainingMode: "skill_check",
    startedAt: "2026-07-01T10:00:00.000Z",
  });
  const zeroOne = fixtureSession({
    id: "other-01",
    trainingMode: "zero_one",
    startedAt: "2026-06-30T10:00:00.000Z",
  });
  const sameMode = fixtureSession({
    id: "same-skill",
    trainingMode: "skill_check",
    startedAt: "2026-06-01T10:00:00.000Z",
  });

  it("モードが異なるセッションはおすすめ候補に含めない", () => {
    const ranked = rankComparisonCandidates(base, [zeroOne, sameMode]);
    expect(ranked.map((r) => r.session.id)).toEqual(["same-skill"]);
  });

  it("同モードが無ければおすすめ候補は空になる", () => {
    expect(rankComparisonCandidates(base, [zeroOne])).toHaveLength(0);
  });

  it("異モードは明示用の別リスト(rankDissimilarCandidates)に出る", () => {
    const dissimilar = rankDissimilarCandidates(base, [zeroOne, sameMode]);
    expect(dissimilar.map((r) => r.session.id)).toEqual(["other-01"]);
  });
});

describe("N/A統計の比較", () => {
  it("片方がN/A(分母0)なら差もN/Aになる", () => {
    // R1グルーピング相当: 命中判定対象0 → 率はundefined
    const naStats = calculateStatistics("na", 60, []);
    const normal = calculateStatistics("normal", 6, handComputedThrows());
    const c = compareStatistics(naStats, normal);
    expect(normal.exactHitRate).toBeCloseTo(1 / 6);
    expect(c.hitRate.base).toBeUndefined();
    expect(c.hitRate.other).toBeCloseTo(1 / 6);
    expect(c.hitRate.diff).toBeUndefined();
    expect(c.byDartInSet["2"].hitRate.diff).toBeUndefined();
    expect(c.firstHalfHitRate.diff).toBeUndefined();
  });

  it("両方に分母があれば0.0%側も通常どおり差を計算する", () => {
    const normal = calculateStatistics("normal", 6, handComputedThrows());
    const c = compareStatistics(normal, normal);
    expect(c.hitRate.diff).toBeCloseTo(0);
  });
});
