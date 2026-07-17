import type { ThrowRecord, TrainingSession } from "../types/models";

export const CSV_COLUMNS = [
  "session_id",
  "session_date",
  "training_mode",
  "board_type",
  "scoring_style",
  "set_number",
  "global_throw_number",
  "dart_in_set",
  "dart_color",
  "target_label",
  "target_number",
  "target_ring",
  "landing_number",
  "landing_ring",
  "exact_hit",
  "landing_x",
  "landing_y",
  "error_x",
  "error_y",
  "error_distance",
  "miss_direction",
  "position_precision",
  "evaluation_kind",
  "round_id",
  "previous_throw_was_hit",
  "same_set_as_previous",
  "previous_throw_was_hit_in_same_set",
  "same_target_as_previous",
  "target_changed",
  "elapsed_ms",
  "session_progress",
  "throw_note",
] as const;

/** CSVフィールドのエスケープ(RFC4180準拠) */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | boolean | undefined | null): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return escapeCsvField(value);
}

export interface SetNumberLookup {
  (setId: string): number | undefined;
}

/** セッションの全投擲をCSV文字列(BOMなし)に変換する */
export function buildSessionCsv(
  session: TrainingSession,
  throws: readonly ThrowRecord[],
  setNumberOf: SetNumberLookup
): string {
  const lines: string[] = [CSV_COLUMNS.join(",")];
  const sorted = throws
    .slice()
    .sort((a, b) => a.globalThrowNumber - b.globalThrowNumber);
  for (const t of sorted) {
    const row = [
      cell(session.id),
      cell(session.startedAt),
      cell(session.trainingMode),
      cell(session.boardType),
      cell(session.scoringStyle),
      cell(setNumberOf(t.setId)),
      cell(t.globalThrowNumber),
      cell(t.dartInSet),
      cell(t.dartColor),
      cell(t.target.label),
      cell(t.target.number),
      cell(t.target.ring),
      cell(t.landing.number),
      cell(t.landing.ring),
      cell(t.derived.exactHit),
      cell(t.landing.x),
      cell(t.landing.y),
      cell(t.derived.errorX),
      cell(t.derived.errorY),
      cell(t.derived.errorDistance),
      cell(t.derived.missDirection),
      cell(t.landing.positionPrecision),
      cell(t.target.evaluationKind),
      cell(t.target.roundId),
      cell(t.derived.previousThrowWasHit),
      cell(t.derived.sameSetAsPrevious),
      cell(t.derived.previousThrowWasHitInSameSet),
      cell(t.derived.sameTargetAsPrevious),
      cell(t.derived.targetChangedFromPrevious),
      cell(t.elapsedMs),
      cell(t.derived.sessionProgress),
      cell(t.note),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * UTF-8 BOM付きのCSV Blobを作る。
 * 日本語版Excelで文字化けしないようBOMを付ける。
 */
export function csvToBlob(csv: string): Blob {
  return new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
}
