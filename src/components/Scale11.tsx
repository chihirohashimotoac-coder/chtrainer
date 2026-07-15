import { ASSESSMENT_MAX, ASSESSMENT_MIN } from "../config/constants";

interface Scale11Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/** 0〜10の11段階セレクタ */
export function Scale11({ label, value, onChange }: Scale11Props) {
  return (
    <fieldset>
      <legend>
        {label}: <strong>{value}</strong>
      </legend>
      <div className="scale11" role="radiogroup" aria-label={label}>
        {Array.from(
          { length: ASSESSMENT_MAX - ASSESSMENT_MIN + 1 },
          (_, i) => i + ASSESSMENT_MIN
        ).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={value === n ? "selected" : ""}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
