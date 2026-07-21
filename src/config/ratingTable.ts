import type { PlayerRating, RatingSystem } from "../types/models";

/**
 * レーティング体系の参照表。
 *
 * 重要な位置づけ:
 *  - これは「練習データからレーティングを判定する」ための計算式ではありません。
 *  - ユーザーの自己申告レーティング(体系＋数値)を、AI依頼文へ具体的な目安
 *    (01のPPD ≒ 1ダートあたり得点 / クリケットのMPR ≒ 1ラウンドあたりマーク)として
 *    添えるための、非公式・参考値の対応表です。
 *  - 値は各体系の一般的な100% STATS基準の下限しきい値(「〜以上」)を採録した目安であり、
 *    公式の最新値・算出方式とは異なる場合があります。DARTSLIVEとPHOENIXは同じ数字でも
 *    基準が異なるため、必ず体系とセットで扱います。
 *
 * 出典: PHOENIX / DARTSLIVE のレーティング対応の一般的な公開情報を基にした参考表
 * (2026年時点・非公式)。
 */

export interface RatingRow {
  /** レーティング値 */
  rating: number;
  /** 01のPPD(Points Per Dart・1ダートあたり得点)の下限目安 */
  ppd: number;
  /** クリケットのMPR(Marks Per Round・1ラウンド3投あたりマーク)の下限目安 */
  mpr: number;
  /** 体系固有のクラス/フライト表記(任意) */
  className?: string;
}

/** DARTSLIVE レーティング(Rt1〜18)。ppd/mprは100% STATS基準の下限目安。 */
export const DARTS_LIVE_TABLE: RatingRow[] = [
  { rating: 1, ppd: 0.0, mpr: 0.0, className: "C" },
  { rating: 2, ppd: 11.67, mpr: 1.05, className: "C" },
  { rating: 3, ppd: 13.33, mpr: 1.25, className: "C" },
  { rating: 4, ppd: 15.0, mpr: 1.45, className: "CC" },
  { rating: 5, ppd: 16.67, mpr: 1.65, className: "CC" },
  { rating: 6, ppd: 18.33, mpr: 1.85, className: "B" },
  { rating: 7, ppd: 20.0, mpr: 2.05, className: "B" },
  { rating: 8, ppd: 21.67, mpr: 2.25, className: "BB" },
  { rating: 9, ppd: 23.34, mpr: 2.45, className: "BB" },
  { rating: 10, ppd: 25.0, mpr: 2.65, className: "A" },
  { rating: 11, ppd: 26.67, mpr: 2.85, className: "A" },
  { rating: 12, ppd: 28.34, mpr: 3.05, className: "A" },
  { rating: 13, ppd: 30.0, mpr: 3.25, className: "AA" },
  { rating: 14, ppd: 32.34, mpr: 3.5, className: "AA" },
  { rating: 15, ppd: 34.67, mpr: 3.75, className: "AA" },
  { rating: 16, ppd: 37.0, mpr: 4.0, className: "SA" },
  { rating: 17, ppd: 39.34, mpr: 4.25, className: "SA" },
  { rating: 18, ppd: 41.67, mpr: 4.5, className: "SA" },
];

/** PHOENIX レーティング(1〜30)。ppd/mprは100% STATS基準の下限目安。 */
export const PHOENIX_TABLE: RatingRow[] = [
  { rating: 1, ppd: 0.0, mpr: 0.0, className: "N 1" },
  { rating: 2, ppd: 10.65, mpr: 1.1, className: "C 2" },
  { rating: 3, ppd: 11.9, mpr: 1.2, className: "C 3" },
  { rating: 4, ppd: 13.15, mpr: 1.31, className: "CC 4" },
  { rating: 5, ppd: 14.4, mpr: 1.46, className: "CC 5" },
  { rating: 6, ppd: 15.65, mpr: 1.61, className: "CCC 6" },
  { rating: 7, ppd: 16.9, mpr: 1.76, className: "CCC 7" },
  { rating: 8, ppd: 18.15, mpr: 1.91, className: "B 8" },
  { rating: 9, ppd: 19.45, mpr: 2.06, className: "B 9" },
  { rating: 10, ppd: 20.75, mpr: 2.21, className: "BB 10" },
  { rating: 11, ppd: 22.05, mpr: 2.36, className: "BB 11" },
  { rating: 12, ppd: 23.35, mpr: 2.51, className: "BBB 12" },
  { rating: 13, ppd: 24.65, mpr: 2.66, className: "BBB 13" },
  { rating: 14, ppd: 25.95, mpr: 2.81, className: "A 14" },
  { rating: 15, ppd: 27.3, mpr: 2.96, className: "A 15" },
  { rating: 16, ppd: 28.65, mpr: 3.11, className: "A 16" },
  { rating: 17, ppd: 30.0, mpr: 3.26, className: "AA 17" },
  { rating: 18, ppd: 31.35, mpr: 3.41, className: "AA 18" },
  { rating: 19, ppd: 32.7, mpr: 3.56, className: "AA 19" },
  { rating: 20, ppd: 34.05, mpr: 3.71, className: "AA 20" },
  { rating: 21, ppd: 35.4, mpr: 3.86, className: "AAA 21" },
  { rating: 22, ppd: 36.8, mpr: 4.07, className: "AAA 22" },
  { rating: 23, ppd: 38.2, mpr: 4.28, className: "AAA 23" },
  { rating: 24, ppd: 39.6, mpr: 4.49, className: "AAA 24" },
  { rating: 25, ppd: 41.0, mpr: 4.7, className: "MASTER 25" },
  { rating: 26, ppd: 42.4, mpr: 4.96, className: "MASTER 26" },
  { rating: 27, ppd: 43.8, mpr: 5.22, className: "MASTER 27" },
  { rating: 28, ppd: 45.2, mpr: 5.48, className: "GM 28" },
  { rating: 29, ppd: 46.6, mpr: 5.74, className: "GM 29" },
  { rating: 30, ppd: 48.0, mpr: 6.0, className: "GM 30" },
];

export const RATING_SYSTEM_LABELS: Record<RatingSystem, string> = {
  darts_live: "DARTSLIVE",
  phoenix: "PHOENIX",
};

export function ratingTableOf(system: RatingSystem): RatingRow[] {
  return system === "phoenix" ? PHOENIX_TABLE : DARTS_LIVE_TABLE;
}

/** その体系で選択可能なレーティング値の一覧(昇順) */
export function ratingValuesOf(system: RatingSystem): number[] {
  return ratingTableOf(system).map((row) => row.rating);
}

/** レーティング値に対応する行を返す(なければ undefined) */
export function ratingRowOf(rating: PlayerRating): RatingRow | undefined {
  return ratingTableOf(rating.system).find((row) => row.rating === rating.value);
}

/** 「DARTSLIVE Rt10」のような表示用ラベル */
export function formatRating(rating: PlayerRating): string {
  return `${RATING_SYSTEM_LABELS[rating.system]} Rt${rating.value}`;
}
