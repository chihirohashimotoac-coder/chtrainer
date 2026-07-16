import { describe, expect, it } from "vitest";
import { STEEL_BOARD } from "../config/boardProfiles";
import { buildSkillCheckPlan, skillCheckUniqueTargets } from "./skillCheck";

describe("buildSkillCheckPlan (スキル診断の4ラウンド)", () => {
  const plan = buildSkillCheckPlan(STEEL_BOARD, 20);

  it("20セットを4ラウンドへ5セットずつ配分する", () => {
    expect(plan).toHaveLength(20);
    // R1: グルーピング
    for (let i = 0; i < 5; i++) {
      expect(plan[i]?.every((x) => x.label === "グルーピング(20全体)")).toBe(true);
    }
    // R2: ブル
    for (let i = 5; i < 10; i++) {
      expect(plan[i]?.every((x) => x.label === "Bull")).toBe(true);
    }
    // R4: ダブル
    for (let i = 15; i < 20; i++) {
      expect(plan[i]?.every((x) => x.label.startsWith("D"))).toBe(true);
    }
  });

  it("R3ナンバーは同一3投と1投ずつ切替を交互に出題する", () => {
    expect(plan[10]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
    expect(plan[11]?.map((x) => x.label)).toEqual(["T20", "T16", "T15"]);
    expect(plan[12]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
  });

  it("R4ダブルはD16とD20を交互に出題する", () => {
    expect(plan[15]?.map((x) => x.label)).toEqual(["D16", "D16", "D16"]);
    expect(plan[16]?.map((x) => x.label)).toEqual(["D20", "D20", "D20"]);
  });

  it("グルーピングターゲットは20エリア全体を命中とする", () => {
    const grouping = plan[0]?.[0];
    expect(grouping?.type).toBe("number_sector");
    expect(grouping?.number).toBe(20);
  });

  it("割り切れないセット数は先頭ラウンドから+1配分する", () => {
    const plan22 = buildSkillCheckPlan(STEEL_BOARD, 22);
    expect(plan22).toHaveLength(22);
    // 22 = 6,6,5,5
    expect(plan22[5]?.[0]?.label).toBe("グルーピング(20全体)");
    expect(plan22[6]?.[0]?.label).toBe("Bull");
  });

  it("使用ターゲット一覧は7種", () => {
    expect(skillCheckUniqueTargets(STEEL_BOARD).map((x) => x.label)).toEqual([
      "グルーピング(20全体)",
      "Bull",
      "T20",
      "T16",
      "T15",
      "D16",
      "D20",
    ]);
  });
});
