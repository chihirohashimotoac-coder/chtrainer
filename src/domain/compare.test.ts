import { describe, expect, it } from "vitest";
import { fixtureSession } from "../test/fixtures";
import { isDissimilarComparison, rankComparisonCandidates } from "./compare";

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
