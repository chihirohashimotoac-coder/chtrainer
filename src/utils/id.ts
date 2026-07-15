import type { UUID } from "../types/models";

/** UUID を生成する。crypto.randomUUID が無い環境ではフォールバック。 */
export function newId(): UUID {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  let out = "";
  const hex = "0123456789abcdef";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}
