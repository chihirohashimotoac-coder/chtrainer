import { useMemo, useState } from "react";
import type { BoardProfile } from "../config/boardProfiles";
import type { ThrowRecord } from "../types/models";
import { BoardSVG, BOARD_UNIT } from "./BoardSVG";
import { t } from "../i18n/ja";

/** 投擲順ごとの色(1/2/3投目)。盤面と干渉しにくい寒色〜暖色。 */
const ORDER_COLORS: Record<1 | 2 | 3, string> = {
  1: "#4fc3ff",
  2: "#ffd166",
  3: "#8be0a4",
};

interface Plotted {
  x: number;
  y: number;
  dart: 1 | 2 | 3;
  approx: boolean;
}

/**
 * 着弾散布図/ヒートマップ。実描画の盤面SVGに、正規化座標(外側ダブル=1.0)の
 * 着弾点を重ねる。座標を持つ投擲のみ対象(アウトボード方向のみ・位置不明は除外)。
 */
export function LandingScatter({
  throws,
  profile,
}: {
  throws: ThrowRecord[];
  profile: BoardProfile;
}) {
  const s = t();
  const [orderFilter, setOrderFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [targetFilter, setTargetFilter] = useState<string>("");
  const [showHeat, setShowHeat] = useState(true);

  const targetLabels = useMemo(
    () => [...new Set(throws.map((th) => th.target.label))].sort(),
    [throws]
  );

  const points = useMemo<Plotted[]>(() => {
    const out: Plotted[] = [];
    for (const th of throws) {
      const { x, y, ring } = th.landing;
      if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      if (ring === "bounce_out") continue;
      if (orderFilter !== "all" && th.dartInSet !== orderFilter) continue;
      if (targetFilter && th.target.label !== targetFilter) continue;
      out.push({
        x,
        y,
        dart: th.dartInSet,
        approx: th.landing.positionPrecision !== "coordinate",
      });
    }
    return out;
  }, [throws, orderFilter, targetFilter]);

  const hasAnyCoord = useMemo(
    () =>
      throws.some(
        (th) => th.landing.x != null && th.landing.y != null && th.landing.ring !== "bounce_out"
      ),
    [throws]
  );

  if (!hasAnyCoord) {
    return <p className="muted small">{s.scatter.noData}</p>;
  }

  return (
    <div>
      <div className="choice-row" style={{ marginBottom: "0.5rem" }}>
        {(["all", 1, 2, 3] as const).map((o) => (
          <button
            key={o}
            className={`choice${orderFilter === o ? " selected" : ""}`}
            onClick={() => setOrderFilter(o)}
            aria-pressed={orderFilter === o}
          >
            {o === "all" ? s.scatter.allOrders : `${o}${s.scatter.orderUnit}`}
          </button>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 0, alignItems: "center" }}>
        <label className="field" style={{ margin: 0, flex: "1 1 12rem" }}>
          <span>{s.scatter.byTarget}</span>
          <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)}>
            <option value="">{s.scatter.allTargets}</option>
            {targetLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`choice${showHeat ? " selected" : ""}`}
          onClick={() => setShowHeat((v) => !v)}
          aria-pressed={showHeat}
          style={{ alignSelf: "flex-end" }}
        >
          {s.scatter.heat}
        </button>
      </div>

      <div className="board-wrap" style={{ maxWidth: "min(92vw, 420px)" }}>
        <BoardSVG profile={profile} showOutboardArea>
          <g aria-hidden>
            {showHeat &&
              points.map((p, i) => (
                <circle
                  key={`h${i}`}
                  cx={p.x * BOARD_UNIT}
                  cy={-p.y * BOARD_UNIT}
                  r={6.5}
                  fill={ORDER_COLORS[p.dart]}
                  opacity={0.14}
                />
              ))}
            {points.map((p, i) => (
              <circle
                key={`d${i}`}
                cx={p.x * BOARD_UNIT}
                cy={-p.y * BOARD_UNIT}
                r={1.7}
                fill={p.approx ? "none" : ORDER_COLORS[p.dart]}
                stroke={ORDER_COLORS[p.dart]}
                strokeWidth={p.approx ? 1 : 0.5}
              />
            ))}
          </g>
        </BoardSVG>
      </div>

      <div className="scatter-legend muted small">
        <span>
          <i style={{ background: ORDER_COLORS[1] }} />1{s.scatter.orderUnit}
        </span>
        <span>
          <i style={{ background: ORDER_COLORS[2] }} />2{s.scatter.orderUnit}
        </span>
        <span>
          <i style={{ background: ORDER_COLORS[3] }} />3{s.scatter.orderUnit}
        </span>
        <span className="scatter-legend-hollow">
          <i />
          {s.scatter.approx}
        </span>
        <span>
          {s.scatter.plotted}: {points.length}
        </span>
      </div>
    </div>
  );
}
