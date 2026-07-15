import { describe, expect, it } from "vitest";
import { STEEL_BOARD, SOFT_BOARD } from "../config/boardProfiles";
import {
  fromPolar,
  judgePoint,
  normalizePoint,
  numberAtAngle,
  ringAtRadius,
  ringMidRadius,
  sectorCenterAngle,
  segmentRepresentativePoint,
  toPolar,
} from "./board";

describe("normalizePoint (座標の正規化)", () => {
  it("中心は(0,0)になる", () => {
    expect(normalizePoint(200, 150, 200, 150, 100)).toEqual({ x: 0, y: 0 });
  });
  it("右方向は+x、上方向は+y", () => {
    expect(normalizePoint(300, 150, 200, 150, 100)).toEqual({ x: 1, y: 0 });
    expect(normalizePoint(200, 50, 200, 150, 100)).toEqual({ x: 0, y: 1 });
  });
  it("左下は負の値", () => {
    const p = normalizePoint(150, 200, 200, 150, 100);
    expect(p.x).toBeCloseTo(-0.5);
    expect(p.y).toBeCloseTo(-0.5);
  });
});

describe("toPolar / fromPolar (極座標変換)", () => {
  it("真上(20方向)は0度", () => {
    const { radius, angleDeg } = toPolar(0, 1);
    expect(radius).toBeCloseTo(1);
    expect(angleDeg).toBeCloseTo(0);
  });
  it("右は90度(時計回り正)", () => {
    expect(toPolar(1, 0).angleDeg).toBeCloseTo(90);
  });
  it("下は180度、左は270度", () => {
    expect(toPolar(0, -1).angleDeg).toBeCloseTo(180);
    expect(toPolar(-1, 0).angleDeg).toBeCloseTo(270);
  });
  it("角度は0以上360未満", () => {
    const { angleDeg } = toPolar(-0.001, 1);
    expect(angleDeg).toBeGreaterThanOrEqual(0);
    expect(angleDeg).toBeLessThan(360);
  });
  it("ボード中心では半径0", () => {
    expect(toPolar(0, 0)).toEqual({ radius: 0, angleDeg: 0 });
  });
  it("fromPolar は toPolar の逆変換", () => {
    const p = fromPolar(0.7, 123);
    const back = toPolar(p.x, p.y);
    expect(back.radius).toBeCloseTo(0.7);
    expect(back.angleDeg).toBeCloseTo(123);
  });
});

describe("numberAtAngle (ナンバー判定)", () => {
  it("0度は20", () => {
    expect(numberAtAngle(0, STEEL_BOARD)).toBe(20);
  });
  it("18度は1、90度は6、180度は3、270度は11", () => {
    expect(numberAtAngle(18, STEEL_BOARD)).toBe(1);
    expect(numberAtAngle(90, STEEL_BOARD)).toBe(6);
    expect(numberAtAngle(180, STEEL_BOARD)).toBe(3);
    expect(numberAtAngle(270, STEEL_BOARD)).toBe(11);
  });
  it("セグメント境界: 9度で1へ切り替わる", () => {
    expect(numberAtAngle(8.999, STEEL_BOARD)).toBe(20);
    expect(numberAtAngle(9, STEEL_BOARD)).toBe(1);
  });
  it("351度(=-9度)で20へ戻る", () => {
    expect(numberAtAngle(350.999, STEEL_BOARD)).toBe(5);
    expect(numberAtAngle(351, STEEL_BOARD)).toBe(20);
  });
});

describe("ringAtRadius (リング判定と境界)", () => {
  const r = STEEL_BOARD.radii;
  it("ボード中心はインナーブル", () => {
    expect(ringAtRadius(0, STEEL_BOARD)).toBe("inner_bull");
  });
  it("インナーブル外周ちょうどはインナーブル", () => {
    expect(ringAtRadius(r.innerBullOuter, STEEL_BOARD)).toBe("inner_bull");
    expect(ringAtRadius(r.innerBullOuter + 1e-9, STEEL_BOARD)).toBe(
      "outer_bull"
    );
  });
  it("アウターブル境界", () => {
    expect(ringAtRadius(r.outerBullOuter, STEEL_BOARD)).toBe("outer_bull");
    expect(ringAtRadius(r.outerBullOuter + 1e-9, STEEL_BOARD)).toBe(
      "inner_single"
    );
  });
  it("トリプル境界: 内側・外側とも含む", () => {
    expect(ringAtRadius(r.tripleInner, STEEL_BOARD)).toBe("triple");
    expect(ringAtRadius(r.tripleInner - 1e-9, STEEL_BOARD)).toBe(
      "inner_single"
    );
    expect(ringAtRadius(r.tripleOuter, STEEL_BOARD)).toBe("triple");
    expect(ringAtRadius(r.tripleOuter + 1e-9, STEEL_BOARD)).toBe(
      "outer_single"
    );
  });
  it("外側ダブル境界: 1.0はダブル、超えるとアウトボード", () => {
    expect(ringAtRadius(r.doubleInner, STEEL_BOARD)).toBe("double");
    expect(ringAtRadius(1.0, STEEL_BOARD)).toBe("double");
    expect(ringAtRadius(1.0 + 1e-9, STEEL_BOARD)).toBe("outboard");
    expect(ringAtRadius(1.3, STEEL_BOARD)).toBe("outboard");
  });
});

describe("judgePoint (着弾判定とスコア)", () => {
  it("真上のトリプル帯はT20=60点", () => {
    const r = ringMidRadius("triple", STEEL_BOARD);
    const judged = judgePoint(0, r, STEEL_BOARD);
    expect(judged.ring).toBe("triple");
    expect(judged.number).toBe(20);
    expect(judged.score).toBe(60);
  });
  it("中心はインナーブル50点", () => {
    const judged = judgePoint(0, 0, STEEL_BOARD);
    expect(judged.ring).toBe("inner_bull");
    expect(judged.score).toBe(50);
  });
  it("右のダブル帯はD6=12点", () => {
    const r = ringMidRadius("double", STEEL_BOARD);
    const judged = judgePoint(r, 0, STEEL_BOARD);
    expect(judged.ring).toBe("double");
    expect(judged.number).toBe(6);
    expect(judged.score).toBe(12);
  });
  it("ボード外は0点のアウトボード", () => {
    const judged = judgePoint(0, 1.2, STEEL_BOARD);
    expect(judged.ring).toBe("outboard");
    expect(judged.score).toBe(0);
  });
});

describe("segmentRepresentativePoint (代表点)", () => {
  it("ブルは中心", () => {
    expect(segmentRepresentativePoint("inner_bull", STEEL_BOARD)).toEqual({
      x: 0,
      y: 0,
    });
  });
  it("T20はセクター中心角0度・トリプル帯中央", () => {
    const p = segmentRepresentativePoint("triple", STEEL_BOARD, 20);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(ringMidRadius("triple", STEEL_BOARD));
  });
  it("sectorCenterAngle: 3は180度", () => {
    expect(sectorCenterAngle(3, STEEL_BOARD)).toBe(180);
  });
});

describe("ソフトボードプロファイル", () => {
  it("スティールと異なる正規化寸法を持つ", () => {
    expect(SOFT_BOARD.radii.outerBullOuter).not.toBeCloseTo(
      STEEL_BOARD.radii.outerBullOuter,
      4
    );
    expect(SOFT_BOARD.radii.doubleOuter).toBe(1.0);
  });
});
