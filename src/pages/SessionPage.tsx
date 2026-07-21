import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AssessmentForm } from "../components/AssessmentForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CoordinateInput } from "../components/CoordinateInput";
import { SimpleInput } from "../components/SimpleInput";
import { getBoardProfile } from "../config/boardProfiles";
import { getActiveSession, getThrowSets, saveSession } from "../db/db";
import { isSameTarget, segmentLabel } from "../domain/targets";
import {
  commitSet,
  finishSession,
  middleAssessmentSet,
  type PendingDart,
} from "../services/sessionService";
import { feedback, useApp } from "../state/AppContext";
import type {
  InputMethod,
  LandingRecord,
  SelfAssessment,
  TargetDefinition,
  TrainingSession,
} from "../types/models";
import { nowIso } from "../utils/id";
import { parseSpeedKmh } from "../utils/speed";
import { t } from "../i18n/ja";

type Step = "throw" | "input" | "confirm" | "middle" | "after";

function landingText(landing: LandingRecord | null): string {
  const s = t();
  if (!landing) return "-";
  if (landing.ring === "outboard") {
    return landing.outboardDirection && landing.outboardDirection !== "unknown"
      ? `${s.input.outboard}(${s.direction[landing.outboardDirection]})`
      : s.input.outboard;
  }
  if (landing.ring === "bounce_out") return s.input.bounceOut;
  if (landing.ring === "inner_bull") return s.input.innerBull;
  if (landing.ring === "outer_bull") return s.input.outerBull;
  return segmentLabel(landing.ring, landing.number);
}

export default function SessionPage() {
  const s = t();
  const navigate = useNavigate();
  const { player, refresh } = useApp();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [setNumber, setSetNumber] = useState(1);
  const [step, setStep] = useState<Step>("throw");
  const [dartIndex, setDartIndex] = useState<0 | 1 | 2>(0);
  const [landings, setLandings] = useState<(LandingRecord | null)[]>([
    null,
    null,
    null,
  ]);
  const [notes, setNotes] = useState<string[]>(["", "", ""]);
  const [speeds, setSpeeds] = useState<string[]>(["", "", ""]);
  const [returnToConfirm, setReturnToConfirm] = useState(false);
  const [inputMethod, setInputMethod] = useState<InputMethod>("coordinate");
  const [swapSelection, setSwapSelection] = useState<number | null>(null);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [saving, setSaving] = useState(false);
  const setStartedAt = useRef<string | undefined>(undefined);
  /** 現在のセットが自動保存済みの場合、そのセットID(置換保存に使う) */
  const savedSetIdRef = useRef<string | null>(null);
  /** 自動保存を直列化するチェーン(操作順のままIndexedDBへ反映する) */
  const persistChain = useRef<Promise<void>>(Promise.resolve());

  // セッション復元
  useEffect(() => {
    void (async () => {
      const active = await getActiveSession();
      if (!active) {
        setLoading(false);
        return;
      }
      try {
        const sets = await getThrowSets(active.id);
        const done = sets.length;
        setSession(active);
        setInputMethod(active.inputMethod);
        if (done >= active.setCount) {
          setStep("after");
        } else {
          setSetNumber(done + 1);
          if (
            done === middleAssessmentSet(active.setCount) &&
            !active.progress.middleAssessmentDone
          ) {
            setStep("middle");
          } else {
            setStep("throw");
          }
        }
      } catch {
        alert(s.errors.restoreFailed);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ブラウザ離脱ガード
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (session && session.status === "active") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session]);

  const profile = useMemo(
    () => (session ? getBoardProfile(session.boardProfileId) : undefined),
    [session]
  );

  const targets: TargetDefinition[] = useMemo(() => {
    if (!session) return [];
    return session.plannedTargets[setNumber - 1] ?? [];
  }, [session, setNumber]);

  const allSameTarget =
    targets.length === 3 &&
    targets[0] != null &&
    targets[1] != null &&
    targets[2] != null &&
    isSameTarget(targets[0], targets[1]) &&
    isSameTarget(targets[1], targets[2]);
  const showPerDartTargets = !allSameTarget || targets[0]?.patternId != null;
  const sessionDartColors =
    session?.contextSnapshot?.dartColors ?? player?.dartColors;

  const beginInput = () => {
    setStartedAt.current = setStartedAt.current ?? nowIso();
    setDartIndex(0);
    setStep("input");
  };

  /**
   * 3投が揃った時点でセット全体をIndexedDBへ保存する(確認画面表示と同時)。
   * 「次のセットへ」は保存トリガーではなく、以後の修正は同じセットIDへの
   * 置換保存になるため二重保存されない。中断・リロード後もこの保存が残る。
   */
  const persistSet = (
    landingsArr: (LandingRecord | null)[],
    notesArr: string[],
    speedsArr: string[]
  ): Promise<void> => {
    const current = session;
    if (!current || landingsArr.some((l) => l == null)) {
      return persistChain.current;
    }
    const darts: PendingDart[] = landingsArr.map((landing, i) => {
      const speedKmh = parseSpeedKmh(speedsArr[i] ?? "");
      return {
        dartInSet: (i + 1) as 1 | 2 | 3,
        target: targets[i] as TargetDefinition,
        landing: landing as LandingRecord,
        ...(speedKmh != null ? { speedKmh } : {}),
        ...(notesArr[i]?.trim() ? { note: notesArr[i]?.trim() } : {}),
      };
    });
    const startedAt = setStartedAt.current;
    const capturedSetNumber = setNumber;
    persistChain.current = persistChain.current
      .then(async () => {
        const { throwSet } = await commitSet(
          current,
          capturedSetNumber,
          darts,
          player,
          startedAt,
          savedSetIdRef.current ?? undefined
        );
        savedSetIdRef.current = throwSet.id;
      })
      .catch(() => {
        // 自動保存の失敗はここでは通知しない(確定操作時に再試行され、
        // そこで失敗すればエラー表示される)
      });
    return persistChain.current;
  };

  const handleLanding = (landing: LandingRecord, speedKmh?: number) => {
    feedback(player);
    const nextLandings = [...landings];
    nextLandings[dartIndex] = landing;
    setLandings(nextLandings);
    // 矢速は入力画面の欄をプリフィルした上で、確定時の欄の値を常に正とする(空で確定=クリア)
    const nextSpeeds = [...speeds];
    nextSpeeds[dartIndex] = speedKmh != null ? String(speedKmh) : "";
    setSpeeds(nextSpeeds);
    // 3投揃った時点で保存(修正で戻ってきた場合も最終状態で置換保存)
    if (nextLandings.every((l) => l != null)) {
      void persistSet(nextLandings, notes, nextSpeeds);
    }
    if (returnToConfirm) {
      setReturnToConfirm(false);
      setStep("confirm");
      return;
    }
    if (dartIndex < 2) {
      setDartIndex((dartIndex + 1) as 0 | 1 | 2);
    } else {
      setStep("confirm");
    }
  };

  const undoDart = () => {
    if (dartIndex > 0) {
      const prevIndex = (dartIndex - 1) as 0 | 1 | 2;
      setLandings((prev) => {
        const next = [...prev];
        next[prevIndex] = null;
        return next;
      });
      setSpeeds((prev) => {
        const next = [...prev];
        next[prevIndex] = "";
        return next;
      });
      setDartIndex(prevIndex);
    } else if (returnToConfirm) {
      setReturnToConfirm(false);
      setStep("confirm");
    } else {
      setStep("throw");
    }
  };

  const swapDarts = (i: number, j: number) => {
    const nextLandings = [...landings];
    const landingTmp = nextLandings[i] ?? null;
    nextLandings[i] = nextLandings[j] ?? null;
    nextLandings[j] = landingTmp;
    setLandings(nextLandings);
    const nextNotes = [...notes];
    const noteTmp = nextNotes[i] ?? "";
    nextNotes[i] = nextNotes[j] ?? "";
    nextNotes[j] = noteTmp;
    setNotes(nextNotes);
    const nextSpeeds = [...speeds];
    const speedTmp = nextSpeeds[i] ?? "";
    nextSpeeds[i] = nextSpeeds[j] ?? "";
    nextSpeeds[j] = speedTmp;
    setSpeeds(nextSpeeds);
    if (nextLandings.every((l) => l != null)) {
      void persistSet(nextLandings, nextNotes, nextSpeeds);
    }
  };

  const commitCurrentSet = useCallback(async () => {
    if (!session || saving) return;
    if (landings.some((l) => l == null)) return;
    setSaving(true);
    try {
      // 進行中の自動保存を待ってから、メモ・矢速を含む最終状態で置換保存する
      await persistChain.current;
      const darts: PendingDart[] = landings.map((landing, i) => {
        const speedKmh = parseSpeedKmh(speeds[i] ?? "");
        return {
          dartInSet: (i + 1) as 1 | 2 | 3,
          target: targets[i] as TargetDefinition,
          landing: landing as LandingRecord,
          ...(speedKmh != null ? { speedKmh } : {}),
          ...(notes[i]?.trim() ? { note: notes[i]?.trim() } : {}),
        };
      });
      await commitSet(
        session,
        setNumber,
        darts,
        player,
        setStartedAt.current,
        savedSetIdRef.current ?? undefined
      );
      savedSetIdRef.current = null;
      setStartedAt.current = undefined;
      setLandings([null, null, null]);
      setNotes(["", "", ""]);
      setSpeeds(["", "", ""]);
      setSwapSelection(null);

      const isMiddle =
        setNumber === middleAssessmentSet(session.setCount) &&
        !session.progress.middleAssessmentDone;
      const isLast = setNumber >= session.setCount;
      const updated: TrainingSession = {
        ...session,
        progress: {
          currentSetNumber: Math.min(setNumber + 1, session.setCount),
          middleAssessmentDone: session.progress.middleAssessmentDone,
        },
      };
      await saveSession(updated);
      setSession(updated);

      if (isLast) {
        setStep("after");
      } else if (isMiddle) {
        setStep("middle");
      } else {
        setSetNumber(setNumber + 1);
        setStep("throw");
      }
    } catch {
      alert(s.errors.dbSaveFailed);
    } finally {
      setSaving(false);
    }
  }, [session, saving, landings, notes, speeds, targets, setNumber, player, s]);

  const submitMiddleAssessment = async (assessment: SelfAssessment) => {
    if (!session) return;
    const updated: TrainingSession = {
      ...session,
      assessments: [...session.assessments, assessment],
      progress: { ...session.progress, middleAssessmentDone: true },
    };
    try {
      await saveSession(updated);
      setSession(updated);
      setSetNumber(setNumber + 1);
      setStep("throw");
    } catch {
      alert(s.errors.dbSaveFailed);
    }
  };

  const submitAfterAssessment = async (assessment: SelfAssessment) => {
    if (!session) return;
    const updated: TrainingSession = {
      ...session,
      assessments: [...session.assessments, assessment],
    };
    try {
      await saveSession(updated);
      await finishSession(updated, "completed");
      await refresh();
      navigate(`/session/${session.id}/result`, { replace: true });
    } catch {
      alert(s.errors.dbSaveFailed);
    }
  };

  if (loading) return <p>{s.common.loading}</p>;
  if (!session || !profile) {
    return (
      <div>
        <p className="muted">{s.home.noSessions}</p>
        <button className="btn block" onClick={() => navigate("/")}>
          {s.common.home}
        </button>
      </div>
    );
  }

  const dartColor = sessionDartColors?.[dartIndex] ?? "#ccc";
  const currentTarget = targets[dartIndex];

  return (
    <div>
      <div className="top-bar">
        <span className="badge">
          {s.throwing.setLabel} {setNumber} / {session.setCount}
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn small danger" onClick={() => setConfirmAbort(true)}>
          {s.throwing.abort}
        </button>
      </div>

      {step === "throw" && (
        <div className="throw-screen">
          <div className="target-display">
            <div className="set-info">{s.throwing.currentTarget}</div>
            {!showPerDartTargets ? (
              <div
                className={`target-label${(targets[0]?.label.length ?? 0) > 4 ? " long" : ""}`}
              >
                {targets[0]?.label}
              </div>
            ) : (
              <div className="per-dart-targets">
                {targets.map((target, i) => (
                  <div className="one" key={i}>
                    <div className="sub">
                      {s.throwing.dartN.replace("{n}", String(i + 1))}
                      <span
                        className="color-dot"
                        style={{
                          background: sessionDartColors?.[i],
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          marginLeft: 4,
                          border: "1px solid #fff8",
                        }}
                      />
                    </div>
                    <div className="lbl">{target.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {targets[0]?.instruction && (
            <div className="info-box" style={{ maxWidth: 480 }}>
              {targets[0].instruction}
            </div>
          )}
          <p className="muted small">{s.throwing.threwAll}</p>
          <div className="action-bar" style={{ width: "100%" }}>
            <button
              className="btn primary block"
              style={{ minHeight: 64, fontSize: "1.15rem" }}
              onClick={beginInput}
            >
              {s.throwing.inputResults}
            </button>
          </div>
        </div>
      )}

      {step === "input" && currentTarget && (
        <div>
          <div className="list-row">
            <span className="dart-chip">
              <span className="color-dot" style={{ background: dartColor }} />
              {s.throwing.dartN.replace("{n}", String(dartIndex + 1))}
            </span>
            <strong>
              {s.throwing.currentTarget}: {currentTarget.label}
            </strong>
            <button className="btn small" onClick={undoDart}>
              {s.common.undo}
            </button>
          </div>

          {currentTarget.requiredInputPrecision === "coordinate" && (
            <div className="info-box">グルーピング測定には詳細座標が必要です。簡易入力の代表点から精密な距離は算出しません。</div>
          )}
          <div className="choice-row" style={{ margin: "0.4rem 0" }}>
            <button
              className={`choice${inputMethod === "coordinate" ? " selected" : ""}`}
              onClick={() => setInputMethod("coordinate")}
              aria-pressed={inputMethod === "coordinate"}
            >
              {s.player.inputCoordinate}
            </button>
            <button
              className={`choice${inputMethod === "simple" ? " selected" : ""}`}
              onClick={() => setInputMethod("simple")}
              aria-pressed={inputMethod === "simple"}
              disabled={currentTarget.requiredInputPrecision === "coordinate"}
            >
              {s.player.inputSimple}
            </button>
          </div>

          {inputMethod === "coordinate" || currentTarget.requiredInputPrecision === "coordinate" ? (
            <CoordinateInput
              key={`${setNumber}-${dartIndex}`}
              profile={profile}
              onConfirm={handleLanding}
              initialSpeedKmh={parseSpeedKmh(speeds[dartIndex] ?? "")}
            />
          ) : (
            <SimpleInput
              key={`${setNumber}-${dartIndex}`}
              profile={profile}
              onConfirm={handleLanding}
              initialSpeedKmh={parseSpeedKmh(speeds[dartIndex] ?? "")}
            />
          )}
        </div>
      )}

      {step === "confirm" && (
        <div>
          <h1>{s.throwing.confirmTitle}</h1>
          <p className="muted small">{s.throwing.reorderHint}</p>
          {[0, 1, 2].map((i) => {
            const target = targets[i];
            const isSwapSelected = swapSelection === i;
            return (
              <div
                key={i}
                className={`card${isSwapSelected ? " selected" : ""}`}
              >
                <div className="list-row">
                  <span className="dart-chip">
                    <span
                      className="color-dot"
                      style={{ background: sessionDartColors?.[i] }}
                    />
                    {s.throwing.dartN.replace("{n}", String(i + 1))}
                  </span>
                  <span className="muted small">
                    {s.throws.target}: {target?.label}
                  </span>
                  <strong>{landingText(landings[i] ?? null)}</strong>
                </div>
                <div className="btn-row">
                  <button
                    className="btn small"
                    onClick={() => {
                      setDartIndex(i as 0 | 1 | 2);
                      setReturnToConfirm(true);
                      setStep("input");
                    }}
                  >
                    {s.throwing.fixDart.replace("{n}", String(i + 1))}
                  </button>
                  <button
                    className={`btn small${isSwapSelected ? " primary" : ""}`}
                    onClick={() => {
                      if (swapSelection == null) {
                        setSwapSelection(i);
                      } else if (swapSelection === i) {
                        setSwapSelection(null);
                      } else {
                        swapDarts(swapSelection, i);
                        setSwapSelection(null);
                      }
                    }}
                    aria-pressed={isSwapSelected}
                  >
                    {s.throwing.swapOrder}
                  </button>
                </div>
                <label className="field" style={{ margin: "0.3rem 0 0" }}>
                  <span>{s.input.speedLabel}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={speeds[i] ?? ""}
                    onChange={(e) =>
                      setSpeeds((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    placeholder={s.input.speedPlaceholder}
                  />
                </label>
                <label className="field" style={{ margin: "0.3rem 0 0" }}>
                  <span>{s.throwing.throwNote}</span>
                  <input
                    type="text"
                    value={notes[i] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                  />
                </label>
              </div>
            );
          })}
          <div className="action-bar">
            <button
              className="btn primary block"
              style={{ minHeight: 60 }}
              disabled={saving || landings.some((l) => l == null)}
              onClick={() => void commitCurrentSet()}
            >
              {setNumber >= session.setCount
                ? s.throwing.finishSession
                : s.throwing.nextSet}
            </button>
          </div>
        </div>
      )}

      {step === "middle" && (
        <div>
          <h1>{s.assessment.middleTitle}</h1>
          <p className="muted">{s.assessment.middleInfo}</p>
          <AssessmentForm timing="middle" onSubmit={submitMiddleAssessment} />
        </div>
      )}

      {step === "after" && (
        <div>
          <h1>{s.assessment.afterTitle}</h1>
          <AssessmentForm
            timing="after"
            onSubmit={submitAfterAssessment}
            submitLabel={s.throwing.finishSession}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmAbort}
        title={s.throwing.exitGuard}
        danger
        confirmLabel={s.throwing.abort}
        cancelLabel={s.throwing.continueSession}
        onCancel={() => setConfirmAbort(false)}
        onConfirm={async () => {
          // 確認画面まで進んだセット(3投確定済み)は、メモ・矢速の最終状態を
          // 含めて保存してから中断する。未確定の投擲(1〜2投のみ)は保存しない。
          if (landings.every((l) => l != null)) {
            await persistSet(landings, notes, speeds);
          } else {
            await persistChain.current;
          }
          await finishSession(session, "aborted");
          await refresh();
          navigate("/", { replace: true });
        }}
      >
        <p className="muted">{s.throwing.abortConfirm}</p>
      </ConfirmDialog>
    </div>
  );
}
