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
 *  R4 ダブル: 固定精度とセット内切替精度をデータ駆動パターンで比較
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
} as const;

export interface DoubleRoundPattern {
  id: string;
  label: string;
  kind: "fixed" | "switch";
  targets: readonly [number, number, number];
  instruction: string;
  analysisCategory: string;
}

function fixedDoublePattern(
  id: string,
  number: number,
  analysisCategory: string
): DoubleRoundPattern {
  return {
    id,
    label: `D${number}固定`,
    kind: "fixed",
    targets: [number, number, number],
    instruction: `D${number}を3本続けて狙ってください。同じダブルを繰り返す精度を測定します`,
    analysisCategory,
  };
}

function switchDoublePattern(
  id: string,
  targets: readonly [number, number, number],
  label: string,
  analysisCategory: string
): DoubleRoundPattern {
  const route = targets.map((number) => `D${number}`).join(" → ");
  return {
    id,
    label,
    kind: "switch",
    targets,
    instruction: `${route}の順に、1本ずつ狙いを変更してください。ダブルを切り替えたときの精度を測定します`,
    analysisCategory,
  };
}

/**
 * R4の決定論的パターン列。先頭5件が標準20セット時の構成。
 * 全15件では fixed 8 / switch 7 となり、使い切った後は先頭から循環する。
 */
export const DOUBLE_ROUND_PATTERNS: readonly DoubleRoundPattern[] = [
  fixedDoublePattern("r4-d20-fixed", 20, "d20_fixed"),
  fixedDoublePattern("r4-d16-fixed", 16, "d16_fixed"),
  switchDoublePattern("r4-route-20", [20, 10, 5], "20系切替", "route20"),
  switchDoublePattern("r4-route-16", [16, 8, 4], "16系切替", "route16"),
  switchDoublePattern("r4-position-spread", [12, 18, 6], "位置分散", "position_spread"),
  fixedDoublePattern("r4-d10-fixed", 10, "fixed_other"),
  fixedDoublePattern("r4-d8-fixed", 8, "fixed_other"),
  fixedDoublePattern("r4-d18-fixed", 18, "fixed_other"),
  fixedDoublePattern("r4-d12-fixed", 12, "fixed_other"),
  fixedDoublePattern("r4-d6-fixed", 6, "fixed_other"),
  fixedDoublePattern("r4-d4-fixed", 4, "fixed_other"),
  switchDoublePattern("r4-switch-20-16-10", [20, 16, 10], "D20→D16→D10", "mixed_switch"),
  switchDoublePattern("r4-switch-16-20-8", [16, 20, 8], "D16→D20→D8", "mixed_switch"),
  switchDoublePattern("r4-switch-18-12-4", [18, 12, 4], "D18→D12→D4", "mixed_switch"),
  switchDoublePattern("r4-switch-10-6-2", [10, 6, 2], "D10→D6→D2", "mixed_switch"),
] as const;

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
  const doublePatternSet = (pattern: DoubleRoundPattern) =>
    pattern.targets.map((number) => ({
      ...skillTarget(
        withInstruction(
          makeSegmentTarget("double", profile, number),
          pattern.instruction
        ),
        "skill-r4",
        "checkout"
      ),
      patternId: pattern.id,
      patternKind: pattern.kind,
      analysisCategory: pattern.analysisCategory,
    }));

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
    const pattern = DOUBLE_ROUND_PATTERNS[k % DOUBLE_ROUND_PATTERNS.length];
    if (pattern) sets.push(doublePatternSet(pattern));
  }
  return sets;
}

/** 設定確認画面などで表示する、スキル診断で使用するターゲット一覧 */
export function skillCheckUniqueTargets(
  profile: BoardProfile,
  scoringStyle?: ScoringStyle
): TargetDefinition[];
export function skillCheckUniqueTargets(
  profile: BoardProfile,
  setCount: number,
  scoringStyle?: ScoringStyle
): TargetDefinition[];
export function skillCheckUniqueTargets(
  profile: BoardProfile,
  setCountOrStyle: number | ScoringStyle = 20,
  style: ScoringStyle = "fit_bull"
): TargetDefinition[] {
  const setCount = typeof setCountOrStyle === "number" ? setCountOrStyle : 20;
  const scoringStyle = typeof setCountOrStyle === "number" ? style : setCountOrStyle;
  const unique = new Map<string, TargetDefinition>();
  for (const set of buildSkillCheckPlan(profile, setCount, scoringStyle)) {
    for (const target of set) {
      // IDは生成ごとに異なるため、表示上の意味を表すラベルで順序付き重複排除する。
      if (!unique.has(target.label)) unique.set(target.label, target);
    }
  }
  return [...unique.values()];
}
