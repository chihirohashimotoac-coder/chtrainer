import { useCallback, useMemo, useRef, useState } from "react";
import type { BoardProfile } from "../config/boardProfiles";
import type { LandingRecord, OutboardDirection } from "../types/models";
import { judgePoint } from "../domain/board";
import {
  landingBounceOut,
  landingFromCoordinate,
  landingOutboardDirection,
  landingOutboardWithCoordinate,
} from "../domain/landing";
import { segmentLabel } from "../domain/targets";
import { BoardSVG, BOARD_UNIT } from "./BoardSVG";
import { t } from "../i18n/ja";
import { fmtNum } from "../utils/format";

interface Point {
  x: number;
  y: number;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
}

const OUTBOARD_DIRECTIONS: OutboardDirection[] = [
  "up",
  "up_right",
  "right",
  "down_right",
  "down",
  "down_left",
  "left",
  "up_left",
  "unknown",
];

interface CoordinateInputProps {
  profile: BoardProfile;
  onConfirm: (landing: LandingRecord) => void;
  onCancel?: () => void;
  initial?: Point;
  /** バウンスアウト入力を許可 */
  allowBounceOut?: boolean;
}

/**
 * SVGボード上の詳細座標入力。
 * タップで位置指定+自動拡大、ドラッグで微調整、ピンチ/ダブルタップでズーム。
 */
export function CoordinateInput({
  profile,
  onConfirm,
  onCancel,
  initial,
  allowBounceOut = true,
}: CoordinateInputProps) {
  const s = t();
  const extent = profile.radii.inputAreaOuter * BOARD_UNIT + 4;
  const FULL = extent * 2;
  const fullView: ViewBox = { x: -extent, y: -extent, w: FULL };

  const [pos, setPos] = useState<Point | null>(initial ?? null);
  const [history, setHistory] = useState<Point[]>([]);
  const [view, setView] = useState<ViewBox>(fullView);
  const [showOutboardPicker, setShowOutboardPicker] = useState(false);
  const [bounceMode, setBounceMode] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; view: ViewBox; cx: number; cy: number } | null>(null);
  const moved = useRef(false);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  /** クライアント座標→SVG単位座標 */
  const toSvgPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = wrapRef.current?.querySelector("svg");
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: view.x + ((clientX - rect.left) / rect.width) * view.w,
        y: view.y + ((clientY - rect.top) / rect.height) * view.w,
      };
    },
    [view]
  );

  /** SVG単位→正規化座標 */
  const toNormalized = (p: Point): Point => ({
    x: p.x / BOARD_UNIT,
    y: -p.y / BOARD_UNIT,
  });

  const clampView = (v: ViewBox): ViewBox => {
    const w = Math.min(FULL, Math.max(FULL / 8, v.w));
    const x = Math.min(extent - w * 0.2, Math.max(-extent - w * 0.8 + w, v.x));
    const y = Math.min(extent - w * 0.2, Math.max(-extent - w * 0.8 + w, v.y));
    // 単純なクランプ: 中心が範囲内に収まる程度
    return {
      w,
      x: Math.min(extent, Math.max(-extent - 0, Math.min(x, extent - w + 0))),
      y: Math.min(extent, Math.max(-extent - 0, Math.min(y, extent - w + 0))),
    };
  };

  const zoomAt = useCallback(
    (svgPoint: Point, factor: number) => {
      const w = Math.min(FULL, Math.max(FULL / 8, FULL / factor));
      setView(
        clampView({
          x: svgPoint.x - w / 2,
          y: svgPoint.y - w / 2,
          w,
        })
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [FULL]
  );

  const setPosition = useCallback(
    (norm: Point) => {
      const radius = Math.hypot(norm.x, norm.y);
      const max = profile.radii.inputAreaOuter;
      if (radius > max) {
        // 入力範囲ぎりぎりへクランプ
        const scale = max / radius;
        norm = { x: norm.x * scale, y: norm.y * scale };
      }
      setPos((prev) => {
        if (prev) setHistory((h) => [...h.slice(-19), prev]);
        return norm;
      });
    },
    [profile]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      if (p1 && p2) {
        pinchStart.current = {
          dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
          view,
          cx: (p1.x + p2.x) / 2,
          cy: (p1.y + p2.y) / 2,
        };
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [p1, p2] = [...pointers.current.values()];
      if (!p1 || !p2) return;
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (dist > 0 && pinchStart.current.dist > 0) {
        const ratio = dist / pinchStart.current.dist;
        const sv = pinchStart.current.view;
        const w = Math.min(FULL, Math.max(FULL / 8, sv.w / ratio));
        const center = toSvgPoint(
          pinchStart.current.cx,
          pinchStart.current.cy
        );
        setView(
          clampView({ x: center.x - w / 2, y: center.y - w / 2, w })
        );
      }
      moved.current = true;
      return;
    }

    if (pointers.current.size === 1 && prev) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.hypot(dx, dy) > 1) moved.current = true;
      if (moved.current && pos) {
        // ドラッグで位置を微調整
        const p = toSvgPoint(e.clientX, e.clientY);
        const norm = toNormalized(p);
        const radius = Math.hypot(norm.x, norm.y);
        const max = profile.radii.inputAreaOuter;
        if (radius <= max) setPos(norm);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasPinch = pointers.current.size >= 2;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (wasPinch || moved.current) return;

    // タップ
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    const now = Date.now();
    const last = lastTap.current;
    lastTap.current = { time: now, x: e.clientX, y: e.clientY };

    if (
      last &&
      now - last.time < 320 &&
      Math.hypot(e.clientX - last.x, e.clientY - last.y) < 32
    ) {
      // ダブルタップ: ズームのトグル
      if (view.w < FULL * 0.9) setView(fullView);
      else zoomAt(svgPoint, 3);
      lastTap.current = null;
      return;
    }

    setPosition(toNormalized(svgPoint));
    // タップ位置の自動拡大(全体表示時のみ)
    if (view.w > FULL * 0.9) zoomAt(svgPoint, 3);
  };

  const undo = () => {
    setHistory((h) => {
      const last = h[h.length - 1];
      if (last) setPos(last);
      return h.slice(0, -1);
    });
  };

  const nudge = (dx: number, dy: number) => {
    if (!pos) return;
    const step = 0.006;
    setPosition({ x: pos.x + dx * step, y: pos.y + dy * step });
  };

  const judged = useMemo(
    () => (pos ? judgePoint(pos.x, pos.y, profile) : null),
    [pos, profile]
  );

  const judgedLabel = judged
    ? judged.ring === "outboard"
      ? s.input.outboard
      : segmentLabel(judged.ring, judged.number)
    : "-";

  const confirm = () => {
    if (!pos || !judged) return;
    if (bounceMode) {
      onConfirm(landingBounceOut({ x: pos.x, y: pos.y }));
      return;
    }
    if (judged.ring === "outboard") {
      onConfirm(landingOutboardWithCoordinate(pos.x, pos.y));
    } else {
      onConfirm(landingFromCoordinate(pos.x, pos.y, profile));
    }
  };

  const markerScale = view.w / FULL;

  return (
    <div>
      <p className="muted small" style={{ textAlign: "center", margin: "0.2rem 0" }}>
        {s.input.tapToInput} / {s.input.zoomHint} / {s.input.dragToAdjust}
      </p>
      <div
        ref={wrapRef}
        className="board-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <BoardSVG
          profile={profile}
          showOutboardArea
          viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
        >
          {pos && (
            <g
              transform={`translate(${pos.x * BOARD_UNIT} ${-pos.y * BOARD_UNIT})`}
              aria-hidden
            >
              <line
                x1={-14 * markerScale}
                x2={14 * markerScale}
                y1={0}
                y2={0}
                stroke="#7fd4ff"
                strokeWidth={1.4 * markerScale}
              />
              <line
                y1={-14 * markerScale}
                y2={14 * markerScale}
                x1={0}
                x2={0}
                stroke="#7fd4ff"
                strokeWidth={1.4 * markerScale}
              />
              <circle
                r={5 * markerScale}
                fill="none"
                stroke="#7fd4ff"
                strokeWidth={1.4 * markerScale}
              />
            </g>
          )}
        </BoardSVG>
      </div>

      <div className="card" style={{ padding: "0.5rem 0.8rem" }}>
        <div className="list-row">
          <span className="muted small">{s.input.currentSelection}</span>
          <strong>
            {bounceMode ? `${s.input.bounceOut}: ` : ""}
            {judgedLabel}
          </strong>
          <span className="muted small">
            {pos ? `X ${fmtNum(pos.x)} / Y ${fmtNum(pos.y)}` : ""}
          </span>
        </div>
      </div>

      <div className="board-controls" role="group" aria-label="位置の微調整">
        <button className="btn small" onClick={() => nudge(0, 1)} disabled={!pos} aria-label="上へ微調整">↑</button>
        <button className="btn small" onClick={() => nudge(0, -1)} disabled={!pos} aria-label="下へ微調整">↓</button>
        <button className="btn small" onClick={() => nudge(-1, 0)} disabled={!pos} aria-label="左へ微調整">←</button>
        <button className="btn small" onClick={() => nudge(1, 0)} disabled={!pos} aria-label="右へ微調整">→</button>
        <button className="btn small" onClick={() => setView(fullView)}>
          {s.input.resetView}
        </button>
        <button className="btn small" onClick={undo} disabled={history.length === 0}>
          {s.input.undoPosition}
        </button>
      </div>

      {allowBounceOut && (
        <div className="board-controls">
          <button
            className={`choice${bounceMode ? " selected" : ""}`}
            onClick={() => setBounceMode((v) => !v)}
            aria-pressed={bounceMode}
          >
            {s.input.bounceOut}
          </button>
          <button
            className={`choice${showOutboardPicker ? " selected" : ""}`}
            onClick={() => setShowOutboardPicker((v) => !v)}
            aria-pressed={showOutboardPicker}
          >
            {s.input.outboard}(範囲外)
          </button>
        </div>
      )}

      {bounceMode && (
        <div className="info-box">
          {s.input.bounceOutPosition}
          <button
            className="btn small block"
            onClick={() => onConfirm(landingBounceOut())}
          >
            {s.input.bounceOutUnknown}
          </button>
        </div>
      )}

      {showOutboardPicker && (
        <div className="card">
          <h3>{s.input.outboardDirection}</h3>
          <div className="choice-row">
            {OUTBOARD_DIRECTIONS.map((dir) => (
              <button
                key={dir}
                className="choice"
                onClick={() => onConfirm(landingOutboardDirection(dir))}
              >
                {dir === "unknown"
                  ? s.input.directionUnknown
                  : s.direction[dir]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="btn-row action-bar">
        {onCancel && (
          <button className="btn" onClick={onCancel}>
            {s.common.cancel}
          </button>
        )}
        <button className="btn primary" onClick={confirm} disabled={!pos}>
          {s.input.confirmPosition}
        </button>
      </div>
    </div>
  );
}
