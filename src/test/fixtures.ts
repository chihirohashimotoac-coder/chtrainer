import { STEEL_BOARD } from "../config/boardProfiles";
import { deriveThrow } from "../domain/derive";
import { landingFromCoordinate, landingBounceOut, landingFromSegment, landingOutboardDirection } from "../domain/landing";
import { makeSegmentTarget } from "../domain/targets";
import { SCHEMA_VERSION } from "../types/models";
import type {
  LandingRecord,
  TargetDefinition,
  ThrowRecord,
  TrainingSession,
} from "../types/models";

export const T20 = makeSegmentTarget("triple", STEEL_BOARD, 20);
export const D16 = makeSegmentTarget("double", STEEL_BOARD, 16);

export interface FixtureThrowSpec {
  target: TargetDefinition;
  landing: LandingRecord;
  setId?: string;
}

/** 手計算検証用の投擲レコード列を組み立てる */
export function buildThrows(
  specs: FixtureThrowSpec[],
  plannedThrowCount: number
): ThrowRecord[] {
  const records: ThrowRecord[] = [];
  let prevTarget: TargetDefinition | undefined;
  let prevHit: boolean | undefined;
  specs.forEach((spec, i) => {
    const globalThrowNumber = i + 1;
    const derived = deriveThrow(spec.target, spec.landing, {
      previousTarget: prevTarget,
      previousWasHit: prevHit,
      globalThrowNumber,
      plannedThrowCount,
    });
    records.push({
      schemaVersion: SCHEMA_VERSION,
      id: `throw-${globalThrowNumber}`,
      sessionId: "session-1",
      setId: spec.setId ?? `set-${Math.ceil(globalThrowNumber / 3)}`,
      globalThrowNumber,
      dartInSet: (((globalThrowNumber - 1) % 3) + 1) as 1 | 2 | 3,
      target: spec.target,
      thrownAt: "2026-01-01T10:00:00.000Z",
      elapsedMs: globalThrowNumber * 10000,
      landing: spec.landing,
      derived,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    });
    prevTarget = spec.target;
    prevHit = derived.exactHit;
  });
  return records;
}

/**
 * 手計算フィクスチャ: T20狙い6投 (計画6投=2セット)
 *  1: T20中心に命中 (誤差0)
 *  2: 誤差 (+0.1, 0) → 右 0.1
 *  3: 誤差 (0, +0.2) → 上 0.2
 *  4: 誤差 (-0.3, 0) → 左 0.3 (S11着弾)
 *  5: バウンスアウト (座標なし)
 *  6: アウトボード方向のみ (上)
 * 座標あり5投中、誤差サンプルは1〜4の4投。
 * 平均誤差 = (0+0.1+0.2+0.3)/4 = 0.15 / 中央値 = 0.15
 * 命中1/6、アウトボード1/6、バウンスアウト1/6
 */
export function handComputedThrows(): ThrowRecord[] {
  const rep = T20.representativePoint;
  return buildThrows(
    [
      { target: T20, landing: landingFromCoordinate(rep.x, rep.y, STEEL_BOARD) },
      {
        target: T20,
        landing: landingFromCoordinate(rep.x + 0.1, rep.y, STEEL_BOARD),
      },
      {
        target: T20,
        landing: landingFromCoordinate(rep.x, rep.y + 0.2, STEEL_BOARD),
      },
      {
        target: T20,
        landing: landingFromCoordinate(rep.x - 0.3, rep.y, STEEL_BOARD),
      },
      { target: T20, landing: landingBounceOut() },
      { target: T20, landing: landingOutboardDirection("up") },
    ],
    6
  );
}

/** 簡易入力を含む混在フィクスチャ */
export function mixedPrecisionThrows(): ThrowRecord[] {
  const rep = T20.representativePoint;
  return buildThrows(
    [
      { target: T20, landing: landingFromCoordinate(rep.x, rep.y, STEEL_BOARD) },
      { target: T20, landing: landingFromSegment("triple", STEEL_BOARD, 20) },
      { target: T20, landing: landingFromSegment("outer_single", STEEL_BOARD, 5) },
    ],
    3
  );
}

export function fixtureSession(overrides?: Partial<TrainingSession>): TrainingSession {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: "session-1",
    playerId: "player-1",
    boardType: "steel",
    boardProfileId: "steel_standard",
    trainingMode: "same_target",
    inputMethod: "coordinate",
    dominantHand: "right",
    setCount: 2,
    plannedThrowCount: 6,
    plannedTargets: [
      [T20, T20, T20],
      [T20, T20, T20],
    ],
    startedAt: "2026-01-01T10:00:00.000Z",
    dailyCondition: "usual",
    assessments: [
      {
        timing: "before",
        recordedAt: "2026-01-01T09:59:00.000Z",
        fatigue: 3,
        concentration: 7,
        pain: 0,
        confidence: 6,
      },
    ],
    status: "completed",
    progress: { currentSetNumber: 2, middleAssessmentDone: true },
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}
