import { memo, type ReactNode } from "react";
import type { BoardProfile } from "../config/boardProfiles";
import type { Ring, TargetDefinition } from "../types/models";
import { segmentLabel } from "../domain/targets";

/**
 * SVGダーツボード。
 * 内部単位: 外側ダブル外周 = 100。入力可能範囲 = 130。
 * 座標系: 中心(0,0)、上が20方向。SVGのy軸は下向きのため描画時に反転する。
 */
export const BOARD_UNIT = 100;

const SECTOR_DARK = "#23232b";
const SECTOR_LIGHT = "#e9e3d1";
const RING_RED = "#c94f44";
const RING_GREEN = "#3d9960";
const BULL_GREEN = "#3d9960";
const BULL_RED = "#c94f44";
const BOARD_EDGE = "#101418";

function pt(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  // svg: y下向き → 上=20方向を -y に
  return [radius * Math.sin(rad), -radius * Math.cos(rad)];
}

/** 環状セクターのパス */
function annularSectorPath(
  r1: number,
  r2: number,
  a1: number,
  a2: number
): string {
  const [x1, y1] = pt(r2, a1);
  const [x2, y2] = pt(r2, a2);
  const [x3, y3] = pt(r1, a2);
  const [x4, y4] = pt(r1, a1);
  return [
    `M ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `A ${r2} ${r2} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    `L ${x3.toFixed(3)} ${y3.toFixed(3)}`,
    `A ${r1} ${r1} 0 0 0 ${x4.toFixed(3)} ${y4.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export interface SegmentClick {
  ring: Ring;
  number?: number;
}

interface BoardSVGProps {
  profile: BoardProfile;
  /** クリック可能領域のハンドラ(セグメント単位入力用) */
  onSegmentClick?: (seg: SegmentClick) => void;
  /** 強調表示するターゲット */
  highlightTarget?: TargetDefinition;
  /** マーカー等の追加描画(正規化座標×100の単位) */
  children?: ReactNode;
  /** アウトボード領域(ダブル外〜入力範囲)を表示するか */
  showOutboardArea?: boolean;
  viewBox?: string;
}

function targetMatches(
  target: TargetDefinition | undefined,
  ring: Ring,
  number?: number
): boolean {
  if (!target) return false;
  const singles: Ring[] = ["inner_single", "outer_single"];
  switch (target.type) {
    case "bull_any":
      return ring === "inner_bull" || ring === "outer_bull";
    case "number_sector":
      return (
        number === target.number &&
        (singles.includes(ring) || ring === "double" || ring === "triple")
      );
    case "exact_segment":
      if (target.ring === "inner_bull" || target.ring === "outer_bull") {
        return ring === target.ring;
      }
      if (target.ring && singles.includes(target.ring)) {
        return singles.includes(ring) && number === target.number;
      }
      return ring === target.ring && number === target.number;
    case "custom_selection":
      return (target.areas ?? []).some((a) => {
        if (a.ring === "inner_bull" || a.ring === "outer_bull") {
          return ring === a.ring;
        }
        if (singles.includes(a.ring)) {
          return singles.includes(ring) && number === a.number;
        }
        return ring === a.ring && number === a.number;
      });
  }
}

export const BoardSVG = memo(function BoardSVG({
  profile,
  onSegmentClick,
  highlightTarget,
  children,
  showOutboardArea = false,
  viewBox,
}: BoardSVGProps) {
  const r = profile.radii;
  const R = {
    innerBull: r.innerBullOuter * BOARD_UNIT,
    outerBull: r.outerBullOuter * BOARD_UNIT,
    tripleIn: r.tripleInner * BOARD_UNIT,
    tripleOut: r.tripleOuter * BOARD_UNIT,
    doubleIn: r.doubleInner * BOARD_UNIT,
    doubleOut: r.doubleOuter * BOARD_UNIT,
    input: r.inputAreaOuter * BOARD_UNIT,
  };
  const extent = showOutboardArea ? R.input + 4 : R.doubleOut + 18;
  const vb = viewBox ?? `${-extent} ${-extent} ${extent * 2} ${extent * 2}`;

  const interactive = onSegmentClick != null;

  const segments: ReactNode[] = [];
  profile.segmentOrder.forEach((number, i) => {
    const a1 = i * 18 - 9;
    const a2 = i * 18 + 9;
    const dark = i % 2 === 0;
    const singleFill = dark ? SECTOR_DARK : SECTOR_LIGHT;
    const ringFill = dark ? RING_RED : RING_GREEN;
    const parts: { ring: Ring; r1: number; r2: number; fill: string }[] = [
      { ring: "inner_single", r1: R.outerBull, r2: R.tripleIn, fill: singleFill },
      { ring: "triple", r1: R.tripleIn, r2: R.tripleOut, fill: ringFill },
      { ring: "outer_single", r1: R.tripleOut, r2: R.doubleIn, fill: singleFill },
      { ring: "double", r1: R.doubleIn, r2: R.doubleOut, fill: ringFill },
    ];
    for (const part of parts) {
      const highlighted = targetMatches(highlightTarget, part.ring, number);
      segments.push(
        <path
          key={`${number}-${part.ring}`}
          d={annularSectorPath(part.r1, part.r2, a1, a2)}
          fill={part.fill}
          stroke={highlighted ? "#f0b246" : "#4a4a52"}
          strokeWidth={highlighted ? 2.2 : 0.4}
          data-ring={part.ring}
          data-number={number}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={
            interactive ? segmentLabel(part.ring, number) : undefined
          }
          onClick={
            interactive
              ? () => onSegmentClick({ ring: part.ring, number })
              : undefined
          }
          onKeyDown={
            interactive
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSegmentClick({ ring: part.ring, number });
                  }
                }
              : undefined
          }
          style={interactive ? { cursor: "pointer" } : undefined}
        />
      );
    }
  });

  const numberLabels = profile.segmentOrder.map((number, i) => {
    const [x, y] = pt(R.doubleOut + 10, i * 18);
    return (
      <text
        key={number}
        x={x}
        y={y}
        fill="#cfe0e5"
        fontSize={10}
        textAnchor="middle"
        dominantBaseline="central"
        aria-hidden
      >
        {number}
      </text>
    );
  });

  const bullHighlightOuter = targetMatches(highlightTarget, "outer_bull");
  const bullHighlightInner = targetMatches(highlightTarget, "inner_bull");

  return (
    <svg
      viewBox={vb}
      role={interactive ? "group" : "img"}
      aria-label="ダーツボード"
    >
      {showOutboardArea && (
        <circle
          cx={0}
          cy={0}
          r={R.input}
          fill="#0a161b"
          stroke="#2a5361"
          strokeWidth={0.6}
          strokeDasharray="3 3"
          data-ring="outboard"
        />
      )}
      <circle cx={0} cy={0} r={R.doubleOut + (showOutboardArea ? 0 : 16)} fill={BOARD_EDGE} />
      {segments}
      <circle
        cx={0}
        cy={0}
        r={R.outerBull}
        fill={BULL_GREEN}
        stroke={bullHighlightOuter ? "#f0b246" : "#4a4a52"}
        strokeWidth={bullHighlightOuter ? 2.2 : 0.4}
        data-ring="outer_bull"
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? "アウターブル" : undefined}
        onClick={
          interactive ? () => onSegmentClick({ ring: "outer_bull" }) : undefined
        }
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSegmentClick({ ring: "outer_bull" });
                }
              }
            : undefined
        }
        style={interactive ? { cursor: "pointer" } : undefined}
      />
      <circle
        cx={0}
        cy={0}
        r={R.innerBull}
        fill={BULL_RED}
        stroke={bullHighlightInner ? "#f0b246" : "#4a4a52"}
        strokeWidth={bullHighlightInner ? 2 : 0.4}
        data-ring="inner_bull"
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? "インナーブル" : undefined}
        onClick={
          interactive ? () => onSegmentClick({ ring: "inner_bull" }) : undefined
        }
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSegmentClick({ ring: "inner_bull" });
                }
              }
            : undefined
        }
        style={interactive ? { cursor: "pointer" } : undefined}
      />
      {!showOutboardArea && numberLabels}
      {showOutboardArea && numberLabels}
      {children}
    </svg>
  );
});
