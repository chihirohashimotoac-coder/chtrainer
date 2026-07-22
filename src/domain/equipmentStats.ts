import type {
  EquipmentProfile,
  SessionStatistics,
  TrainingSession,
} from "../types/models";

/** セッティング(装備プロファイル)別の横断集計1件。 */
export interface EquipmentAggregate {
  /** 未設定は undefined。 */
  equipmentId?: string;
  name: string;
  sessionCount: number;
  throwCount: number;
  scorableThrows: number;
  /** 命中率(命中数合計 / 判定対象合計)。分母0なら undefined(N/A)。 */
  hitRate?: number;
  errorSampleCount: number;
  /** 平均誤差距離(サンプル数で加重平均)。 */
  averageErrorDistance?: number;
  validSetCount: number;
  /** 平均グルーピング径(有効セット数で加重平均)。 */
  averageDiameter?: number;
}

interface Accumulator extends EquipmentAggregate {
  _hits: number;
  _errWeighted: number;
  _diaWeighted: number;
}

const NONE_KEY = "__none__";

/**
 * セッティング別にセッション統計を横断集計する。
 * 命中率などモード依存の指標が混ざらないよう、opts.mode でモードを絞れる。
 * 完了セッションのみを対象にする(中断は投擲数が不揃いで比較を歪めるため)。
 */
export function aggregateByEquipment(
  sessions: TrainingSession[],
  statsMap: Record<string, SessionStatistics>,
  equipmentProfiles: EquipmentProfile[],
  opts?: { mode?: string }
): EquipmentAggregate[] {
  const nameOf = new Map(equipmentProfiles.map((p) => [p.id, p.name]));
  const groups = new Map<string, Accumulator>();

  for (const sess of sessions) {
    if (sess.status !== "completed") continue;
    if (opts?.mode && sess.trainingMode !== opts.mode) continue;
    const st = statsMap[sess.id];
    if (!st) continue;

    const key = sess.equipmentProfileId ?? NONE_KEY;
    let g = groups.get(key);
    if (!g) {
      g = {
        equipmentId: sess.equipmentProfileId,
        name: sess.equipmentProfileId
          ? nameOf.get(sess.equipmentProfileId) ?? "(削除済みのセッティング)"
          : "(未設定)",
        sessionCount: 0,
        throwCount: 0,
        scorableThrows: 0,
        errorSampleCount: 0,
        validSetCount: 0,
        _hits: 0,
        _errWeighted: 0,
        _diaWeighted: 0,
      };
      groups.set(key, g);
    }

    g.sessionCount += 1;
    g.throwCount += st.completedThrows;
    g.scorableThrows += st.scorableThrows ?? 0;
    g._hits += st.exactHits;

    const errSample = st.coordinateError?.sampleCount ?? 0;
    const errAvg = st.coordinateError?.averageErrorDistance;
    if (errSample > 0 && errAvg != null) {
      g.errorSampleCount += errSample;
      g._errWeighted += errAvg * errSample;
    }

    const validSets = st.grouping?.validSetCount ?? 0;
    const dia = st.grouping?.averageDiameter;
    if (validSets > 0 && dia != null) {
      g.validSetCount += validSets;
      g._diaWeighted += dia * validSets;
    }
  }

  return [...groups.values()]
    .map((g) => ({
      equipmentId: g.equipmentId,
      name: g.name,
      sessionCount: g.sessionCount,
      throwCount: g.throwCount,
      scorableThrows: g.scorableThrows,
      hitRate: g.scorableThrows > 0 ? g._hits / g.scorableThrows : undefined,
      errorSampleCount: g.errorSampleCount,
      averageErrorDistance:
        g.errorSampleCount > 0 ? g._errWeighted / g.errorSampleCount : undefined,
      validSetCount: g.validSetCount,
      averageDiameter:
        g.validSetCount > 0 ? g._diaWeighted / g.validSetCount : undefined,
    }))
    .sort((a, b) => b.throwCount - a.throwCount);
}
