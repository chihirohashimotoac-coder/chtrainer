/**
 * サンプルデータ(JSONバックアップ・AI分析依頼Markdown・CSV)を生成するスクリプト。
 * 実行: npx vite-node scripts/generate-samples.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { calculateStatistics } from "../src/domain/stats";
import { buildBackup, serializeBackup } from "../src/export/backup";
import { buildSessionCsv } from "../src/export/csv";
import { buildAnalysisMarkdown } from "../src/export/markdown";
import { fixtureSession, handComputedThrows } from "../src/test/fixtures";
import { SCHEMA_VERSION, type PlayerProfile } from "../src/types/models";

const outDir = join(process.cwd(), "samples");
mkdirSync(outDir, { recursive: true });
const SAMPLE_GENERATED_AT = "2026-01-01T10:30:00.000Z";

const player: PlayerProfile = {
  schemaVersion: SCHEMA_VERSION,
  id: "player-1",
  displayName: "サンプルプレイヤー",
  dominantHand: "right",
  defaultBoardType: "steel",
  dartColors: ["#e05252", "#4f7fe0", "#f0f0f0"],
  defaultInputMethod: "coordinate",
  vibrationEnabled: true,
  soundEnabled: false,
  autoAdvanceEnabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const session = fixtureSession({
  assessments: [
    {
      timing: "before",
      recordedAt: "2026-01-01T09:59:00.000Z",
      fatigue: 3,
      concentration: 7,
      pain: 0,
      confidence: 6,
    },
    {
      timing: "middle",
      recordedAt: "2026-01-01T10:10:00.000Z",
      fatigue: 4,
      concentration: 7,
      pain: 0,
      confidence: 6,
      conditionChange: "same",
    },
    {
      timing: "after",
      recordedAt: "2026-01-01T10:20:00.000Z",
      fatigue: 6,
      concentration: 5,
      pain: 1,
      confidence: 5,
      conditionChange: "worse",
      note: "後半に集中が切れた",
    },
  ],
  sessionNote: "サンプルセッション(フィクスチャから生成)",
});
const throws = handComputedThrows();
const stats = calculateStatistics(
  session.id,
  session.plannedThrowCount,
  throws,
  session.trainingMode,
  SAMPLE_GENERATED_AT
);
const setNumberOf = (setId: string) => Number(setId.replace("set-", ""));

const backup = buildBackup({
  settings: [
    {
      schemaVersion: SCHEMA_VERSION,
      id: "app",
      onboardingCompleted: true,
      activePlayerId: player.id,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  players: [player],
  equipmentProfiles: [],
  trainingPlans: [],
  sessions: [session],
  throwSets: [],
  throws,
  sessionStatistics: [stats],
}, SAMPLE_GENERATED_AT);
writeFileSync(join(outDir, "sample-backup.json"), serializeBackup(backup));

const markdown = buildAnalysisMarkdown({
  session,
  player,
  equipment: undefined,
  stats,
  throws,
  setNumberOf,
  comparisons: [],
  embedAllThrows: true,
});
writeFileSync(join(outDir, "sample-ai-request.md"), markdown);

writeFileSync(
  join(outDir, "sample-session.csv"),
  "﻿" + buildSessionCsv(session, throws, setNumberOf)
);

console.log("samples generated in ./samples");
