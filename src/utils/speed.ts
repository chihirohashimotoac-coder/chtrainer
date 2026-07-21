/** 矢速入力(文字列)をkm/hの数値へ変換する。空・非数・0以下は未入力扱い。 */
export function parseSpeedKmh(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return Math.round(Math.min(num, 999.9) * 10) / 10;
}
