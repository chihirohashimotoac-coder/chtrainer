import { useNavigate } from "react-router-dom";
import { makeBullAnyTarget } from "../domain/targets";
import { useSetup } from "../state/SetupContext";
import type { TrainingMode } from "../types/models";
import { t } from "../i18n/ja";

export default function ModeSelectPage() {
  const s = t();
  const navigate = useNavigate();
  const { update } = useSetup();

  const modes: { key: TrainingMode; label: string; desc: string; icon: string; use: string }[] = [
    { key: "random", label: s.mode.random, desc: s.mode.randomDesc, icon: "◎", use: "総合的な課題の発見に" },
    { key: "zero_one", label: s.mode.zeroOne, desc: s.mode.zeroOneDesc, icon: "01", use: "削りとフィニッシュ精度に" },
    { key: "cricket", label: s.mode.cricket, desc: s.mode.cricketDesc, icon: "#", use: "ナンバー別・切替能力に" },
    { key: "bull", label: s.mode.bull, desc: s.mode.bullDesc, icon: "●", use: "Bull精度の反復測定に" },
  ];

  return (
    <div className="mode-page">
      <h1>{s.mode.title}</h1>
      <p className="page-lead">測定したい能力からモードを選択してください。</p>
      <div className="mode-grid">
      {modes.map((m) => (
        <button
          key={m.key}
          className="card selectable mode-card"
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
          <span className="mode-icon" aria-hidden>{m.icon}</span>
          <span className="mode-copy"><strong>{m.label}</strong>
          <div className="muted small">{m.desc}</div>
          <span className="mode-use">推奨：{m.use}</span></span>
        </button>
      ))}
      </div>
    </div>
  );
}
