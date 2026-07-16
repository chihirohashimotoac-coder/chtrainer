import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultBoardProfileFor } from "../config/boardProfiles";
import {
  buildFullRandomPool,
  makeCustomTarget,
  makeSegmentTarget,
} from "../domain/targets";
import { shuffle, type Arrangement } from "../domain/planner";
import { useApp } from "../state/AppContext";
import { useSetup } from "../state/SetupContext";
import type { TargetArea, TargetDefinition } from "../types/models";
import { t } from "../i18n/ja";

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function TargetSelectPage() {
  const s = t();
  const navigate = useNavigate();
  const { player } = useApp();
  const { setup, update } = useSetup();
  const mode = setup.mode ?? "random";
  const profile = useMemo(
    () => defaultBoardProfileFor(player?.defaultBoardType ?? "soft"),
    [player]
  );

  const [targets, setTargets] = useState<TargetDefinition[]>(setup.targets);
  const [arrangement, setArrangement] = useState<Arrangement>(
    setup.arrangement ?? "balanced"
  );
  const [orderOrBalanced, setOrderOrBalanced] = useState<"cycle" | "balanced">(
    "balanced"
  );
  const [numberKind, setNumberKind] = useState<
    "single" | "double" | "triple" | "custom"
  >("triple");
  const [customAreas, setCustomAreas] = useState<TargetArea[]>([]);
  const [error, setError] = useState("");

  const proceed = (
    finalTargets: TargetDefinition[],
    finalArrangement: Arrangement
  ) => {
    if (finalTargets.length === 0) {
      setError(s.target.selectAtLeastOne);
      return;
    }
    update({
      targets: finalTargets,
      arrangement: finalArrangement,
      randomVariant:
        finalArrangement === "balanced" || finalArrangement === "pure"
          ? finalArrangement
          : undefined,
    });
    navigate("/train/sets");
  };

  // ---- 特定ナンバー練習 ----

  if (mode === "number") {
    const selectedNumbers = [
      ...new Set(
        targets.map((x) => x.number).filter((n): n is number => n != null)
      ),
    ];
    const toggleNumber = (n: number) => {
      setError("");
      setTargets((prev) => {
        const exists = prev.some((x) => x.number === n);
        if (exists) return prev.filter((x) => x.number !== n);
        const ring =
          numberKind === "single"
            ? "outer_single"
            : numberKind === "double"
              ? "double"
              : "triple";
        return [...prev, makeSegmentTarget(ring, profile, n)];
      });
    };
    return (
      <div>
        <h1>{s.target.title} — {s.mode.number}</h1>
        <fieldset>
          <legend>{s.target.targetKind}</legend>
          <div className="choice-row">
            {(
              [
                ["triple", s.target.triple],
                ["double", s.target.double],
                ["single", s.target.single],
                ["custom", s.target.customAreas],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`choice${numberKind === key ? " selected" : ""}`}
                onClick={() => {
                  setNumberKind(key);
                  setTargets([]);
                  setCustomAreas([]);
                }}
                aria-pressed={numberKind === key}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {numberKind !== "custom" && (
          <fieldset>
            <legend>{s.input.selectNumber}</legend>
            <div className="number-grid">
              {NUMBERS.map((n) => (
                <button
                  key={n}
                  className={selectedNumbers.includes(n) ? "selected" : ""}
                  aria-pressed={selectedNumbers.includes(n)}
                  onClick={() => toggleNumber(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {numberKind === "custom" && (
          <CustomAreaPicker areas={customAreas} onChange={setCustomAreas} />
        )}

        <div className="choice-row">
          {(
            [
              ["cycle", s.mode.sequence],
              ["balanced", s.mode.balancedRandom],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${orderOrBalanced === key ? " selected" : ""}`}
              onClick={() => setOrderOrBalanced(key)}
              aria-pressed={orderOrBalanced === key}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="action-bar">
          <button
            className="btn primary block"
            onClick={() => {
              if (numberKind === "custom") {
                if (customAreas.length === 0) {
                  setError(s.target.selectAtLeastOne);
                  return;
                }
                const labels = customAreas
                  .map((a) =>
                    a.ring === "inner_bull"
                      ? "IB"
                      : a.ring === "outer_bull"
                        ? "OB"
                        : `${a.ring === "double" ? "D" : a.ring === "triple" ? "T" : "S"}${a.number}`
                  )
                  .join("+");
                proceed(
                  [makeCustomTarget(labels, customAreas, profile)],
                  "same_per_set"
                );
              } else {
                proceed(targets, orderOrBalanced);
              }
            }}
          >
            {s.common.next}
          </button>
        </div>
      </div>
    );
  }

  // ---- ランダムターゲット: ターゲットはボード全体から自動選出 ----

  return (
    <div>
      <h1>{s.target.title} — {s.mode.random}</h1>
      <div className="info-box">{s.target.randomAutoInfo}</div>

      <fieldset>
        <legend>{s.mode.arrangementTitle}</legend>
        <div className="choice-row">
          {(
            [
              ["balanced", s.mode.balancedRandom],
              ["pure", s.mode.pureRandom],
              ["same_per_set", s.mode.arrSamePerSet],
              ["fixed_three", s.mode.arrFixedThree],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${arrangement === key ? " selected" : ""}`}
              onClick={() => setArrangement(key)}
              aria-pressed={arrangement === key}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted small">
          {arrangement === "balanced"
            ? s.mode.balancedRandomDesc
            : arrangement === "pure"
              ? s.mode.pureRandomDesc
              : arrangement === "same_per_set"
                ? s.mode.arrSamePerSetRandomDesc
                : s.mode.arrFixedThreeRandomDesc}
        </p>
      </fieldset>

      {error && <p className="error-text">{error}</p>}

      <div className="action-bar">
        <button
          className="btn primary block"
          onClick={() => {
            // ボード全体のプールをシャッフルして使用。
            // same_per_set はセットごとに先頭から順に、fixed_three は先頭3件を使う
            const pool = shuffle(buildFullRandomPool(profile));
            proceed(pool, arrangement);
          }}
        >
          {s.common.next}
        </button>
      </div>
    </div>
  );
}

function CustomAreaPicker({
  areas,
  onChange,
}: {
  areas: TargetArea[];
  onChange: (areas: TargetArea[]) => void;
}) {
  const s = t();
  const [ring, setRing] = useState<TargetArea["ring"]>("triple");
  const needsNumber =
    ring === "outer_single" || ring === "double" || ring === "triple";
  const areaLabel = (a: TargetArea) =>
    a.ring === "inner_bull"
      ? s.target.innerBull
      : a.ring === "outer_bull"
        ? s.target.outerBull
        : `${a.ring === "double" ? "D" : a.ring === "triple" ? "T" : "S"}${a.number}`;
  return (
    <div>
      <fieldset>
        <legend>{s.target.customAreas}</legend>
        <div className="choice-row">
          {(
            [
              ["outer_single", s.target.single],
              ["double", s.target.double],
              ["triple", s.target.triple],
              ["outer_bull", s.target.outerBull],
              ["inner_bull", s.target.innerBull],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${ring === key ? " selected" : ""}`}
              onClick={() => {
                setRing(key);
                if (key === "outer_bull" || key === "inner_bull") {
                  onChange([...areas, { ring: key }]);
                }
              }}
              aria-pressed={ring === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      {needsNumber && (
        <div className="number-grid">
          {NUMBERS.map((n) => (
            <button key={n} onClick={() => onChange([...areas, { ring, number: n }])}>
              {n}
            </button>
          ))}
        </div>
      )}
      <div className="choice-row" style={{ marginTop: "0.5rem" }}>
        {areas.map((a, i) => (
          <button
            key={i}
            className="choice"
            onClick={() => onChange(areas.filter((_, j) => j !== i))}
            aria-label={`${areaLabel(a)} を削除`}
          >
            {areaLabel(a)} ✕
          </button>
        ))}
      </div>
    </div>
  );
}
