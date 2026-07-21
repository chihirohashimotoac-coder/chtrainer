import { describe, expect, it } from "vitest";
import { parseSpeedKmh } from "./speed";

describe("parseSpeedKmh", () => {
  it("空・非数・0以下は未入力扱い", () => {
    expect(parseSpeedKmh("")).toBeUndefined();
    expect(parseSpeedKmh("   ")).toBeUndefined();
    expect(parseSpeedKmh("abc")).toBeUndefined();
    expect(parseSpeedKmh("0")).toBeUndefined();
    expect(parseSpeedKmh("-5")).toBeUndefined();
  });

  it("数値は小数第1位へ丸める", () => {
    expect(parseSpeedKmh("64.2")).toBe(64.2);
    expect(parseSpeedKmh("64.25")).toBe(64.3);
    expect(parseSpeedKmh("64")).toBe(64);
    expect(parseSpeedKmh(" 58.9 ")).toBe(58.9);
  });

  it("極端な値は999.9でクランプする", () => {
    expect(parseSpeedKmh("12345")).toBe(999.9);
  });
});
