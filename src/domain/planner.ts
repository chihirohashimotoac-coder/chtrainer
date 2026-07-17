import { DARTS_PER_SET } from "../config/constants";
import type { TargetDefinition } from "../types/models";

/**
 * ターゲット出題の並べ方:
 *  - same_per_set: 1セット3本とも同じターゲット。セットごとに選択リストを順番に使う
 *  - fixed_three: 全セットで1投目・2投目・3投目のターゲットが固定
 *  - cycle: 登録順に1投ずつ出題(リストを繰り返す)
 *  - balanced: 出題数が可能な限り均等になるようにし、順番だけランダム化
 *  - pure: 毎投完全ランダム
 *  - blocks: 1ターゲットを連続セットでまとめて出題し、リスト順に切り替える
 *            (例: 20セット×[T20,T19] → T20を10セット→T19を10セット)
 */
export type Arrangement =
  | "same_per_set"
  | "fixed_three"
  | "cycle"
  | "balanced"
  | "pure"
  | "blocks"
  | "within_set_switch";

export type Rng = () => number;

/** Fisher-Yates シャッフル(非破壊) */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

function chunkIntoSets(flat: TargetDefinition[]): TargetDefinition[][] {
  const sets: TargetDefinition[][] = [];
  for (let i = 0; i < flat.length; i += DARTS_PER_SET) {
    sets.push(flat.slice(i, i + DARTS_PER_SET));
  }
  return sets;
}

/**
 * セッション開始時に全セット分の出題ターゲットを確定する。
 * pool は選択済みターゲット(1件以上)。
 */
export function generatePlannedTargets(
  arrangement: Arrangement,
  pool: TargetDefinition[],
  setCount: number,
  rng: Rng = Math.random
): TargetDefinition[][] {
  if (pool.length === 0) throw new Error("target pool is empty");
  const totalThrows = setCount * DARTS_PER_SET;

  switch (arrangement) {
    case "same_per_set": {
      const sets: TargetDefinition[][] = [];
      for (let s = 0; s < setCount; s++) {
        const target = pool[s % pool.length] as TargetDefinition;
        sets.push([target, target, target]);
      }
      return sets;
    }
    case "fixed_three": {
      const three: TargetDefinition[] = [
        pool[0] as TargetDefinition,
        (pool[1] ?? pool[0]) as TargetDefinition,
        (pool[2] ?? pool[pool.length - 1]) as TargetDefinition,
      ];
      return Array.from({ length: setCount }, () => three.slice());
    }
    case "cycle": {
      const flat: TargetDefinition[] = [];
      for (let i = 0; i < totalThrows; i++) {
        flat.push(pool[i % pool.length] as TargetDefinition);
      }
      return chunkIntoSets(flat);
    }
    case "within_set_switch": {
      // 登録順をセッション全体で連続循環する。3種類以上なら原則3投が別、
      // 2種類なら A→B→A / B→A→B となり、出題数差は最大1投に収まる。
      const flat: TargetDefinition[] = [];
      for (let i = 0; i < totalThrows; i++) {
        flat.push(pool[i % pool.length] as TargetDefinition);
      }
      return chunkIntoSets(flat);
    }
    case "balanced": {
      // 各ターゲットが floor(total/n) 回、余りはランダムに+1回
      const flat: TargetDefinition[] = [];
      for (let i = 0; i < totalThrows; i++) {
        flat.push(pool[i % pool.length] as TargetDefinition);
      }
      return chunkIntoSets(shuffle(flat, rng));
    }
    case "pure": {
      const flat: TargetDefinition[] = [];
      for (let i = 0; i < totalThrows; i++) {
        flat.push(pool[Math.floor(rng() * pool.length)] as TargetDefinition);
      }
      return chunkIntoSets(flat);
    }
    case "blocks": {
      // 各ターゲットへ連続セットを割り当てる。余りは先頭のターゲットから+1
      const sets: TargetDefinition[][] = [];
      const n = pool.length;
      const base = Math.floor(setCount / n);
      const extra = setCount % n;
      pool.forEach((target, i) => {
        const count = base + (i < extra ? 1 : 0);
        for (let k = 0; k < count; k++) {
          sets.push([target, target, target]);
        }
      });
      return sets;
    }
  }
}

/** 出題数の均等性を検証するユーティリティ(テスト・表示用) */
export function countByLabel(sets: TargetDefinition[][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const set of sets) {
    for (const target of set) {
      counts[target.label] = (counts[target.label] ?? 0) + 1;
    }
  }
  return counts;
}
