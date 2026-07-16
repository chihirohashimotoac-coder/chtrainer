import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DARTS_PER_SET,
  MAX_SETS,
  MIN_SETS,
  SET_PRESETS,
} from "../config/constants";
import { useSetup } from "../state/SetupContext";
import { t } from "../i18n/ja";

/** セット数の検証 */
export function validateSetCount(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_SETS && value <= MAX_SETS;
}

export default function SetCountPage() {
  const s = t();
  const navigate = useNavigate();
  const { setup, update } = useSetup();
  const [setCount, setSetCount] = useState(setup.setCount);
  const [customValue, setCustomValue] = useState(String(setup.setCount));
  const [error, setError] = useState("");

  const applyCustom = (text: string) => {
    setCustomValue(text);
    const n = Number(text);
    if (validateSetCount(n)) {
      setSetCount(n);
      setError("");
    } else {
      setError(
        s.sets.validationRange
          .replace("{min}", String(MIN_SETS))
          .replace("{max}", String(MAX_SETS))
      );
    }
  };

  return (
    <div>
      <h1>{s.sets.title}</h1>
      {setup.mode === "random" && (
        <div className="info-box">{s.target.diagnosticSetHint}</div>
      )}
      {setup.mode === "skill_check" && (
        <div className="info-box">{s.target.skillSetHint}</div>
      )}
      <div className="choice-row">
        {SET_PRESETS.map((preset) => (
          <button
            key={preset}
            className={`choice${setCount === preset ? " selected" : ""}`}
            onClick={() => {
              setSetCount(preset);
              setCustomValue(String(preset));
              setError("");
            }}
            aria-pressed={setCount === preset}
          >
            {preset}
            {s.sets.setsUnit} ({preset * DARTS_PER_SET}
            {s.sets.throwsUnit})
          </button>
        ))}
      </div>

      <label className="field">
        <span>
          {s.sets.custom} ({MIN_SETS}〜{MAX_SETS})
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_SETS}
          max={MAX_SETS}
          value={customValue}
          onChange={(e) => applyCustom(e.target.value)}
        />
      </label>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <div className="list-row">
          <span>{s.sets.setCount}</span>
          <strong>
            {setCount}
            {s.sets.setsUnit}
          </strong>
        </div>
        <div className="list-row">
          <span>{s.sets.totalThrows}</span>
          <strong>
            {setCount * DARTS_PER_SET}
            {s.sets.throwsUnit}
          </strong>
        </div>
      </div>

      <div className="action-bar">
        <button
          className="btn primary block"
          disabled={!validateSetCount(setCount) || error !== ""}
          onClick={() => {
            if (!validateSetCount(setCount)) return;
            update({ setCount });
            navigate("/train/pre");
          }}
        >
          {s.common.next}
        </button>
      </div>
    </div>
  );
}
