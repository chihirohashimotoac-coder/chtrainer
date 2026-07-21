import { describe, expect, it } from "vitest";
import {
  DARTS_LIVE_TABLE,
  PHOENIX_TABLE,
  formatRating,
  ratingRowOf,
  ratingValuesOf,
} from "./ratingTable";

describe("ratingTable", () => {
  it("DARTSLIVEは1〜18、PHOENIXは1〜30の連番", () => {
    expect(ratingValuesOf("darts_live")).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1)
    );
    expect(ratingValuesOf("phoenix")).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1)
    );
  });

  it("ppd/mprは体系内で単調非減少", () => {
    for (const table of [DARTS_LIVE_TABLE, PHOENIX_TABLE]) {
      for (let i = 1; i < table.length; i += 1) {
        expect(table[i]!.ppd).toBeGreaterThanOrEqual(table[i - 1]!.ppd);
        expect(table[i]!.mpr).toBeGreaterThanOrEqual(table[i - 1]!.mpr);
      }
    }
  });

  it("ratingRowOfは体系ごとの値を引く", () => {
    expect(ratingRowOf({ system: "darts_live", value: 10 })?.ppd).toBe(25.0);
    expect(ratingRowOf({ system: "phoenix", value: 10 })?.ppd).toBe(20.75);
    expect(ratingRowOf({ system: "darts_live", value: 99 })).toBeUndefined();
  });

  it("formatRatingは体系名付きで表示する", () => {
    expect(formatRating({ system: "darts_live", value: 12 })).toBe(
      "DARTSLIVE Rt12"
    );
    expect(formatRating({ system: "phoenix", value: 20 })).toBe("PHOENIX Rt20");
  });
});
