import { useState } from "react";
import type { BoardProfile } from "../config/boardProfiles";
import type { LandingRecord, OutboardDirection, Ring } from "../types/models";
import {
  landingBounceOut,
  landingFromSegment,
  landingOutboardDirection,
} from "../domain/landing";
import { parseSpeedKmh } from "../utils/speed";
import { t } from "../i18n/ja";

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

interface SimpleInputProps {
  profile: BoardProfile;
  onConfirm: (landing: LandingRecord, speedKmh?: number) => void;
  onCancel?: () => void;
}

/**
 * 簡易入力: ナンバー+リング種別を選択する。
 * 座標はエリア代表点による概算値として記録される。
 */
export function SimpleInput({ profile, onConfirm, onCancel }: SimpleInputProps) {
  const s = t();
  const [number, setNumber] = useState<number | null>(null);
  const [ring, setRing] = useState<Ring | "outboard_menu" | null>(null);
  const [speed, setSpeed] = useState("");

  /** 任意入力の矢速を添えて着弾を確定する */
  const emit = (landing: LandingRecord) =>
    onConfirm(landing, parseSpeedKmh(speed));

  const needsNumber =
    ring === "outer_single" || ring === "double" || ring === "triple";

  const ringChoices: { key: Ring; label: string }[] = [
    { key: "outer_single", label: s.input.singleAny },
    { key: "double", label: s.input.double },
    { key: "triple", label: s.input.triple },
    { key: "outer_bull", label: s.input.outerBull },
    { key: "inner_bull", label: s.input.innerBull },
  ];

  const confirm = () => {
    if (ring === "inner_bull" || ring === "outer_bull") {
      emit(landingFromSegment(ring, profile));
      return;
    }
    if (
      number != null &&
      (ring === "outer_single" || ring === "double" || ring === "triple")
    ) {
      emit(landingFromSegment(ring, profile, number));
    }
  };

  const canConfirm =
    ring === "inner_bull" ||
    ring === "outer_bull" ||
    (needsNumber && number != null);

  return (
    <div>
      <p className="muted small">{s.input.approxNote}</p>
      <fieldset>
        <legend>{s.input.selectRing}</legend>
        <div className="choice-row">
          {ringChoices.map((c) => (
            <button
              key={c.key}
              className={`choice${ring === c.key ? " selected" : ""}`}
              onClick={() => setRing(c.key)}
              aria-pressed={ring === c.key}
            >
              {c.label}
            </button>
          ))}
          <button
            className={`choice${ring === "outboard" ? " selected" : ""}`}
            onClick={() => setRing("outboard")}
            aria-pressed={ring === "outboard"}
          >
            {s.input.outboard}
          </button>
          <button
            className={`choice${ring === "bounce_out" ? " selected" : ""}`}
            onClick={() => setRing("bounce_out")}
            aria-pressed={ring === "bounce_out"}
          >
            {s.input.bounceOut}
          </button>
        </div>
      </fieldset>

      {needsNumber && (
        <fieldset>
          <legend>{s.input.selectNumber}</legend>
          <div className="number-grid">
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={number === n ? "selected" : ""}
                onClick={() => setNumber(n)}
                aria-pressed={number === n}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {ring === "outboard" && (
        <fieldset>
          <legend>{s.input.outboardDirection}</legend>
          <div className="choice-row">
            {OUTBOARD_DIRECTIONS.map((dir) => (
              <button
                key={dir}
                className="choice"
                onClick={() => emit(landingOutboardDirection(dir))}
              >
                {dir === "unknown"
                  ? s.input.directionUnknown
                  : s.direction[dir]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {ring === "bounce_out" && (
        <div className="info-box">
          <button
            className="btn small block"
            onClick={() => emit(landingBounceOut())}
          >
            {s.input.bounceOutUnknown}
          </button>
        </div>
      )}

      <label className="field">
        <span>{s.input.speedLabel}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
          placeholder={s.input.speedPlaceholder}
        />
      </label>

      <div className="btn-row action-bar">
        {onCancel && (
          <button className="btn" onClick={onCancel}>
            {s.common.cancel}
          </button>
        )}
        <button className="btn primary" onClick={confirm} disabled={!canConfirm}>
          {s.common.confirm}
        </button>
      </div>
    </div>
  );
}
