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
 *  R3 ナンバー: T20同一3投セットと T20→T16→T15 の1投ずつ切替セットを交互に
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
  for (let k = 0; k < (counts[2] ?? 0); k++) {
    sets.push(k % 2 === 0 ? [t20, t20, t20] : [t20, t16, t15]);
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
    makeSegmentTarget("double", profile, 16),
    makeSegmentTarget("double", profile, 20),
  ];
}
