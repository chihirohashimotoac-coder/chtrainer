import { BACKUP_VERSION, APP_VERSION } from "../config/constants";
import type { BackupFile } from "../types/models";
import { nowIso } from "../utils/id";

export type BackupData = BackupFile["data"];

export const BACKUP_STORE_KEYS: (keyof BackupData)[] = [
  "settings",
  "players",
  "equipmentProfiles",
  "trainingPlans",
  "sessions",
  "throwSets",
  "throws",
  "sessionStatistics",
];

/** 全データからバックアップファイルオブジェクトを構築する */
export function buildBackup(
  data: BackupData,
  createdAt: string = nowIso()
): BackupFile {
  const counts: Record<string, number> = {};
  for (const key of BACKUP_STORE_KEYS) {
    counts[key] = data[key].length;
  }
  return {
    format: "darts-training-analyzer-backup",
    backupVersion: BACKUP_VERSION,
    createdAt,
    appVersion: APP_VERSION,
    counts,
    data,
  };
}

export interface BackupValidation {
  ok: boolean;
  error?: "invalid_structure" | "version_too_new";
  counts?: Record<string, number>;
  backup?: BackupFile;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === "object" && v !== null)
  );
}

function hasId(items: Record<string, unknown>[]): boolean {
  return items.every((v) => typeof v["id"] === "string");
}

/**
 * インポートファイルの検証。
 * 構造が不正な場合は既存データを壊さないよう ok=false を返す。
 */
export function validateBackup(raw: unknown): BackupValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "invalid_structure" };
  }
  const obj = raw as Record<string, unknown>;
  if (obj["format"] !== "darts-training-analyzer-backup") {
    return { ok: false, error: "invalid_structure" };
  }
  if (typeof obj["backupVersion"] !== "number") {
    return { ok: false, error: "invalid_structure" };
  }
  if (obj["backupVersion"] > BACKUP_VERSION) {
    return { ok: false, error: "version_too_new" };
  }
  const data = obj["data"];
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "invalid_structure" };
  }
  const dataObj = data as Record<string, unknown>;
  const counts: Record<string, number> = {};
  for (const key of BACKUP_STORE_KEYS) {
    const items = dataObj[key];
    if (!isRecordArray(items)) {
      return { ok: false, error: "invalid_structure" };
    }
    if (key !== "sessionStatistics" && !hasId(items)) {
      return { ok: false, error: "invalid_structure" };
    }
    counts[key] = items.length;
  }
  // sessionStatistics は sessionId をキーとする
  const stats = dataObj["sessionStatistics"] as Record<string, unknown>[];
  if (!stats.every((s) => typeof s["sessionId"] === "string")) {
    return { ok: false, error: "invalid_structure" };
  }
  return { ok: true, counts, backup: raw as BackupFile };
}

/** バックアップをJSON文字列へシリアライズ */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** JSON文字列をパースして検証する */
export function parseBackup(text: string): BackupValidation {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: "invalid_structure" };
  }
}
