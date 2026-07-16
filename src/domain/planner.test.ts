import { describe, expect, it } from "vitest";
import { countByLabel, generatePlannedTargets, shuffle } from "./planner";
import { MAX_SETS, MIN_SETS } from "../config/constants";
import { validateSetCount } from "../pages/SetCountPage";
import { D16, T20 } from "../test/fixtures";
import { STEEL_BOARD } from "../config/boardProfiles";
import { makeSegmentTarget } from "./targets";

function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("generatePlannedTargets", () => {
  it("same_per_set: セット内3本とも同じ、セットごとに順番に使う", () => {
    const sets = generatePlannedTargets("same_per_set", [T20, D16], 4);
    expect(sets).toHaveLength(4);
    expect(sets[0]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
    expect(sets[1]?.map((x) => x.label)).toEqual(["D16", "D16", "D16"]);
    expect(sets[2]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
  });

  it("fixed_three: 全セットで1投目・2投目・3投目が固定", () => {
    const bull = makeSegmentTarget("inner_bull", STEEL_BOARD);
    const sets = generatePlannedTargets("fixed_three", [T20, D16, bull], 3);
    for (const set of sets) {
      expect(set.map((x) => x.label)).toEqual(["T20", "D16", "インナーブル"]);
    }
  });

  it("cycle: 登録順に1投ずつ繰り返す", () => {
    const sets = generatePlannedTargets("cycle", [T20, D16], 2);
    const flat = sets.flat().map((x) => x.label);
    expect(flat).toEqual(["T20", "D16", "T20", "D16", "T20", "D16"]);
  });

  it("balanced: 出題数が可能な限り均等", () => {
    const pool = [1, 2, 3, 4, 5].map((n) =>
      makeSegmentTarget("triple", STEEL_BOARD, n)
    );
    const sets = generatePlannedTargets("balanced", pool, 20, seededRng(42));
    // 60投 / 5ターゲット = 各12回
    const counts = countByLabel(sets);
    for (const label of ["T1", "T2", "T3", "T4", "T5"]) {
      expect(counts[label]).toBe(12);
    }
  });

  it("balanced: 割り切れない場合も差は1以内", () => {
    const pool = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      makeSegmentTarget("double", STEEL_BOARD, n)
    );
    const sets = generatePlannedTargets("balanced", pool, 20, seededRng(7));
    const counts = Object.values(countByLabel(sets));
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(60);
  });

  it("pure: 総投擲数が正しくプールのみから出題", () => {
    const sets = generatePlannedTargets("pure", [T20, D16], 20, seededRng(1));
    const flat = sets.flat();
    expect(flat).toHaveLength(60);
    for (const target of flat) {
      expect(["T20", "D16"]).toContain(target.label);
    }
  });

  it("blocks: ターゲットごとに連続セットでまとめて出題する", () => {
    const sets = generatePlannedTargets("blocks", [T20, D16], 20);
    expect(sets).toHaveLength(20);
    // 前半10セットはT20、後半10セットはD16
    expect(sets[0]?.every((x) => x.label === "T20")).toBe(true);
    expect(sets[9]?.every((x) => x.label === "T20")).toBe(true);
    expect(sets[10]?.every((x) => x.label === "D16")).toBe(true);
    expect(sets[19]?.every((x) => x.label === "D16")).toBe(true);
  });

  it("blocks: 割り切れない場合は先頭ターゲットに余りを配分", () => {
    const pool = [1, 2, 3].map((n) => makeSegmentTarget("triple", STEEL_BOARD, n));
    const sets = generatePlannedTargets("blocks", pool, 20);
    expect(sets).toHaveLength(20);
    const counts = countByLabel(sets);
    // 20セット / 3ターゲット → 7,7,6セット (投数では21,21,18)
    expect(counts["T1"]).toBe(21);
    expect(counts["T2"]).toBe(21);
    expect(counts["T3"]).toBe(18);
  });

  it("空プールはエラー", () => {
    expect(() => generatePlannedTargets("cycle", [], 20)).toThrow();
  });
});

describe("shuffle", () => {
  it("要素を保存する", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, seededRng(3));
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5]); // 非破壊
  });
});

describe("validateSetCount (セット数境界値)", () => {
  it("最小20セットは有効", () => {
    expect(validateSetCount(MIN_SETS)).toBe(true);
  });
  it("上限333セットは有効", () => {
    expect(validateSetCount(MAX_SETS)).toBe(true);
  });
  it("19セット・334セットは無効", () => {
    expect(validateSetCount(MIN_SETS - 1)).toBe(false);
    expect(validateSetCount(MAX_SETS + 1)).toBe(false);
  });
  it("小数・NaN・負数は無効", () => {
    expect(validateSetCount(20.5)).toBe(false);
    expect(validateSetCount(Number.NaN)).toBe(false);
    expect(validateSetCount(-20)).toBe(false);
  });
  it("333セットは999投以内", () => {
    expect(MAX_SETS * 3).toBeLessThanOrEqual(999);
  });
});
