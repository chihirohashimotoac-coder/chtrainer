import { describe, expect, it } from "vitest";
import { suggestCheckout, checkoutTable } from "./checkout";

describe("suggestCheckout", () => {
  it("1ダートの上がりはダブル/ブル単体を返す", () => {
    expect(suggestCheckout(40)).toEqual(["D20"]);
    expect(suggestCheckout(32)).toEqual(["D16"]);
    expect(suggestCheckout(50)).toEqual(["BULL"]);
    expect(suggestCheckout(2)).toEqual(["D1"]);
  });

  it("2ダートの標準筋を返す", () => {
    expect(suggestCheckout(100)).toEqual(["T20", "D20"]);
    expect(suggestCheckout(110)).toEqual(["T20", "BULL"]);
  });

  it("3ダートの標準筋を返す(最大170)", () => {
    expect(suggestCheckout(170)).toEqual(["T20", "T20", "BULL"]);
    expect(suggestCheckout(160)).toEqual(["T20", "T20", "D20"]);
  });

  it("最終ダートは必ずダブルかブル(合計が一致する)", () => {
    const value = (label: string): number => {
      if (label === "BULL") return 50;
      if (label === "25") return 25;
      const n = Number(label.slice(1));
      if (label.startsWith("T")) return n * 3;
      if (label.startsWith("D")) return n * 2;
      return n;
    };
    for (let target = 2; target <= 170; target++) {
      const route = suggestCheckout(target);
      if (!route) continue;
      const sum = route.reduce((a, l) => a + value(l), 0);
      expect(sum).toBe(target);
      const last = route[route.length - 1] ?? "";
      expect(last === "BULL" || last.startsWith("D")).toBe(true);
    }
  });

  it("ボギーナンバー(3ダートで上がれない)は null", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159]) {
      expect(suggestCheckout(bogey)).toBeNull();
    }
  });

  it("範囲外は null", () => {
    expect(suggestCheckout(1)).toBeNull();
    expect(suggestCheckout(171)).toBeNull();
    expect(suggestCheckout(0)).toBeNull();
    expect(suggestCheckout(2.5)).toBeNull();
  });

  it("checkoutTable は170→2の順で全件返す", () => {
    const table = checkoutTable();
    expect(table[0]?.score).toBe(170);
    expect(table[table.length - 1]?.score).toBe(2);
    expect(table).toHaveLength(169);
  });
});
