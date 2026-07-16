import type { BoardProfile } from "../config/boardProfiles";
import type { TargetDefinition } from "../types/models";
import {
  makeBullAnyTarget,
  makeCustomTarget,
  makeSegmentTarget,
} from "./targets";

/**
 * スキル診断: 4ラウンド構成の技能測定メニュー。
 *  R1 グルーピング: 1投目は自由、2投目以降は1投目の着弾点を狙い、3本のまとまりを測定
 *  R2 ブル: Bull狙いの精度
 *  R3 ナンバー: T20同一3投セット、T20→T16→T15、T12→T18→T3 の3パターンを循環
 *              (三角形を1投ずつなぞる切替セット2種を含む)
 *  R4 ダブル: D16固定セットとD20固定セットを交互に(チェックアウト力)
 * セット数は4ラウンドへ均等配分(余りは先頭ラウンドから+1)。
 * 各ターゲットの instruction に「狙い方と測定内容」を持たせ、投擲画面に表示する。
 */
export const SKILL_ROUND_LABELS = [
  "グルーピング",
  "ブル",
  "ナンバー",
  "ダブル",
] as const;

/** 投擲画面に表示するラウンド別の指示文 */
export const SKILL_INSTRUCTIONS = {
  grouping:
    "1投目は狙いやすい場所へ投げてください。2投目・3投目は、1投目に刺さった場所を続けて狙ってください。測定するのは3投のまとまり(着弾間の距離)で、命中率は問いません。",
  bull: "Bullを狙って3本投げてください。ブルへの命中精度を測定します。",
  numberSame:
    "T20に3本連続で投げてください。同じターゲットを狙い続ける精度を測定します。",
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
  };
}

export function buildSkillCheckPlan(
  profile: BoardProfile,
  setCount: number
): TargetDefinition[][] {
  const grouping = groupingTarget(profile);
  const bull = withInstruction(makeBullAnyTarget(), SKILL_INSTRUCTIONS.bull);
  const t20Same = withInstruction(
    makeSegmentTarget("triple", profile, 20),
    SKILL_INSTRUCTIONS.numberSame
  );
  const tri = (n: number) =>
    withInstruction(
      makeSegmentTarget("triple", profile, n),
      SKILL_INSTRUCTIONS.triangle
    );
  const dbl = (n: number) =>
    withInstruction(
      makeSegmentTarget("double", profile, n),
      SKILL_INSTRUCTIONS.double
    );

  const base = Math.floor(setCount / 4);
  const extra = setCount % 4;
  const counts = [0, 1, 2, 3].map((i) => base + (i < extra ? 1 : 0));

  const sets: TargetDefinition[][] = [];
  for (let k = 0; k < (counts[0] ?? 0); k++) {
    sets.push([grouping, grouping, grouping]);
  }
  for (let k = 0; k < (counts[1] ?? 0); k++) {
    sets.push([bull, bull, bull]);
  }
  // R3: 同一3投 → 三角形1(T20→T16→T15) → 三角形2(T12→T18→T3) を循環
  const numberPatterns: TargetDefinition[][] = [
    [t20Same, t20Same, t20Same],
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
  profile: BoardProfile
): TargetDefinition[] {
  return [
    groupingTarget(profile),
    makeBullAnyTarget(),
    makeSegmentTarget("triple", profile, 20),
    makeSegmentTarget("triple", profile, 16),
    makeSegmentTarget("triple", profile, 15),
    makeSegmentTarget("triple", profile, 12),
    makeSegmentTarget("triple", profile, 18),
    makeSegmentTarget("triple", profile, 3),
    makeSegmentTarget("double", profile, 16),
    makeSegmentTarget("double", profile, 20),
  ];
}
