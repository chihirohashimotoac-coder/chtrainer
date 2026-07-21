import { describe, expect, it } from "vitest";
import { SOFT_BOARD, STEEL_BOARD } from "../config/boardProfiles";
import { buildSkillCheckPlan, skillCheckUniqueTargets } from "./skillCheck";

describe("buildSkillCheckPlan (スキル診断の4ラウンド)", () => {
  const plan = buildSkillCheckPlan(SOFT_BOARD, 20, "fit_bull");

  it("20セットを4ラウンドへ5セットずつ配分する", () => {
    expect(plan).toHaveLength(20);
    // R1: グルーピング
    for (let i = 0; i < 5; i++) {
      expect(plan[i]?.every((x) => x.label === "1投目の着弾点")).toBe(true);
    }
    // R2: スコアリング (ファットブルの主役はBull)
    for (let i = 5; i < 10; i++) {
      expect(plan[i]?.every((x) => x.label === "Bull")).toBe(true);
    }
    // R4: ダブル
    for (let i = 15; i < 20; i++) {
      expect(plan[i]?.every((x) => x.label.startsWith("D"))).toBe(true);
    }
  });

  it("R3ナンバーは同一3投→三角形1→三角形2を循環出題する", () => {
    expect(plan[10]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
    expect(plan[11]?.map((x) => x.label)).toEqual(["T20", "T16", "T15"]);
    expect(plan[12]?.map((x) => x.label)).toEqual(["T12", "T18", "T3"]);
    expect(plan[13]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
    expect(plan[14]?.map((x) => x.label)).toEqual(["T20", "T16", "T15"]);
  });

  it("R4標準5セットは固定精度と切替能力を指定順で測る", () => {
    expect(plan.slice(15, 20).map((set) => set.map((x) => x.label))).toEqual([
      ["D20", "D20", "D20"],
      ["D16", "D16", "D16"],
      ["D20", "D10", "D5"],
      ["D16", "D8", "D4"],
      ["D12", "D18", "D6"],
    ]);
  });

  it("グルーピングターゲットは狙い自由のフリーターゲット", () => {
    const grouping = plan[0]?.[0];
    expect(grouping?.type).toBe("custom_selection");
    expect(grouping?.areas).toEqual([]);
    expect(grouping).toMatchObject({
      evaluationKind: "grouping_only",
      roundId: "skill-r1",
      roundKind: "grouping",
      requiredInputPrecision: "coordinate",
    });
  });

  it("R2〜R4へ意味上のラウンドメタデータを保存する", () => {
    expect(plan[5]?.[0]).toMatchObject({
      evaluationKind: "exact_hit",
      roundId: "skill-r2",
      roundKind: "scoring",
      requiredInputPrecision: "any",
    });
    expect(plan[10]?.[0]).toMatchObject({
      evaluationKind: "exact_hit",
      roundId: "skill-r3",
      roundKind: "number",
    });
    expect(plan[15]?.[0]).toMatchObject({
      evaluationKind: "exact_hit",
      roundId: "skill-r4",
      roundKind: "checkout",
      patternId: "r4-d20-fixed",
      patternKind: "fixed",
    });
    for (const target of plan.slice(15).flat()) {
      expect(target.evaluationKind).toBe("exact_hit");
      expect(target.roundKind).toBe("checkout");
      expect(target.roundId).toBe("skill-r4");
      expect(target.patternId).toBeTruthy();
      expect(["fixed", "switch"]).toContain(target.patternKind);
    }
  });

  it("scoringStyle省略時はファットブル配列(旧バージョン互換)", () => {
    const legacy = buildSkillCheckPlan(STEEL_BOARD, 20);
    expect(legacy[5]?.[0]?.label).toBe("Bull");
    expect(legacy[10]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
  });

  it("割り切れないセット数はスコアリングラウンド優先(R2→R1→R3→R4)で+1配分する", () => {
    // 21 = 5,6,5,5 (余り1はR2へ)
    const plan21 = buildSkillCheckPlan(SOFT_BOARD, 21, "fit_bull");
    expect(plan21).toHaveLength(21);
    expect(plan21[4]?.[0]?.label).toBe("1投目の着弾点");
    expect(plan21[5]?.[0]?.label).toBe("Bull");
    expect(plan21[10]?.[0]?.label).toBe("Bull");
    expect(plan21[11]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
    // 22 = 6,6,5,5 (余り2はR2とR1へ)
    const plan22 = buildSkillCheckPlan(SOFT_BOARD, 22, "fit_bull");
    expect(plan22).toHaveLength(22);
    expect(plan22[5]?.[0]?.label).toBe("1投目の着弾点");
    expect(plan22[6]?.[0]?.label).toBe("Bull");
    expect(plan22[11]?.[0]?.label).toBe("Bull");
    // 23 = 6,6,6,5 (余り3はR2・R1・R3へ)
    const plan23 = buildSkillCheckPlan(SOFT_BOARD, 23, "fit_bull");
    expect(plan23).toHaveLength(23);
    // R3は12〜17の6セット(同一→三角形1→三角形2を2巡)
    expect(plan23[15]?.map((x) => x.label)).toEqual(["T20", "T20", "T20"]);
    expect(plan23[17]?.map((x) => x.label)).toEqual(["T12", "T18", "T3"]);
    expect(plan23[18]?.[0]?.label).toBe("D20");
  });

  it("R4が6セット以上なら追加パターンを決定論的に使用して循環する", () => {
    const plan44 = buildSkillCheckPlan(SOFT_BOARD, 44, "fit_bull");
    const r4 = plan44.filter((set) => set[0]?.roundId === "skill-r4");
    expect(r4).toHaveLength(11);
    expect(r4[5]?.map((x) => x.label)).toEqual(["D10", "D10", "D10"]);
    expect(r4[10]?.map((x) => x.label)).toEqual(["D4", "D4", "D4"]);
    const plan64 = buildSkillCheckPlan(SOFT_BOARD, 64, "fit_bull");
    const r4Cycle = plan64.filter((set) => set[0]?.roundId === "skill-r4");
    expect(r4Cycle[15]?.map((x) => x.label)).toEqual(["D20", "D20", "D20"]);
  });

  it("20セットの使用ターゲット一覧は実計画順で重複排除し、未出題D2を含まない", () => {
    expect(
      skillCheckUniqueTargets(SOFT_BOARD, "fit_bull").map((x) => x.label)
    ).toEqual([
      "1投目の着弾点",
      "Bull",
      "T20",
      "T16",
      "T15",
      "T12",
      "T18",
      "T3",
      "D20",
      "D16",
      "D10",
      "D5",
      "D8",
      "D4",
      "D12",
      "D18",
      "D6",
    ]);
  });

  it("実計画に含まれる60セットではD2を表示する", () => {
    const labels = skillCheckUniqueTargets(SOFT_BOARD, 60, "fit_bull").map(
      (target) => target.label
    );
    expect(labels).toContain("D2");
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.indexOf("D10")).toBeLessThan(labels.indexOf("D2"));
  });
});

describe("buildSkillCheckPlan (T20主体のスコアリング形式)", () => {
  for (const style of ["separate_bull", "steel"] as const) {
    it(`${style}: R2はT20反復、R3同一3投は副ターゲットのBull`, () => {
      const plan = buildSkillCheckPlan(STEEL_BOARD, 20, style);
      expect(plan).toHaveLength(20);
      // R2: スコアリング (主役はT20)
      for (let i = 5; i < 10; i++) {
        expect(plan[i]?.every((x) => x.label === "T20")).toBe(true);
        expect(plan[i]?.every((x) => x.roundKind === "scoring")).toBe(true);
      }
      // R3: 副ターゲット(Bull)同一3投 → 三角形2種
      expect(plan[10]?.map((x) => x.label)).toEqual(["Bull", "Bull", "Bull"]);
      expect(plan[11]?.map((x) => x.label)).toEqual(["T20", "T16", "T15"]);
      expect(plan[12]?.map((x) => x.label)).toEqual(["T12", "T18", "T3"]);
      // R1・R4は形式によらず共通
      expect(plan[0]?.[0]?.label).toBe("1投目の着弾点");
      expect(plan[15]?.map((x) => x.label)).toEqual(["D20", "D20", "D20"]);
    });
  }

  it("主役の指示文が形式に応じて切り替わる", () => {
    const fitBull = buildSkillCheckPlan(SOFT_BOARD, 20, "fit_bull");
    expect(fitBull[5]?.[0]?.instruction).toContain("Bullを狙って");
    const steel = buildSkillCheckPlan(STEEL_BOARD, 20, "steel");
    expect(steel[5]?.[0]?.instruction).toContain("T20を狙って");
    expect(steel[10]?.[0]?.instruction).toContain("同じターゲットを狙い続ける");
  });

  it("使用ターゲット一覧は主役ターゲットを先頭側に並べる", () => {
    const labels = skillCheckUniqueTargets(STEEL_BOARD, "steel").map(
      (x) => x.label
    );
    expect(labels).toHaveLength(17);
    expect(labels.slice(0, 3)).toEqual(["1投目の着弾点", "T20", "Bull"]);
  });
});
