import { useNavigate } from "react-router-dom";
import { useSetup } from "../state/SetupContext";
import type { TrainingMode } from "../types/models";
import { t } from "../i18n/ja";

export default function ModeSelectPage() {
  const s = t();
  const navigate = useNavigate();
  const { update } = useSetup();

  const modes: { key: TrainingMode; label: string; desc: string }[] = [
    { key: "same_target", label: s.mode.same_target, desc: s.mode.same_targetDesc },
    {
      key: "per_dart_targets",
      label: s.mode.per_dart_targets,
      desc: s.mode.per_dart_targetsDesc,
    },
    { key: "random", label: s.mode.random, desc: s.mode.randomDesc },
    { key: "sequence", label: s.mode.sequence, desc: s.mode.sequenceDesc },
    { key: "bull", label: s.mode.bull, desc: s.mode.bullDesc },
    { key: "double", label: s.mode.double, desc: s.mode.doubleDesc },
    { key: "triple", label: s.mode.triple, desc: s.mode.tripleDesc },
    { key: "number", label: s.mode.number, desc: s.mode.numberDesc },
  ];

  return (
    <div>
      <h1>{s.mode.title}</h1>
      {modes.map((m) => (
        <button
          key={m.key}
          className="card selectable"
          style={{ display: "block", width: "100%", textAlign: "left" }}
          onClick={() => {
            update({ mode: m.key, targets: [], arrangement: undefined });
            navigate("/train/targets");
          }}
        >
          <strong>{m.label}</strong>
          <div className="muted small">{m.desc}</div>
        </button>
      ))}
    </div>
  );
}
