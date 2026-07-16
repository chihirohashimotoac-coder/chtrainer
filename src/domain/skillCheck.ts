import type { BoardProfile } from "../config/boardProfiles";
import type { TargetDefinition } from "../types/models";
import {
  makeBullAnyTarget,
  makeNumberSectorTarget,
  makeSegmentTarget,
} from "./targets";

/**
 * スキル診断: 4ラウンド構成の技能測定メニュー。
 *  R1 グルーピング: 20エリア全体を狙い、3本のまとまりを測定
 *  R2 ブル: Bull狙いの精度
 *  R3 ナンバー: T20同一3投セット、T20→T16→T15、T12→T18→T3 の3パターンを循環
 *              (三角形を1投ずつなぞる切替セット2種を含む)
 *  R4 ダブル: D16固定セットとD20固定セットを交互に(チェックアウト力)
 * セット数は4ラウンドへ均等配分(余りは先頭ラウンドから+1)。
 */
export const SKILL_ROUND_LABELS = [
  "グルーピング",
  "ブル",
  "ナンバー",
  "ダブル",
] as const;

function groupingTarget(profile: BoardProfile): TargetDefinition {
  return {
    ...makeNumberSectorTarget(20, profile),
    label: "グルーピング(20全体)",
  };
}

export function buildSkillCheckPlan(
  profile: BoardProfile,
  setCount: number
): TargetDefinition[][] {
  const grouping = groupingTarget(profile);
  const bull = makeBullAnyTarget();
  const t20 = makeSegmentTarget("triple", profile, 20);
  const t16 = makeSegmentTarget("triple", profile, 16);
  const t15 = makeSegmentTarget("triple", profile, 15);
  const t12 = makeSegmentTarget("triple", profile, 12);
  const t18 = makeSegmentTarget("triple", profile, 18);
  const t3 = makeSegmentTarget("triple", profile, 3);
  const d16 = makeSegmentTarget("double", profile, 16);
  const d20 = makeSegmentTarget("double", profile, 20);

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
    [t20, t20, t20],
    [t20, t16, t15],
    [t12, t18, t3],
  ];
  for (let k = 0; k < (counts[2] ?? 0); k++) {
    sets.push((numberPatterns[k % 3] ?? numberPatterns[0]) as TargetDefinition[]);
  }
  for (let k = 0; k < (counts[3] ?? 0); k++) {
    const d = k % 2 === 0 ? d16 : d20;
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
