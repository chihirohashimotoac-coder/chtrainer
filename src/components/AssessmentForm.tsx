import { useState } from "react";
import type { SelfAssessment } from "../types/models";
import { nowIso } from "../utils/id";
import { Scale11 } from "./Scale11";
import { t } from "../i18n/ja";

interface AssessmentFormProps {
  timing: SelfAssessment["timing"];
  onSubmit: (assessment: SelfAssessment) => void;
  submitLabel?: string;
}

/** 自己評価入力フォーム(開始前・中間・終了後で共用) */
export function AssessmentForm({
  timing,
  onSubmit,
  submitLabel,
}: AssessmentFormProps) {
  const s = t();
  const [fatigue, setFatigue] = useState(5);
  const [concentration, setConcentration] = useState(5);
  const [pain, setPain] = useState(0);
  const [confidence, setConfidence] = useState(5);
  const [conditionChange, setConditionChange] = useState<
    "better" | "same" | "worse"
  >("same");
  const [note, setNote] = useState("");

  const submit = () => {
    const assessment: SelfAssessment = {
      timing,
      recordedAt: nowIso(),
      fatigue,
      concentration,
      pain,
      confidence,
      ...(timing !== "before" ? { conditionChange } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    onSubmit(assessment);
  };

  return (
    <div>
      <p className="muted small">
        {s.assessment.scaleHint0}
        <br />
        {s.assessment.scaleHint10}
      </p>
      <Scale11 label={s.assessment.fatigue} value={fatigue} onChange={setFatigue} />
      <Scale11
        label={s.assessment.concentration}
        value={concentration}
        onChange={setConcentration}
      />
      <Scale11 label={s.assessment.pain} value={pain} onChange={setPain} />
      <p className="muted small">{s.assessment.painDisclaimer}</p>
      <Scale11
        label={s.assessment.confidence}
        value={confidence}
        onChange={setConfidence}
      />

      {timing !== "before" && (
        <fieldset>
          <legend>{s.assessment.conditionChange}</legend>
          <div className="choice-row">
            {(
              [
                ["better", s.assessment.changeBetter],
                ["same", s.assessment.changeSame],
                ["worse", s.assessment.changeWorse],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`choice${conditionChange === key ? " selected" : ""}`}
                onClick={() => setConditionChange(key)}
                aria-pressed={conditionChange === key}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="field">
        <span>{s.assessment.note}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="action-bar">
        <button className="btn primary block" onClick={submit}>
          {submitLabel ?? s.common.next}
        </button>
      </div>
    </div>
  );
}
