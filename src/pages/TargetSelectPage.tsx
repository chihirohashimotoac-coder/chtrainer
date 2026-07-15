import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultBoardProfileFor } from "../config/boardProfiles";
import {
  makeBullAnyTarget,
  makeCustomTarget,
  makeNumberSectorTarget,
  makeSegmentTarget,
} from "../domain/targets";
import { useApp } from "../state/AppContext";
import { useSetup } from "../state/SetupContext";
import type { Arrangement } from "../domain/planner";
import type { TargetArea, TargetDefinition } from "../types/models";
import { t } from "../i18n/ja";

type PickKind =
  | "single"
  | "double"
  | "triple"
  | "number_whole"
  | "bull_any"
  | "outer_bull"
  | "inner_bull";

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function TargetSelectPage() {
  const s = t();
  const navigate = useNavigate();
  const { player } = useApp();
  const { setup, update } = useSetup();
  const mode = setup.mode ?? "same_target";
  const profile = useMemo(
    () => defaultBoardProfileFor(player?.defaultBoardType ?? "steel"),
    [player]
  );

  const [targets, setTargets] = useState<TargetDefinition[]>(setup.targets);
  const [pickKind, setPickKind] = useState<PickKind>(
    mode === "double" ? "double" : mode === "triple" ? "triple" : "triple"
  );
  const [variant, setVariant] = useState<"balanced" | "pure">(
    setup.randomVariant ?? "balanced"
  );
  const [orderOrBalanced, setOrderOrBalanced] = useState<"cycle" | "balanced">(
    "balanced"
  );
  const [ringSubMode, setRingSubMode] = useState<
    "all_order" | "all_balanced" | "selected"
  >("all_order");
  const [numberKind, setNumberKind] = useState<
    "single" | "double" | "triple" | "whole" | "custom"
  >("single");
  const [customAreas, setCustomAreas] = useState<TargetArea[]>([]);
  const [activeDartSlot, setActiveDartSlot] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState("");

  const addTarget = (target: TargetDefinition) => {
    setError("");
    if (mode === "per_dart_targets") {
      setTargets((prev) => {
        const next = prev.slice(0, 3);
        while (next.length < 3) next.push(target);
        next[activeDartSlot] = target;
        return next;
      });
      setActiveDartSlot((prev) => (prev < 2 ? ((prev + 1) as 0 | 1 | 2) : prev));
    } else {
      setTargets((prev) => [...prev, target]);
    }
  };

  const makeFromKind = (kind: PickKind, n?: number): TargetDefinition => {
    switch (kind) {
      case "single":
        return makeSegmentTarget("outer_single", profile, n);
      case "double":
        return makeSegmentTarget("double", profile, n);
      case "triple":
        return makeSegmentTarget("triple", profile, n);
      case "number_whole":
        return makeNumberSectorTarget(n ?? 20, profile);
      case "bull_any":
        return makeBullAnyTarget();
      case "outer_bull":
        return makeSegmentTarget("outer_bull", profile);
      case "inner_bull":
        return makeSegmentTarget("inner_bull", profile);
    }
  };

  const proceed = (finalTargets: TargetDefinition[], arrangement: Arrangement) => {
    if (finalTargets.length === 0) {
      setError(s.target.selectAtLeastOne);
      return;
    }
    update({
      targets: finalTargets,
      arrangement,
      randomVariant: mode === "random" ? variant : undefined,
    });
    navigate("/train/sets");
  };

  // ---- モード別のUI ----

  if (mode === "bull") {
    return (
      <div>
        <h1>{s.target.title} — {s.mode.bull}</h1>
        {(
          [
            [s.target.bullAny, () => makeBullAnyTarget()],
            [s.target.outerBull, () => makeSegmentTarget("outer_bull", profile)],
            [s.target.innerBull, () => makeSegmentTarget("inner_bull", profile)],
          ] as const
        ).map(([label, make]) => (
          <button
            key={label}
            className="btn block"
            onClick={() => proceed([make()], "same_per_set")}
          >
            {label}
          </button>
        ))}
        {error && <p className="error-text">{error}</p>}
      </div>
    );
  }

  if (mode === "double" || mode === "triple") {
    const ring = mode === "double" ? "double" : "triple";
    const prefix = mode === "double" ? "D" : "T";
    const selectedNumbers = targets
      .map((x) => x.number)
      .filter((n): n is number => n != null);
    return (
      <div>
        <h1>
          {s.target.title} — {mode === "double" ? s.mode.double : s.mode.triple}
        </h1>
        <div className="choice-row">
          {(
            [
              [
                "all_order",
                mode === "double"
                  ? s.target.allDoublesInOrder
                  : s.target.allTriplesInOrder,
              ],
              [
                "all_balanced",
                mode === "double"
                  ? s.target.allDoublesBalanced
                  : s.target.allTriplesBalanced,
              ],
              ["selected", s.target.selectedOnly],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${ringSubMode === key ? " selected" : ""}`}
              onClick={() => setRingSubMode(key)}
              aria-pressed={ringSubMode === key}
            >
              {label}
            </button>
          ))}
        </div>

        {ringSubMode === "selected" && (
          <>
            <fieldset>
              <legend>{s.input.selectNumber}</legend>
              <div className="number-grid">
                {NUMBERS.map((n) => {
                  const selected = selectedNumbers.includes(n);
                  return (
                    <button
                      key={n}
                      className={selected ? "selected" : ""}
                      aria-pressed={selected}
                      onClick={() =>
                        setTargets((prev) =>
                          selected
                            ? prev.filter((x) => x.number !== n)
                            : [...prev, makeSegmentTarget(ring, profile, n)]
                        )
                      }
                    >
                      {prefix}
                      {n}
                    </button>
                  );
                })}
              </div>
            </fieldset>
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
          </>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="action-bar">
          <button
            className="btn primary block"
            onClick={() => {
              if (ringSubMode === "selected") {
                proceed(targets, orderOrBalanced);
              } else {
                const all = NUMBERS.map((n) =>
                  makeSegmentTarget(ring, profile, n)
                );
                proceed(all, ringSubMode === "all_order" ? "cycle" : "balanced");
              }
            }}
          >
            {s.common.next}
          </button>
        </div>
      </div>
    );
  }

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
        const made =
          numberKind === "single"
            ? makeSegmentTarget("outer_single", profile, n)
            : numberKind === "double"
              ? makeSegmentTarget("double", profile, n)
              : numberKind === "triple"
                ? makeSegmentTarget("triple", profile, n)
                : makeNumberSectorTarget(n, profile);
        return [...prev, made];
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
                ["single", s.target.single],
                ["double", s.target.double],
                ["triple", s.target.triple],
                ["whole", s.target.numberWhole],
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
          <CustomAreaPicker
            areas={customAreas}
            onChange={setCustomAreas}
          />
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

  // same_target / per_dart_targets / random / sequence: 汎用ピッカー
  const kinds: { key: PickKind; label: string; needsNumber: boolean }[] = [
    { key: "triple", label: s.target.triple, needsNumber: true },
    { key: "double", label: s.target.double, needsNumber: true },
    { key: "single", label: s.target.single, needsNumber: true },
    { key: "number_whole", label: s.target.numberWhole, needsNumber: true },
    { key: "bull_any", label: s.target.bullAny, needsNumber: false },
    { key: "outer_bull", label: s.target.outerBull, needsNumber: false },
    { key: "inner_bull", label: s.target.innerBull, needsNumber: false },
  ];
  const currentKind = kinds.find((k) => k.key === pickKind);

  return (
    <div>
      <h1>{s.target.title}</h1>

      {mode === "per_dart_targets" && (
        <div className="choice-row">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              className={`choice${activeDartSlot === i ? " selected" : ""}`}
              onClick={() => setActiveDartSlot(i as 0 | 1 | 2)}
              aria-pressed={activeDartSlot === i}
            >
              {i === 0
                ? s.target.dart1Target
                : i === 1
                  ? s.target.dart2Target
                  : s.target.dart3Target}
              : {targets[i]?.label ?? "-"}
            </button>
          ))}
        </div>
      )}

      {mode === "random" && (
        <fieldset>
          <legend>{s.mode.random}</legend>
          <div className="choice-row">
            <button
              className={`choice${variant === "balanced" ? " selected" : ""}`}
              onClick={() => setVariant("balanced")}
              aria-pressed={variant === "balanced"}
            >
              {s.mode.balancedRandom}
            </button>
            <button
              className={`choice${variant === "pure" ? " selected" : ""}`}
              onClick={() => setVariant("pure")}
              aria-pressed={variant === "pure"}
            >
              {s.mode.pureRandom}
            </button>
          </div>
          <p className="muted small">
            {variant === "balanced"
              ? s.mode.balancedRandomDesc
              : s.mode.pureRandomDesc}
          </p>
        </fieldset>
      )}

      <fieldset>
        <legend>{s.target.targetKind}</legend>
        <div className="choice-row">
          {kinds.map((k) => (
            <button
              key={k.key}
              className={`choice${pickKind === k.key ? " selected" : ""}`}
              onClick={() => {
                setPickKind(k.key);
                if (!k.needsNumber) addTarget(makeFromKind(k.key));
              }}
              aria-pressed={pickKind === k.key}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      {currentKind?.needsNumber && (
        <fieldset>
          <legend>{s.input.selectNumber}</legend>
          <div className="number-grid">
            {NUMBERS.map((n) => (
              <button key={n} onClick={() => addTarget(makeFromKind(pickKind, n))}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {mode !== "per_dart_targets" && (
        <div className="card">
          <h3>
            {s.target.selected} ({targets.length})
          </h3>
          <div className="choice-row">
            {targets.map((target, i) => (
              <button
                key={`${target.id}-${i}`}
                className="choice"
                onClick={() =>
                  setTargets((prev) => prev.filter((_, j) => j !== i))
                }
                aria-label={`${target.label} を削除`}
              >
                {target.label} ✕
              </button>
            ))}
            {targets.length === 0 && (
              <span className="muted small">{s.target.selectAtLeastOne}</span>
            )}
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="action-bar">
        <button
          className="btn primary block"
          onClick={() => {
            const arrangement: Arrangement =
              mode === "same_target"
                ? "same_per_set"
                : mode === "per_dart_targets"
                  ? "fixed_three"
                  : mode === "sequence"
                    ? "cycle"
                    : variant === "balanced"
                      ? "balanced"
                      : "pure";
            const finalTargets =
              mode === "per_dart_targets" ? targets.slice(0, 3) : targets;
            if (mode === "per_dart_targets" && finalTargets.length < 3) {
              setError(s.target.selectAtLeastOne);
              return;
            }
            proceed(finalTargets, arrangement);
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
