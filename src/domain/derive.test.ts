import { describe, expect, it } from "vitest";
import { STEEL_BOARD } from "../config/boardProfiles";
import { classifyMissDirection, deriveThrow } from "./derive";
import { landingFromCoordinate, landingBounceOut, landingOutboardDirection } from "./landing";
import { isExactHit } from "./targets";
import { makeBullAnyTarget, makeNumberSectorTarget, makeSegmentTarget } from "./targets";
import { CENTER_NEAR_THRESHOLD } from "../config/constants";

describe("classifyMissDirection (ズレ方向9分類)", () => {
  it("閾値未満は中心付近", () => {
    expect(classifyMissDirection(0, 0)).toBe("center");
    expect(
      classifyMissDirection(CENTER_NEAR_THRESHOLD * 0.99, 0)
    ).toBe("center");
  });
  it("8方向の判定", () => {
    expect(classifyMissDirection(0, 0.2)).toBe("up");
    expect(classifyMissDirection(0.2, 0.2)).toBe("up_right");
    expect(classifyMissDirection(0.2, 0)).toBe("right");
    expect(classifyMissDirection(0.2, -0.2)).toBe("down_right");
    expect(classifyMissDirection(0, -0.2)).toBe("down");
    expect(classifyMissDirection(-0.2, -0.2)).toBe("down_left");
    expect(classifyMissDirection(-0.2, 0)).toBe("left");
    expect(classifyMissDirection(-0.2, 0.2)).toBe("up_left");
  });
  it("45度ビン境界: 22.5度で右上へ切り替わる", () => {
    const r = 0.2;
    const angle = (22.4 * Math.PI) / 180;
    expect(
      classifyMissDirection(r * Math.sin(angle), r * Math.cos(angle))
    ).toBe("up");
    const angle2 = (22.6 * Math.PI) / 180;
    expect(
      classifyMissDirection(r * Math.sin(angle2), r * Math.cos(angle2))
    ).toBe("up_right");
  });
});

describe("isExactHit (命中判定)", () => {
  const t20 = makeSegmentTarget("triple", STEEL_BOARD, 20);
  it("T20狙いでT20に着弾は命中", () => {
    const rep = t20.representativePoint;
    const landing = landingFromCoordinate(rep.x, rep.y, STEEL_BOARD);
    expect(isExactHit(t20, landing)).toBe(true);
  });
  it("T20狙いでS20は外れ", () => {
    const landing = landingFromCoordinate(0, 0.8, STEEL_BOARD);
    expect(landing.ring).toBe("outer_single");
    expect(isExactHit(t20, landing)).toBe(false);
  });
  it("Bull全体狙いはインナー・アウターどちらも命中", () => {
    const bull = makeBullAnyTarget();
    expect(isExactHit(bull, landingFromCoordinate(0, 0, STEEL_BOARD))).toBe(true);
    expect(
      isExactHit(bull, landingFromCoordinate(0, 0.07, STEEL_BOARD))
    ).toBe(true);
    expect(
      isExactHit(bull, landingFromCoordinate(0, 0.3, STEEL_BOARD))
    ).toBe(false);
  });
  it("ナンバー全体狙いは同ナンバーのS/D/Tすべて命中", () => {
    const n20 = makeNumberSectorTarget(20, STEEL_BOARD);
    expect(isExactHit(n20, landingFromCoordinate(0, 0.8, STEEL_BOARD))).toBe(true);
    expect(isExactHit(n20, landingFromCoordinate(0, 0.98, STEEL_BOARD))).toBe(true);
    expect(isExactHit(n20, landingFromCoordinate(0, 0.6, STEEL_BOARD))).toBe(true);
    // 隣の1に入ったら外れ
    const p1 = landingFromCoordinate(0.25, 0.75, STEEL_BOARD);
    expect(p1.number).toBe(1);
    expect(isExactHit(n20, p1)).toBe(false);
  });
  it("シングル狙いはインナー/アウターシングルを区別しない", () => {
    const s20 = makeSegmentTarget("outer_single", STEEL_BOARD, 20);
    const innerSingle = landingFromCoordinate(0, 0.3, STEEL_BOARD);
    expect(innerSingle.ring).toBe("inner_single");
    expect(isExactHit(s20, innerSingle)).toBe(true);
  });
  it("アウトボード・バウンスアウトは常に外れ", () => {
    expect(isExactHit(t20, landingBounceOut())).toBe(false);
    expect(isExactHit(t20, landingOutboardDirection("up"))).toBe(false);
  });
});

describe("deriveThrow (誤差の派生データ)", () => {
  const t20 = makeSegmentTarget("triple", STEEL_BOARD, 20);
  const ctx = {
    globalThrowNumber: 30,
    plannedThrowCount: 60,
  };

  it("誤差X/Y/距離を計算する", () => {
    const rep = t20.representativePoint;
    const landing = landingFromCoordinate(rep.x + 0.03, rep.y - 0.04, STEEL_BOARD);
    const derived = deriveThrow(t20, landing, ctx);
    expect(derived.errorX).toBeCloseTo(0.03);
    expect(derived.errorY).toBeCloseTo(-0.04);
    expect(derived.errorDistance).toBeCloseTo(0.05);
    expect(derived.sessionProgress).toBeCloseTo(0.5);
  });

  it("座標欠損(バウンスアウト)では誤差を計算しない", () => {
    const derived = deriveThrow(t20, landingBounceOut(), ctx);
    expect(derived.errorDistance).toBeUndefined();
    expect(derived.errorX).toBeUndefined();
    expect(derived.missDirection).toBeUndefined();
    expect(derived.exactHit).toBe(false);
  });

  it("方向のみのアウトボードは方向だけ記録する", () => {
    const derived = deriveThrow(t20, landingOutboardDirection("up_left"), ctx);
    expect(derived.missDirection).toBe("up_left");
    expect(derived.errorDistance).toBeUndefined();
  });

  it("ターゲット変更と前投命中を記録する", () => {
    const d16 = makeSegmentTarget("double", STEEL_BOARD, 16);
    const landing = landingFromCoordinate(0, 0, STEEL_BOARD);
    const derived = deriveThrow(d16, landing, {
      ...ctx,
      previousTarget: t20,
      previousWasHit: true,
    });
    expect(derived.targetChangedFromPrevious).toBe(true);
    expect(derived.previousThrowWasHit).toBe(true);
    const derived2 = deriveThrow(d16, landing, {
      ...ctx,
      previousTarget: makeSegmentTarget("double", STEEL_BOARD, 16),
      previousWasHit: false,
    });
    expect(derived2.targetChangedFromPrevious).toBe(false);
  });
});
