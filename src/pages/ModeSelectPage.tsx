import { useNavigate } from "react-router-dom";
import { makeBullAnyTarget } from "../domain/targets";
import { useSetup } from "../state/SetupContext";
import type { TrainingMode } from "../types/models";
import { t } from "../i18n/ja";

export default function ModeSelectPage() {
  const s = t();
  const navigate = useNavigate();
  const { update } = useSetup();

  const modes: { key: TrainingMode; label: string; desc: string }[] = [
    { key: "zero_one", label: s.mode.zeroOne, desc: s.mode.zeroOneDesc },
    { key: "cricket", label: s.mode.cricket, desc: s.mode.cricketDesc },
    { key: "bull", label: s.mode.bull, desc: s.mode.bullDesc },
    { key: "random", label: s.mode.random, desc: s.mode.randomDesc },
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
            if (m.key === "bull") {
              // ブル練習はBull全体固定。ターゲット選択をスキップして開始
              update({
                mode: "bull",
                targets: [makeBullAnyTarget()],
                arrangement: "same_per_set",
                randomVariant: undefined,
              });
              navigate("/train/sets");
              return;
            }
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
