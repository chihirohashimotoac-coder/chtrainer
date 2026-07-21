import { useState } from "react";
import type {
  DominantEye,
  GripFingerCount,
  GripPosition,
  PlayerGoal,
  PlayerProfile,
  Stance,
  TakebackDepth,
  ThrowingTempo,
} from "../types/models";
import { SCHEMA_VERSION } from "../types/models";
import { newId, nowIso } from "../utils/id";
import { t } from "../i18n/ja";

const DART_COLOR_PRESETS = [
  "#e05252",
  "#4f7fe0",
  "#f0f0f0",
  "#f0b246",
  "#3d9960",
  "#9b59b6",
  "#222222",
];

interface PlayerFormProps {
  initial?: PlayerProfile;
  onSave: (player: PlayerProfile) => void;
  saveLabel?: string;
}

export function PlayerForm({ initial, onSave, saveLabel }: PlayerFormProps) {
  const s = t();
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [dominantHand, setDominantHand] = useState<PlayerProfile["dominantHand"]>(
    initial?.dominantHand ?? "right"
  );
  const [dominantEye, setDominantEye] = useState<DominantEye>(
    initial?.dominantEye ?? "unknown"
  );
  const [stance, setStance] = useState<Stance | "">(initial?.stance ?? "");
  const [gripFingerCount, setGripFingerCount] = useState<GripFingerCount | "">(
    initial?.form?.gripFingerCount ?? ""
  );
  const [gripPosition, setGripPosition] = useState<GripPosition | "">(
    initial?.form?.gripPosition ?? ""
  );
  const [takeback, setTakeback] = useState<TakebackDepth | "">(
    initial?.form?.takeback ?? ""
  );
  const [throwingTempo, setThrowingTempo] = useState<ThrowingTempo | "">(
    initial?.form?.throwingTempo ?? ""
  );
  const [formConcern, setFormConcern] = useState(initial?.form?.concern ?? "");
  const [goal, setGoal] = useState<PlayerGoal | "">(initial?.goal ?? "");
  const [currentLevel, setCurrentLevel] = useState(initial?.currentLevel ?? "");
  const [targetLevel, setTargetLevel] = useState(initial?.targetLevel ?? "");
  const [concern, setConcern] = useState(initial?.concern ?? "");
  const [dartColors, setDartColors] = useState<[string, string, string]>(
    initial?.dartColors ?? ["#e05252", "#4f7fe0", "#f0f0f0"]
  );
  const [error, setError] = useState("");

  const save = () => {
    if (!displayName.trim()) {
      setError(s.player.nameRequired);
      return;
    }
    const now = nowIso();
    onSave({
      schemaVersion: SCHEMA_VERSION,
      id: initial?.id ?? newId(),
      displayName: displayName.trim(),
      dominantHand,
      dominantEye,
      ...(stance ? { stance } : {}),
      ...(gripFingerCount || gripPosition || takeback || throwingTempo || formConcern.trim()
        ? {
            form: {
              ...(gripFingerCount ? { gripFingerCount } : {}),
              ...(gripPosition ? { gripPosition } : {}),
              ...(takeback ? { takeback } : {}),
              ...(throwingTempo ? { throwingTempo } : {}),
              ...(formConcern.trim() ? { concern: formConcern.trim() } : {}),
            },
          }
        : {}),
      ...(goal ? { goal } : {}),
      ...(currentLevel.trim() ? { currentLevel: currentLevel.trim() } : {}),
      ...(targetLevel.trim() ? { targetLevel: targetLevel.trim() } : {}),
      ...(concern.trim() ? { concern: concern.trim() } : {}),
      // 以下はセッション開始前設定で毎回選択するため、UIからは設定しない
      // (既存プロファイルの値、または既定値を保持)
      defaultBoardType: initial?.defaultBoardType ?? "soft",
      ...(initial?.defaultEquipmentProfileId
        ? { defaultEquipmentProfileId: initial.defaultEquipmentProfileId }
        : {}),
      dartColors,
      defaultInputMethod: initial?.defaultInputMethod ?? "coordinate",
      vibrationEnabled: initial?.vibrationEnabled ?? true,
      soundEnabled: initial?.soundEnabled ?? false,
      autoAdvanceEnabled: initial?.autoAdvanceEnabled ?? true,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  const setColor = (index: 0 | 1 | 2, color: string) => {
    setDartColors((prev) => {
      const next: [string, string, string] = [...prev];
      next[index] = color;
      return next;
    });
  };

  return (
    <div>
      <label className="field">
        <span>
          {s.player.displayName} ({s.common.required})
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={30}
        />
      </label>
      {error && <p className="error-text">{error}</p>}

      <fieldset>
        <legend>{s.player.dominantHand}</legend>
        <div className="choice-row">
          {(
            [
              ["right", s.player.right],
              ["left", s.player.left],
              ["ambidextrous", s.player.ambidextrous],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${dominantHand === key ? " selected" : ""}`}
              onClick={() => setDominantHand(key)}
              aria-pressed={dominantHand === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <details className="card">
        <summary><strong>{s.player.formInfo}</strong> ({s.common.optional})</summary>
        <p className="muted small">{s.player.formInfoHint}</p>
        <label className="field" htmlFor="player-grip-finger-count">
          <span>{s.player.gripFingerCount}</span>
          <select id="player-grip-finger-count" value={gripFingerCount} onChange={(e) => setGripFingerCount(e.target.value as GripFingerCount | "")}>
            <option value="">{s.common.none}</option>
            <option value="2">2フィンガー</option>
            <option value="3">3フィンガー</option>
            <option value="4">4フィンガー</option>
            <option value="other">その他</option>
            <option value="unknown">不明</option>
          </select>
        </label>
        <label className="field" htmlFor="player-grip-position">
          <span>{s.player.gripPosition}</span>
          <select id="player-grip-position" value={gripPosition} onChange={(e) => setGripPosition(e.target.value as GripPosition | "")}>
            <option value="">{s.common.none}</option>
            <option value="front">前方</option>
            <option value="center">中央</option>
            <option value="rear">後方</option>
            <option value="unknown">不明</option>
          </select>
        </label>
        <label className="field" htmlFor="player-takeback">
          <span>{s.player.takeback}</span>
          <select id="player-takeback" value={takeback} onChange={(e) => setTakeback(e.target.value as TakebackDepth | "")}>
            <option value="">{s.common.none}</option>
            <option value="shallow">浅い</option>
            <option value="standard">標準</option>
            <option value="deep">深い</option>
            <option value="unknown">不明</option>
          </select>
        </label>
        <label className="field" htmlFor="player-throwing-tempo">
          <span>{s.player.throwingTempo}</span>
          <select id="player-throwing-tempo" value={throwingTempo} onChange={(e) => setThrowingTempo(e.target.value as ThrowingTempo | "")}>
            <option value="">{s.common.none}</option>
            <option value="slow">遅い</option>
            <option value="standard">標準</option>
            <option value="fast">速い</option>
            <option value="unknown">不明</option>
          </select>
        </label>
        <label className="field">
          <span>{s.player.formConcern}</span>
          <textarea
            value={formConcern}
            onChange={(e) => setFormConcern(e.target.value)}
            placeholder={s.player.formConcernPlaceholder}
            maxLength={300}
          />
        </label>
      </details>

      <fieldset>
        <legend>{s.player.dominantEye}</legend>
        <div className="choice-row">
          {(
            [
              ["right", s.player.eyeRight],
              ["left", s.player.eyeLeft],
              ["unknown", s.player.eyeUnknown],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${dominantEye === key ? " selected" : ""}`}
              onClick={() => setDominantEye(key)}
              aria-pressed={dominantEye === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{s.player.stance} ({s.common.optional})</legend>
        <div className="choice-row">
          {(
            [
              ["closed", s.player.stanceClosed],
              ["middle", s.player.stanceMiddle],
              ["open", s.player.stanceOpen],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${stance === key ? " selected" : ""}`}
              onClick={() => setStance(stance === key ? "" : key)}
              aria-pressed={stance === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{s.player.goalSection}</legend>
        <p className="muted small" style={{ margin: "0 0 0.4rem" }}>
          {s.player.goalSectionHint}
        </p>
        <div className="choice-row">
          {(
            [
              ["rating", s.player.goalRating],
              ["recovery", s.player.goalRecovery],
              ["zero_one", s.player.goalZeroOne],
              ["cricket", s.player.goalCricket],
              ["pro", s.player.goalPro],
              ["form_check", s.player.goalFormCheck],
              ["bull", s.player.goalBull],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${goal === key ? " selected" : ""}`}
              onClick={() => setGoal(goal === key ? "" : key)}
              aria-pressed={goal === key}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{s.player.currentLevel}</span>
          <input
            type="text"
            value={currentLevel}
            onChange={(e) => setCurrentLevel(e.target.value)}
            placeholder={s.player.currentLevelPlaceholder}
            maxLength={60}
          />
        </label>
        <label className="field">
          <span>{s.player.targetLevel}</span>
          <input
            type="text"
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            placeholder={s.player.targetLevelPlaceholder}
            maxLength={60}
          />
        </label>
        <label className="field">
          <span>{s.player.concern}</span>
          <textarea
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            placeholder={s.player.concernPlaceholder}
            maxLength={300}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>
          {s.player.dartColors} — {s.player.dartColorsHint}
        </legend>
        {([0, 1, 2] as const).map((i) => (
          <div key={i} className="list-row">
            <span className="dart-chip">
              <span
                className="color-dot"
                style={{ background: dartColors[i] }}
              />
              {i === 0 ? s.player.dart1 : i === 1 ? s.player.dart2 : s.player.dart3}
            </span>
            <span className="choice-row">
              {DART_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  className="choice"
                  style={{
                    background: c,
                    minWidth: 36,
                    minHeight: 36,
                    padding: 0,
                    borderColor: dartColors[i] === c ? "var(--accent)" : undefined,
                    borderWidth: dartColors[i] === c ? 3 : 1,
                  }}
                  onClick={() => setColor(i, c)}
                  aria-label={`${i + 1}投目の色 ${c}`}
                  aria-pressed={dartColors[i] === c}
                />
              ))}
            </span>
          </div>
        ))}
      </fieldset>

      <div className="action-bar">
        <button className="btn primary block" onClick={save}>
          {saveLabel ?? s.common.save}
        </button>
      </div>
    </div>
  );
}
