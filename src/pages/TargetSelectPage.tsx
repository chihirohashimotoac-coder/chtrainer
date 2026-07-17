import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultBoardProfileFor } from "../config/boardProfiles";
import {
  buildFullRandomPool,
  makeBullAnyTarget,
  makeSegmentTarget,
} from "../domain/targets";
import { shuffle, type Arrangement } from "../domain/planner";
import { skillCheckUniqueTargets } from "../domain/skillCheck";
import { useApp } from "../state/AppContext";
import { useSetup } from "../state/SetupContext";
import type { Ring, TargetDefinition } from "../types/models";
import { t } from "../i18n/ja";

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15];

type SegmentKind = "triple" | "double" | "single";

function ringOf(kind: SegmentKind): Ring {
  return kind === "single"
    ? "outer_single"
    : kind === "double"
      ? "double"
      : "triple";
}

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

  if (mode === "zero_one") {
    return <ZeroOnePicker profile={profile} proceed={proceed} error={error} />;
  }
  if (mode === "cricket") {
    return <CricketPicker profile={profile} proceed={proceed} error={error} />;
  }
  return <DiagnosticPicker profile={profile} proceed={proceed} error={error} />;
}

interface PickerProps {
  profile: ReturnType<typeof defaultBoardProfileFor>;
  proceed: (targets: TargetDefinition[], arrangement: Arrangement) => void;
  error: string;
}

/** 01練習: 同一ターゲット反復 / フィニッシュ3投指定 */
function ZeroOnePicker({ profile, proceed, error }: PickerProps) {
  const s = t();
  const [practiceType, setPracticeType] = useState<"repeat" | "finish">(
    "repeat"
  );
  // 反復: よく狙うターゲット(ソフトはBull、ハードはT20が初期値)
  const [kind, setKind] = useState<SegmentKind>("triple");
  const [showOtherPicker, setShowOtherPicker] = useState(false);
  const [targets, setTargets] = useState<TargetDefinition[]>(() =>
    profile.type === "soft"
      ? [makeBullAnyTarget()]
      : [makeSegmentTarget("triple", profile, 20)]
  );
  // フィニッシュ: 3投固定 (初期値 T20→T20→D16)
  const [finishTargets, setFinishTargets] = useState<TargetDefinition[]>([
    makeSegmentTarget("triple", profile, 20),
    makeSegmentTarget("triple", profile, 20),
    makeSegmentTarget("double", profile, 16),
  ]);
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2>(0);
  const [slotKind, setSlotKind] = useState<SegmentKind>("triple");

  const selectedNumbers = targets
    .filter((x) => x.ring === ringOf(kind))
    .map((x) => x.number);

  const kindChips = (
    current: SegmentKind,
    setter: (k: SegmentKind) => void
  ) => (
    <div className="choice-row">
      {(
        [
          ["triple", s.target.triple],
          ["double", s.target.double],
          ["single", s.target.single],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          className={`choice${current === key ? " selected" : ""}`}
          onClick={() => setter(key)}
          aria-pressed={current === key}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <h1>{s.target.title} — {s.mode.zeroOne}</h1>
      <div className="choice-row">
        {(
          [
            ["repeat", s.target.zeroOneRepeat],
            ["finish", s.target.zeroOneFinish],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`choice${practiceType === key ? " selected" : ""}`}
            onClick={() => setPracticeType(key)}
            aria-pressed={practiceType === key}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted small">
        {practiceType === "repeat"
          ? s.target.zeroOneRepeatDesc
          : s.target.zeroOneFinishDesc}
      </p>

      {practiceType === "repeat" && (
        <>
          <fieldset>
            <legend>{s.target.quickTargets}</legend>
            <div className="choice-row">
              {(
                [
                  ["Bull", () => makeBullAnyTarget()],
                  ["T20", () => makeSegmentTarget("triple", profile, 20)],
                  ["T19", () => makeSegmentTarget("triple", profile, 19)],
                ] as const
              ).map(([label, make]) => {
                const selected = targets.some((x) => x.label === label);
                return (
                  <button
                    key={label}
                    className={`choice${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() =>
                      setTargets((prev) =>
                        selected
                          ? prev.filter((x) => x.label !== label)
                          : [...prev, make()]
                      )
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button
            className="btn small block"
            onClick={() => setShowOtherPicker((v) => !v)}
            aria-expanded={showOtherPicker}
          >
            {s.target.otherTargets}
          </button>

          {showOtherPicker && (
            <>
              <fieldset>
                <legend>{s.target.targetKind}</legend>
                {kindChips(kind, setKind)}
              </fieldset>
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
                          setTargets((prev) => {
                            const ring = ringOf(kind);
                            const exists = prev.some(
                              (x) => x.ring === ring && x.number === n
                            );
                            return exists
                              ? prev.filter(
                                  (x) => !(x.ring === ring && x.number === n)
                                )
                              : [...prev, makeSegmentTarget(ring, profile, n)];
                          })
                        }
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          <div className="card">
            <span className="muted small">{s.target.selected}: </span>
            <strong>
              {targets.map((x) => x.label).join(", ") || "-"}
            </strong>
          </div>
        </>
      )}

      {practiceType === "finish" && (
        <>
          <div className="choice-row">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                className={`choice${activeSlot === i ? " selected" : ""}`}
                onClick={() => setActiveSlot(i as 0 | 1 | 2)}
                aria-pressed={activeSlot === i}
              >
                {i === 0
                  ? s.target.dart1Target
                  : i === 1
                    ? s.target.dart2Target
                    : s.target.dart3Target}
                : {finishTargets[i]?.label ?? "-"}
              </button>
            ))}
          </div>
          <fieldset>
            <legend>{s.target.targetKind}</legend>
            {kindChips(slotKind, setSlotKind)}
          </fieldset>
          <fieldset>
            <legend>{s.input.selectNumber}</legend>
            <div className="number-grid">
              {NUMBERS.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setFinishTargets((prev) => {
                      const next = prev.slice();
                      next[activeSlot] = makeSegmentTarget(
                        ringOf(slotKind),
                        profile,
                        n
                      );
                      return next;
                    });
                    setActiveSlot((prev) =>
                      prev < 2 ? ((prev + 1) as 0 | 1 | 2) : prev
                    );
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            className="btn small block"
            onClick={() =>
              setFinishTargets((prev) => {
                const next = prev.slice();
                next[activeSlot] = makeBullAnyTarget();
                return next;
              })
            }
          >
            {s.target.bullAny}を{activeSlot + 1}投目にセット
          </button>
        </>
      )}

      {error && <p className="error-text">{error}</p>}
      <div className="action-bar">
        <button
          className="btn primary block"
          onClick={() => {
            if (practiceType === "repeat") {
              // 複数選択時はターゲットごとに連続セットでまとめて出題
              proceed(
                targets,
                targets.length > 1 ? "blocks" : "same_per_set"
              );
            } else {
              proceed(finishTargets, "fixed_three");
            }
          }}
        >
          {s.common.next}
        </button>
      </div>
    </div>
  );
}

/** クリケット練習: 15〜20のトリプル + Bull */
function CricketPicker({ profile, proceed, error }: PickerProps) {
  const s = t();
  const [numbers, setNumbers] = useState<number[]>(CRICKET_NUMBERS);
  const [includeBull, setIncludeBull] = useState(true);
  const [cricketArrangement, setCricketArrangement] = useState<
    "blocks" | "balanced" | "within_set_switch"
  >("blocks");
  const selectedTargetCount = numbers.length + (includeBull ? 1 : 0);

  return (
    <div>
      <h1>{s.target.title} — {s.mode.cricket}</h1>
      <p className="muted small">{s.target.cricketInfo}</p>
      <fieldset>
        <legend>{s.target.cricketNumbers}</legend>
        <div className="choice-row">
          {CRICKET_NUMBERS.map((n) => {
            const selected = numbers.includes(n);
            return (
              <button
                key={n}
                className={`choice${selected ? " selected" : ""}`}
                aria-pressed={selected}
                onClick={() =>
                  setNumbers((prev) =>
                    selected ? prev.filter((x) => x !== n) : [...prev, n]
                  )
                }
              >
                T{n}
              </button>
            );
          })}
          <button
            className={`choice${includeBull ? " selected" : ""}`}
            aria-pressed={includeBull}
            onClick={() => setIncludeBull((v) => !v)}
          >
            Bull
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>{s.mode.arrangementTitle}</legend>
        <div className="choice-row">
          {(
            [
              ["blocks", s.mode.arrBlocks],
              ["balanced", s.mode.balancedRandom],
              ["within_set_switch", s.mode.withinSetSwitch],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`choice${cricketArrangement === key ? " selected" : ""}`}
              onClick={() => setCricketArrangement(key)}
              aria-pressed={cricketArrangement === key}
              disabled={key === "within_set_switch" && selectedTargetCount < 2}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted small">
          {cricketArrangement === "blocks"
            ? s.mode.arrBlocksDesc
            : cricketArrangement === "balanced"
              ? s.mode.balancedRandomDesc
              : s.mode.withinSetSwitchDesc}
        </p>
        {selectedTargetCount === 1 && (
          <p className="info-box">ターゲットが1種類の場合、セット内切替は選択できません。同一ターゲット練習になります。</p>
        )}
      </fieldset>

      {error && <p className="error-text">{error}</p>}
      <div className="action-bar">
        <button
          className="btn primary block"
          onClick={() => {
            // 実戦の攻略順(20→19→…→15→Bull)で並べる
            const targets: TargetDefinition[] = CRICKET_NUMBERS.filter((n) =>
              numbers.includes(n)
            ).map((n) => makeSegmentTarget("triple", profile, n));
            if (includeBull) targets.push(makeBullAnyTarget());
            proceed(targets, cricketArrangement);
          }}
        >
          {s.common.next}
        </button>
      </div>
    </div>
  );
}

/** 全体診断: スキル診断(定型メニュー) / フリースキャン(ランダム) */
function DiagnosticPicker({ profile, proceed, error }: PickerProps) {
  const s = t();
  const { update } = useSetup();
  const navigate = useNavigate();
  const [diagType, setDiagType] = useState<"skill" | "free">("skill");
  const [arrangement, setArrangement] = useState<Arrangement>("balanced");

  return (
    <div>
      <h1>{s.target.title} — {s.mode.random}</h1>

      <div className="choice-row">
        {(
          [
            ["skill", s.target.skillCheck],
            ["free", s.target.freeScan],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`choice${diagType === key ? " selected" : ""}`}
            onClick={() => setDiagType(key)}
            aria-pressed={diagType === key}
          >
            {label}
          </button>
        ))}
      </div>

      {diagType === "skill" && (
        <>
          <div className="info-box">{s.target.skillCheckDesc}</div>
          {s.target.skillRounds.map((round) => (
            <div className="card" key={round.name} style={{ padding: "0.6rem 0.9rem" }}>
              <strong>{round.name}</strong>
              <div className="muted small">出題: {round.aim}</div>
              <div className="muted small">測定: {round.measure}</div>
            </div>
          ))}
          <div className="info-box">
            <strong>R4の固定・切替</strong><br />
            固定ダブル：3本とも同じダブルを狙う<br />
            切替ダブル：2投目・3投目で別のダブルへ狙いを変更する
          </div>
        </>
      )}

      {diagType === "free" && (
        <>
          <div className="info-box">{s.target.randomAutoInfo}</div>
          <div className="info-box">{s.target.diagnosticSetHint}</div>
          <fieldset>
            <legend>{s.mode.arrangementTitle}</legend>
            <div className="choice-row">
              {(
                [
                  ["balanced", s.mode.balancedRandom],
                  ["pure", s.mode.pureRandom],
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
                : s.mode.pureRandomDesc}
            </p>
          </fieldset>
        </>
      )}

      {error && <p className="error-text">{error}</p>}
      <div className="action-bar">
        <button
          className="btn primary block"
          onClick={() => {
            if (diagType === "skill") {
              // スキル診断は専用モードとして記録し、種目別ブロックで出題する
              update({
                mode: "skill_check",
                targets: skillCheckUniqueTargets(profile),
                arrangement: "skill_rounds",
                randomVariant: undefined,
              });
              navigate("/train/sets");
            } else {
              proceed(shuffle(buildFullRandomPool(profile)), arrangement);
            }
          }}
        >
          {s.common.next}
        </button>
      </div>
    </div>
  );
}
