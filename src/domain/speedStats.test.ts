import { describe, expect, it } from "vitest";
import { speedAccuracyStats, type SpeedAccuracyResult } from "./speedStats";
import type { ThrowRecord } from "../types/models";

function throwWith(speedKmh?: number, errorDistance?: number): ThrowRecord {
  return {
    schemaVersion: 3,
    id: Math.random().toString(36),
    sessionId: "s",
    setId: "set",
    globalThrowNumber: 1,
    dartInSet: 1,
    target: {
      id: "t",
      label: "T20",
      type: "number_sector",
      representativePoint: { x: 0, y: 0 },
    },
    thrownAt: new Date().toISOString(),
    elapsedMs: 0,
    landing: { ring: "triple", number: 20, positionPrecision: "coordinate" },
    derived: {
      targetChangedFromPrevious: false,
      sessionProgress: 0,
      ...(errorDistance != null ? { errorDistance } : {}),
    },
    ...(speedKmh != null ? { speedKmh } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("speedAccuracyStats", () => {
  it("矢速と誤差の両方がある投擲だけを対象にする", () => {
    const res: SpeedAccuracyResult = speedAccuracyStats([
      throwWith(60, 0.1),
      throwWith(undefined, 0.2), // 矢速なし → 除外
      throwWith(70, undefined), // 誤差なし → 除外
      throwWith(80, 0.3),
    ]);
    expect(res.sampleCount).toBe(2);
    expect(res.points).toHaveLength(2);
  });

  it("完全な正相関では r=1 になる", () => {
    const res = speedAccuracyStats([
      throwWith(50, 0.1),
      throwWith(60, 0.2),
      throwWith(70, 0.3),
    ]);
    expect(res.correlation).toBeCloseTo(1, 5);
    expect(res.averageSpeedKmh).toBeCloseTo(60, 5);
  });

  it("完全な負相関では r=-1 になる", () => {
    const res = speedAccuracyStats([
      throwWith(50, 0.3),
      throwWith(60, 0.2),
      throwWith(70, 0.1),
    ]);
    expect(res.correlation).toBeCloseTo(-1, 5);
  });

  it("サンプルが無ければ相関は undefined", () => {
    const res = speedAccuracyStats([]);
    expect(res.sampleCount).toBe(0);
    expect(res.correlation).toBeUndefined();
  });

  it("矢速の分散が0なら相関は undefined(算出不能)", () => {
    const res = speedAccuracyStats([throwWith(60, 0.1), throwWith(60, 0.2)]);
    expect(res.correlation).toBeUndefined();
  });
});
