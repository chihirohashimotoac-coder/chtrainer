import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AssessmentForm } from "../components/AssessmentForm";
import { defaultBoardProfileFor } from "../config/boardProfiles";
import { DARTS_PER_SET } from "../config/constants";
import { saveSession } from "../db/db";
import { generatePlannedTargets } from "../domain/planner";
import { useApp } from "../state/AppContext";
import { useSetup } from "../state/SetupContext";
import { modeLabel } from "../export/markdown";
import {
  SCHEMA_VERSION,
  type BoardType,
  type DailyCondition,
  type InputMethod,
  type SelfAssessment,
  type SessionEnvironment,
  type TrainingSession,
} from "../types/models";
import { newId, nowIso } from "../utils/id";
import { t } from "../i18n/ja";

export default function PreSessionPage() {
  const s = t();
  const navigate = useNavigate();
  const { player, equipmentProfiles, refresh } = useApp();
  const { setup, reset } = useSetup();

  const [step, setStep] = useState<"form" | "assessment" | "confirm">("form");
  const [boardType, setBoardType] = useState<BoardType>(
    player?.defaultBoardType ?? "soft"
  );
  const [hand, setHand] = useState(player?.dominantHand ?? "right");
  const [equipmentId, setEquipmentId] = useState(
    player?.defaultEquipmentProfileId ?? ""
  );
  const [inputMethod, setInputMethod] = useState<InputMethod>(
    player?.defaultInputMethod ?? "coordinate"
  );
  const [condition, setCondition] = useState<DailyCondition>("usual");
  const [conditionNote, setConditionNote] = useState("");
  const [location, setLocation] = useState("");
  const [boardName, setBoardName] = useState("");
  const [lighting, setLighting] = useState("");
  const [temperature, setTemperature] = useState("");
  const [ocheNote, setOcheNote] = useState("");
  const [assessment, setAssessment] = useState<SelfAssessment>();

  if (!setup.mode || setup.targets.length === 0) {
    return (
      <div>
        <h1>{s.preSession.title}</h1>
        <p className="muted">{s.target.selectAtLeastOne}</p>
        <button className="btn block" onClick={() => navigate("/train/mode")}>
          {s.mode.title}
        </button>
      </div>
    );
  }

  const start = async (finalAssessment: SelfAssessment) => {
    const now = nowIso();
    const environment: SessionEnvironment = {
      ...(location ? { location } : {}),
      ...(boardName ? { boardName } : {}),
      ...(lighting ? { lighting } : {}),
      ...(temperature !== "" && Number.isFinite(Number(temperature))
        ? { temperatureC: Number(temperature) }
        : {}),
      ...(ocheNote ? { ocheNote } : {}),
    };
    const plannedTargets = generatePlannedTargets(
      setup.arrangement ?? "same_per_set",
      setup.targets,
      setup.setCount
    );
    const session: TrainingSession = {
      schemaVersion: SCHEMA_VERSION,
      id: newId(),
      playerId: player?.id ?? "unknown",
      boardType,
      boardProfileId: defaultBoardProfileFor(boardType).id,
      ...(equipmentId ? { equipmentProfileId: equipmentId } : {}),
      trainingMode: setup.mode ?? "random",
      ...(setup.randomVariant ? { randomVariant: setup.randomVariant } : {}),
      ...(setup.arrangement ? { arrangement: setup.arrangement } : {}),
      inputMethod,
      dominantHand: hand,
      setCount: setup.setCount,
      plannedThrowCount: setup.setCount * DARTS_PER_SET,
      plannedTargets,
      startedAt: now,
      dailyCondition: condition,
      ...(conditionNote ? { dailyConditionNote: conditionNote } : {}),
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
      assessments: [finalAssessment],
      status: "active",
      progress: { currentSetNumber: 1, middleAssessmentDone: false },
      createdAt: now,
      updatedAt: now,
    };
    try {
      await saveSession(session);
      await refresh();
      reset();
      navigate("/train/session", { replace: true });
    } catch {
      alert(s.errors.dbSaveFailed);
    }
  };

  if (step === "assessment") {
    return (
      <div>
        <h1>{s.assessment.beforeTitle}</h1>
        <AssessmentForm
          timing="before"
          onSubmit={(a) => {
            setAssessment(a);
            setStep("confirm");
          }}
        />
      </div>
    );
  }

  if (step === "confirm") {
    const equipment = equipmentProfiles.find((e) => e.id === equipmentId);
    return (
      <div>
        <h1>{s.preSession.summary}</h1>
        <div className="card">
          <div className="list-row">
            <span className="muted">{s.mode.title}</span>
            <strong>{modeLabel(setup.mode)}</strong>
          </div>
          <div className="list-row">
            <span className="muted">{s.target.title}</span>
            <strong>
              {[...new Set(setup.targets.map((x) => x.label))].join(", ")}
            </strong>
          </div>
          <div className="list-row">
            <span className="muted">{s.sets.setCount}</span>
            <strong>
              {setup.setCount}
              {s.sets.setsUnit} ({setup.setCount * DARTS_PER_SET}
              {s.sets.throwsUnit})
            </strong>
          </div>
          <div className="list-row">
            <span className="muted">{s.preSession.boardType}</span>
            <strong>{boardType === "steel" ? s.player.steel : s.player.soft}</strong>
          </div>
          <div className="list-row">
            <span className="muted">{s.preSession.equipment}</span>
            <strong>{equipment?.name ?? s.common.none}</strong>
          </div>
          <div className="list-row">
            <span className="muted">{s.preSession.inputMethod}</span>
            <strong>
              {inputMethod === "coordinate"
                ? s.player.inputCoordinate
                : s.player.inputSimple}
            </strong>
          </div>
          <div className="list-row">
            <span className="muted">{s.preSession.dailyCondition}</span>
            <strong>
              {condition === "better_than_usual"
                ? s.preSession.better
                : condition === "usual"
                  ? s.preSession.usual
                  : s.preSession.worse}
            </strong>
          </div>
        </div>
        <div className="btn-row action-bar">
          <button className="btn" onClick={() => setStep("form")}>
            {s.common.back}
          </button>
          <button
            className="btn primary"
            onClick={() => assessment && start(assessment)}
          >
            {s.common.start}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{s.preSession.title}</h1>

      <fieldset>
        <legend>{s.preSession.boardType} ({s.common.required})</legend>
        <div className="choice-row">
          {(
            [
              ["soft", s.player.soft],
              ["steel", s.player.steel],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${boardType === key ? " selected" : ""}`}
              onClick={() => setBoardType(key)}
              aria-pressed={boardType === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{s.preSession.dominantHand}</legend>
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
              className={`choice${hand === key ? " selected" : ""}`}
              onClick={() => setHand(key)}
              aria-pressed={hand === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>{s.preSession.equipment}</span>
        <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          <option value="">{s.common.none}</option>
          {equipmentProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>{s.preSession.inputMethod}</legend>
        <div className="choice-row">
          {(
            [
              ["coordinate", s.player.inputCoordinate],
              ["simple", s.player.inputSimple],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${inputMethod === key ? " selected" : ""}`}
              onClick={() => setInputMethod(key)}
              aria-pressed={inputMethod === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{s.preSession.dailyCondition} ({s.common.required})</legend>
        <div className="choice-row">
          {(
            [
              ["better_than_usual", s.preSession.better],
              ["usual", s.preSession.usual],
              ["worse_than_usual", s.preSession.worse],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${condition === key ? " selected" : ""}`}
              onClick={() => setCondition(key)}
              aria-pressed={condition === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>{s.preSession.conditionNote}</span>
        <input
          type="text"
          value={conditionNote}
          onChange={(e) => setConditionNote(e.target.value)}
        />
      </label>

      <h2>{s.preSession.environment}</h2>
      <label className="field">
        <span>{s.preSession.location}</span>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="field">
        <span>{s.preSession.boardName}</span>
        <input type="text" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
      </label>
      <label className="field">
        <span>{s.preSession.lighting}</span>
        <input type="text" value={lighting} onChange={(e) => setLighting(e.target.value)} />
      </label>
      <label className="field">
        <span>{s.preSession.temperature}</span>
        <input
          type="number"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        />
      </label>
      <label className="field">
        <span>{s.preSession.ocheNote}</span>
        <input type="text" value={ocheNote} onChange={(e) => setOcheNote(e.target.value)} />
      </label>

      <div className="action-bar">
        <button className="btn primary block" onClick={() => setStep("assessment")}>
          {s.common.next}
        </button>
      </div>
    </div>
  );
}
