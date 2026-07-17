import type { BoardProfile } from "../config/boardProfiles";
import type { ScoringStyle, TargetDefinition } from "../types/models";
import {
  makeBullAnyTarget,
  makeCustomTarget,
  makeSegmentTarget,
} from "./targets";

/**
 * スキル診断: 4ラウンド構成の技能測定メニュー。
 *  R1 グルーピング: 1投目は自由、2投目以降は1投目の着弾点を狙い、3本のまとまりを測定
 *  R2 スコアリング: スコアリング形式の「01の削りの主役」を反復
 *              (フィットブル=Bull / セパレートブル・ハード=T20)
 *  R3 ナンバー: 副ターゲット(主役がBullならT20、T20ならBull)の同一3投セット、
 *              T20→T16→T15、T12→T18→T3 の3パターンを循環
 *              (三角形を1投ずつなぞる切替セット2種を含む)
 *  R4 ダブル: D16固定セットとD20固定セットを交互に(チェックアウト力)
 * セット数は4ラウンドへ均等配分。余りはスコアリングラウンド(R2)を最優先に
 * R2→R1→R3→R4の順で+1配分し、主役ターゲットのサンプル密度を確保する。
 * 各ターゲットの instruction に「狙い方と測定内容」を持たせ、投擲画面に表示する。
 */
export const SKILL_ROUND_LABELS = [
  "グルーピング",
  "スコアリング",
  "ナンバー",
  "ダブル",
] as const;

/** スコアリング形式ごとの「01の削りの主役ターゲット」 */
export function scoringMainOf(style: ScoringStyle): "bull" | "t20" {
  return style === "fit_bull" ? "bull" : "t20";
}

/** 投擲画面に表示するラウンド別の指示文 */
export const SKILL_INSTRUCTIONS = {
  grouping:
    "1投目は狙いやすい場所へ投げてください。2投目・3投目は、1投目に刺さった場所を続けて狙ってください。測定するのは3投のまとまり(着弾間の距離)で、命中率は問いません。",
  scoringBull:
    "Bullを狙って3本投げてください。01の削りの主役(Bull)への命中精度を測定します。",
  scoringT20:
    "T20を狙って3本投げてください。01の削りの主役(T20)への命中精度を測定します。",
  numberSame:
    "表示のターゲットに3本連続で投げてください。同じターゲットを狙い続ける精度を測定します。",
  triangle:
    "表示の順に1投ずつ狙いを変えて投げてください。ターゲットを切り替えたときの精度を測定します。",
  double:
    "表示のダブルを狙って3本投げてください。チェックアウト(ダブル)の精度を測定します。",
} as const;

function withInstruction(
  target: TargetDefinition,
  instruction: string
): TargetDefinition {
  return { ...target, instruction };
}

/**
 * グルーピングラウンドのターゲット。
 * 狙う場所は自由(1投目の着弾点に残り2本を集める)ため、
 * 固定エリアを持たない「フリーターゲット」(areas空のcustom_selection)とする。
 * 命中判定・誤差は記録せず、AIは3投の座標からまとまりを評価する。
 */
function groupingTarget(profile: BoardProfile): TargetDefinition {
  return {
    ...makeCustomTarget("1投目の着弾点", [], profile),
    instruction: SKILL_INSTRUCTIONS.grouping,
    evaluationKind: "grouping_only",
    roundId: "skill-r1",
    roundKind: "grouping",
    requiredInputPrecision: "coordinate",
  };
}

function skillTarget(
  target: TargetDefinition,
  roundId: string,
  roundKind: "scoring" | "number" | "checkout"
): TargetDefinition {
  return {
    ...target,
    evaluationKind: "exact_hit",
    roundId,
    roundKind,
    requiredInputPrecision: "any",
  };
}

/** R2スコアリングラウンドの主役ターゲット */
function scoringTarget(
  profile: BoardProfile,
  style: ScoringStyle
): TargetDefinition {
  const target =
    scoringMainOf(style) === "bull"
      ? withInstruction(makeBullAnyTarget(), SKILL_INSTRUCTIONS.scoringBull)
      : withInstruction(
          makeSegmentTarget("triple", profile, 20),
          SKILL_INSTRUCTIONS.scoringT20
        );
  return skillTarget(target, "skill-r2", "scoring");
}

/** R3同一3投セットの副ターゲット(主役と入れ替えで両方のデータを確保する) */
function numberSameTarget(
  profile: BoardProfile,
  style: ScoringStyle
): TargetDefinition {
  const target =
    scoringMainOf(style) === "bull"
      ? withInstruction(
          makeSegmentTarget("triple", profile, 20),
          SKILL_INSTRUCTIONS.numberSame
        )
      : withInstruction(makeBullAnyTarget(), SKILL_INSTRUCTIONS.numberSame);
  return skillTarget(target, "skill-r3", "number");
}

export function buildSkillCheckPlan(
  profile: BoardProfile,
  setCount: number,
  scoringStyle: ScoringStyle = "fit_bull"
): TargetDefinition[][] {
  const grouping = groupingTarget(profile);
  const scoring = scoringTarget(profile, scoringStyle);
  const numberSame = numberSameTarget(profile, scoringStyle);
  const tri = (n: number) =>
    skillTarget(withInstruction(
      makeSegmentTarget("triple", profile, n),
      SKILL_INSTRUCTIONS.triangle
    ), "skill-r3", "number");
  const dbl = (n: number) =>
    skillTarget(withInstruction(
      makeSegmentTarget("double", profile, n),
      SKILL_INSTRUCTIONS.double
    ), "skill-r4", "checkout");

  const base = Math.floor(setCount / 4);
  const extra = setCount % 4;
  const counts = [base, base, base, base];
  // 余りはR2(スコアリング=主役ターゲット)を最優先にR2→R1→R3→R4で配分
  const extraPriority = [1, 0, 2, 3] as const;
  for (let i = 0; i < extra; i++) {
    const round = extraPriority[i];
    if (round != null) counts[round] = (counts[round] ?? base) + 1;
  }

  const sets: TargetDefinition[][] = [];
  for (let k = 0; k < (counts[0] ?? 0); k++) {
    sets.push([grouping, grouping, grouping]);
  }
  for (let k = 0; k < (counts[1] ?? 0); k++) {
    sets.push([scoring, scoring, scoring]);
  }
  // R3: 同一3投(副ターゲット) → 三角形1(T20→T16→T15) → 三角形2(T12→T18→T3) を循環
  const numberPatterns: TargetDefinition[][] = [
    [numberSame, numberSame, numberSame],
    [tri(20), tri(16), tri(15)],
    [tri(12), tri(18), tri(3)],
  ];
  for (let k = 0; k < (counts[2] ?? 0); k++) {
    sets.push((numberPatterns[k % 3] ?? numberPatterns[0]) as TargetDefinition[]);
  }
  for (let k = 0; k < (counts[3] ?? 0); k++) {
    const d = k % 2 === 0 ? dbl(16) : dbl(20);
    sets.push([d, d, d]);
  }
  return sets;
}

/** 設定確認画面などで表示する、スキル診断で使用するターゲット一覧 */
export function skillCheckUniqueTargets(
  profile: BoardProfile,
  scoringStyle: ScoringStyle = "fit_bull"
): TargetDefinition[] {
  const bull = makeBullAnyTarget();
  const t20 = makeSegmentTarget("triple", profile, 20);
  const [main, sub] =
    scoringMainOf(scoringStyle) === "bull" ? [bull, t20] : [t20, bull];
  return [
    groupingTarget(profile),
    main,
    sub,
    makeSegmentTarget("triple", profile, 16),
    makeSegmentTarget("triple", profile, 15),
    makeSegmentTarget("triple", profile, 12),
    makeSegmentTarget("triple", profile, 18),
    makeSegmentTarget("triple", profile, 3),
    makeSegmentTarget("double", profile, 16),
    makeSegmentTarget("double", profile, 20),
  ];
}
