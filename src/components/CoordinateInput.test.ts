import { describe, expect, it } from "vitest";
import { loupeViewBox, LOUPE_ZOOM } from "./CoordinateInput";
import { BOARD_UNIT } from "./BoardSVG";

/**
 * ルーペ(ドラッグ微調整中に指の下の点を拡大表示)の viewBox 計算の回帰テスト。
 * 仕様: 現在の表示に対して 2 倍拡大し、選択中の正規化座標 pos を中心にする。
 */
describe("loupeViewBox (ルーペの拡大領域)", () => {
  it("拡大率は2倍(幅が現在viewの半分)", () => {
    expect(LOUPE_ZOOM).toBe(2);
    const vb = loupeViewBox({ x: 0, y: 0 }, { x: -134, y: -134, w: 268 });
    expect(vb.w).toBe(134); // 268 / 2
  });

  it("pos(正規化座標)を中心にする(y は上向き正 → SVGは下向き)", () => {
    const view = { x: -134, y: -134, w: 268 };
    const pos = { x: 0.3, y: 0.6 };
    const vb = loupeViewBox(pos, view);
    // 中心 = (pos.x*100, -pos.y*100)
    const cx = pos.x * BOARD_UNIT;
    const cy = -pos.y * BOARD_UNIT;
    expect(vb.x + vb.w / 2).toBeCloseTo(cx, 6);
    expect(vb.y + vb.w / 2).toBeCloseTo(cy, 6);
  });

  it("すでにズーム済みのviewでも、そのview幅に対して2倍拡大する", () => {
    // タップ後の3倍ズーム相当(狭いview)でも、さらに半分の幅=2倍拡大になる
    const zoomed = { x: -20, y: -80, w: 90 };
    const vb = loupeViewBox({ x: 0.1, y: 0.7 }, zoomed);
    expect(vb.w).toBeCloseTo(45, 6); // 90 / 2
  });
});
