import type {
  SessionStatistics,
  TrainingSession,
} from "../types/models";

export interface ComparisonCandidate {
  session: TrainingSession;
  score: number;
  reasons: string[];
}

function scoreCandidate(
  base: TrainingSession,
  session: TrainingSession,
  baseLabels: string,
  baseTime: number
): ComparisonCandidate {
  let score = 0;
  const reasons: string[] = [];
  if (session.trainingMode === base.trainingMode) {
    score += 1000;
    reasons.push("同じトレーニングモード");
  }
  if (
    base.scoringStyle != null &&
    session.scoringStyle === base.scoringStyle
  ) {
    score += 500;
    reasons.push("同じスコアリング形式");
  }
  if (targetSignature(session) === baseLabels) {
    score += 400;
    reasons.push("同じターゲット構成");
  }
  if (session.boardType === base.boardType) {
    score += 250;
    reasons.push("同じボード種別");
  }
  if (session.inputMethod === base.inputMethod) {
    score += 120;
    reasons.push("同じ入力方式");
  }
  if (
    session.equipmentProfileId != null &&
    session.equipmentProfileId === base.equipmentProfileId
  ) {
    score += 100;
    reasons.push("同じ使用機材");
  }
  if (session.status === "completed") {
    score += 80;
  } else {
    reasons.push("中断セッション");
  }
  // 日付の近さ: 30日以内で最大50点
  const days = Math.abs(baseTime - Date.parse(session.startedAt)) / 86400000;
  score += Math.max(0, 50 - Math.min(50, days * (50 / 30)));
  return { session, score, reasons };
}

/**
 * 「おすすめの比較候補」= 同一トレーニングモードのセッションのみ。
 * モードが異なるセッションは統計の意味が違うため、おすすめには決して含めない
 * (参考として見たい場合は rankDissimilarCandidates を明示的に使う)。
 * 同モード内の優先順位: スコアリング形式 > ターゲット構成 > ボード種別 >
 * 入力方式 > 機材 > 完了状態 > 日付の近さ
 */
export function rankComparisonCandidates(
  base: TrainingSession,
  others: readonly TrainingSession[]
): ComparisonCandidate[] {
  const baseLabels = targetSignature(base);
  const baseTime = Date.parse(base.startedAt);
  return others
    .filter(
      (s) =>
        s.id !== base.id &&
        s.status !== "active" &&
        s.trainingMode === base.trainingMode
    )
    .map((session) => scoreCandidate(base, session, baseLabels, baseTime))
    .sort((a, b) => b.score - a.score);
}

/**
 * 条件の異なる(=モードが違う)セッションの参考リスト。
 * ユーザーが明示的に「条件の異なるセッションを表示」を選んだ場合だけ使う。
 */
export function rankDissimilarCandidates(
  base: TrainingSession,
  others: readonly TrainingSession[]
): ComparisonCandidate[] {
  const baseLabels = targetSignature(base);
  const baseTime = Date.parse(base.startedAt);
  return others
    .filter(
      (s) =>
        s.id !== base.id &&
        s.status !== "active" &&
        s.trainingMode !== base.trainingMode
    )
    .map((session) => scoreCandidate(base, session, baseLabels, baseTime))
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
