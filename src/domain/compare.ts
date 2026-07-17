import type {
  SessionStatistics,
  TrainingSession,
} from "../types/models";

export interface ComparisonCandidate {
  session: TrainingSession;
  score: number;
  reasons: string[];
}

/**
 * 比較対象候補のスコアリング。
 * 優先順位: 同モード > 同ターゲット構成 > 同ボード種別 > 同スコアリング形式 > 同機材 > 日付が近い
 */
export function rankComparisonCandidates(
  base: TrainingSession,
  others: readonly TrainingSession[]
): ComparisonCandidate[] {
  const baseLabels = targetSignature(base);
  const baseTime = Date.parse(base.startedAt);
  return others
    .filter((s) => s.id !== base.id && s.status !== "active")
    .map((session) => {
      let score = 0;
      const reasons: string[] = [];
      if (session.trainingMode === base.trainingMode) {
        score += 1000;
        reasons.push("同じトレーニングモード");
      }
      if (targetSignature(session) === baseLabels) {
        score += 500;
        reasons.push("同じターゲット構成");
      }
      if (session.boardType === base.boardType) {
        score += 250;
        reasons.push("同じボード種別");
      }
      if (
        base.scoringStyle != null &&
        session.scoringStyle === base.scoringStyle
      ) {
        score += 150;
        reasons.push("同じスコアリング形式");
      }
      if (
        session.equipmentProfileId != null &&
        session.equipmentProfileId === base.equipmentProfileId
      ) {
        score += 100;
        reasons.push("同じ使用機材");
      }
      // 日付の近さ: 30日以内で最大50点
      const days =
        Math.abs(baseTime - Date.parse(session.startedAt)) / 86400000;
      score += Math.max(0, 50 - Math.min(50, days * (50 / 30)));
      return { session, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/** ターゲット構成の識別子(ラベルの集合) */
export function targetSignature(session: TrainingSession): string {
  const labels = new Set<string>();
  for (const set of session.plannedTargets) {
    for (const t of set) labels.add(t.label);
  }
  return [...labels].sort().join(",");
}

/** 比較条件が大きく異なるかどうか(警告表示用) */
export function isDissimilarComparison(
  base: TrainingSession,
  other: TrainingSession
): boolean {
  return (
    base.trainingMode !== other.trainingMode ||
    base.boardType !== other.boardType ||
    // スコアリング形式が両方記録されていて異なる場合は出題構成が入れ替わっている
    (base.scoringStyle != null &&
      other.scoringStyle != null &&
      base.scoringStyle !== other.scoringStyle)
  );
}

export interface StatDiff {
  base: number | undefined;
  other: number | undefined;
  diff: number | undefined;
}

function diffOf(
  base: number | undefined,
  other: number | undefined
): StatDiff {
  return {
    base,
    other,
    diff: base != null && other != null ? base - other : undefined,
  };
}

export interface SessionComparison {
  hitRate: StatDiff;
  averageErrorDistance: StatDiff;
  byDartInSet: Record<"1" | "2" | "3", { hitRate: StatDiff; averageErrorDistance: StatDiff }>;
  byTarget: Record<string, { hitRate: StatDiff; averageErrorDistance: StatDiff }>;
  firstHalfHitRate: StatDiff;
  secondHalfHitRate: StatDiff;
}

/** 2セッションの統計を比較する(diff = 基準 - 過去) */
export function compareStatistics(
  base: SessionStatistics,
  other: SessionStatistics
): SessionComparison {
  const orders = ["1", "2", "3"] as const;
  const byDartInSet = {} as SessionComparison["byDartInSet"];
  for (const o of orders) {
    byDartInSet[o] = {
      hitRate: diffOf(base.byDartInSet[o].hitRate, other.byDartInSet[o].hitRate),
      averageErrorDistance: diffOf(
        base.byDartInSet[o].averageErrorDistance,
        other.byDartInSet[o].averageErrorDistance
      ),
    };
  }
  const byTarget: SessionComparison["byTarget"] = {};
  const labels = new Set([
    ...Object.keys(base.byTarget),
    ...Object.keys(other.byTarget),
  ]);
  for (const label of labels) {
    byTarget[label] = {
      hitRate: diffOf(
        base.byTarget[label]?.hitRate,
        other.byTarget[label]?.hitRate
      ),
      averageErrorDistance: diffOf(
        base.byTarget[label]?.averageErrorDistance,
        other.byTarget[label]?.averageErrorDistance
      ),
    };
  }
  return {
    hitRate: diffOf(base.exactHitRate, other.exactHitRate),
    averageErrorDistance: diffOf(
      base.combinedError.averageErrorDistance,
      other.combinedError.averageErrorDistance
    ),
    byDartInSet,
    byTarget,
    firstHalfHitRate: diffOf(base.firstHalf.hitRate, other.firstHalf.hitRate),
    secondHalfHitRate: diffOf(
      base.secondHalf.hitRate,
      other.secondHalf.hitRate
    ),
  };
}
