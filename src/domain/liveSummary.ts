import type { ThrowRecord } from "../types/models";

/** セッション中に表示する軽量な進捗サマリ。統計キャッシュに依存せず投擲から即算出する。 */
export interface LiveSummary {
  completedThrows: number;
  /** 命中判定対象(exactHitがtrue/falseの投擲。grouping_onlyのundefinedは除外)。 */
  scorableThrows: number;
  hits: number;
  /** 命中率。判定対象0なら undefined(N/A)。 */
  hitRate?: number;
  errorSampleCount: number;
  averageErrorDistance?: number;
  outboardCount: number;
}

/**
 * 既にコミット済みの投擲から進捗サマリを算出する(ライブ・フィードバック用)。
 * derived を信頼し、命中率・平均誤差を統計と同じ定義(分母0はN/A)で扱う。
 */
export function liveSummary(throws: ThrowRecord[]): LiveSummary {
  let scorableThrows = 0;
  let hits = 0;
  let errorSampleCount = 0;
  let errorSum = 0;
  let outboardCount = 0;

  for (const th of throws) {
    const exact = th.derived?.exactHit;
    if (exact !== undefined) {
      scorableThrows += 1;
      if (exact) hits += 1;
    }
    const err = th.derived?.errorDistance;
    if (err != null && Number.isFinite(err)) {
      errorSampleCount += 1;
      errorSum += err;
    }
    if (th.landing?.ring === "outboard") outboardCount += 1;
  }

  return {
    completedThrows: throws.length,
    scorableThrows,
    hits,
    hitRate: scorableThrows > 0 ? hits / scorableThrows : undefined,
    errorSampleCount,
    averageErrorDistance:
      errorSampleCount > 0 ? errorSum / errorSampleCount : undefined,
    outboardCount,
  };
}
