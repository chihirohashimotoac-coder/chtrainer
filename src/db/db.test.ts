import { openDB } from "idb";
// @ts-expect-error The browser app intentionally excludes Node types; Vitest runs in Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDb, getSession, importAllData } from "./db";
import { parseBackup } from "../export/backup";

describe("IndexedDB schema upgrades", () => {
  it("v1からv2への更新で派生統計を無効化する", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("darts-training-analyzer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    const legacy = await openDB("darts-training-analyzer", 1, {
      upgrade(db) {
        db.createObjectStore("settings", { keyPath: "id" });
        db.createObjectStore("players", { keyPath: "id" });
        db.createObjectStore("equipmentProfiles", { keyPath: "id" });
        db.createObjectStore("trainingPlans", { keyPath: "id" });
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("byStatus", "status");
        sessions.createIndex("byStartedAt", "startedAt");
        const sets = db.createObjectStore("throwSets", { keyPath: "id" });
        sets.createIndex("bySession", "sessionId");
        const throws = db.createObjectStore("throws", { keyPath: "id" });
        throws.createIndex("bySession", "sessionId");
        db.createObjectStore("sessionStatistics", { keyPath: "sessionId" });
        db.createObjectStore("appMetadata", { keyPath: "key" });
      },
    });
    await legacy.put("sessionStatistics", {
      sessionId: "legacy-session",
      exactHitRate: 1,
    });
    legacy.close();

    const upgraded = await getDb();
    expect(await upgraded.getAll("sessionStatistics")).toEqual([]);

    const sample = parseBackup(
      readFileSync("samples/sample-backup.json", "utf8")
    );
    expect(sample.ok).toBe(true);
    await importAllData(sample.backup!.data, "replace");
    expect((await getSession("session-1"))?.schemaVersion).toBe(2);
    upgraded.close();
  });
});
