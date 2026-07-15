import { DISPLAY_DECIMALS, RATE_DECIMALS } from "../config/constants";

/** 数値を表示用に丸める。undefined は "N/A"。 */
export function fmtNum(
  value: number | undefined | null,
  decimals: number = DISPLAY_DECIMALS
): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(decimals);
}

/** 率(0-1)をパーセント表示にする */
export function fmtRate(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(RATE_DECIMALS)}%`;
}

/** 率の差を符号付きパーセントで表示 */
export function fmtRateDiff(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(RATE_DECIMALS)}pt`;
}

/** 数値差を符号付きで表示 */
export function fmtNumDiff(
  value: number | undefined | null,
  decimals: number = DISPLAY_DECIMALS
): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

/** ISO日時をローカル表示へ */
export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 経過ミリ秒を mm:ss 表示へ */
export function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
