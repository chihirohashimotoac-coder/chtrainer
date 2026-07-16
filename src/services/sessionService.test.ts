import { describe, expect, it } from "vitest";
import { STEEL_BOARD } from "../config/boardProfiles";
import { getThrows, getThrowSets, saveSession } from "../db/db";
import { landingFromCoordinate } from "../domain/landing";
import { buildSessionCsv } from "../export/csv";
import { buildAnalysisMarkdown } from "../export/markdown";
import { fixtureSession, T20 } from "../test/fixtures";
import { commitSet, recalcAndSaveStatistics } from "./sessionService";

describe("session commit/export flow", () => {
  it("persists a 60 throw session and exports all throws", async () => {
    const session = fixtureSession({
      id: "session-60-integration",
      setCount: 20,
      plannedThrowCount: 60,
      plannedTargets: Array.from({ length: 20 }, () => [T20, T20, T20]),
      progress: { currentSetNumber: 20, middleAssessmentDone: true },
      status: "completed",
    });
    await saveSession(session);

    const rep = T20.representativePoint;
    for (let setNumber = 1; setNumber <= 20; setNumber += 1) {
      await commitSet(
        session,
        setNumber,
        [1, 2, 3].map((dartInSet) => ({
          dartInSet: dartInSet as 1 | 2 | 3,
          target: T20,
          landing: landingFromCoordinate(
            rep.x + setNumber * 0.001,
            rep.y + dartInSet * 0.001,
            STEEL_BOARD
          ),
        })),
        undefined,
        session.startedAt
      );
    }

    const sets = await getThrowSets(session.id);
    const throws = await getThrows(session.id);
    const stats = await recalcAndSaveStatistics(session.id);
    const setNumberOf = (setId: string) =>
      sets.find((set) => set.id === setId)?.setNumber ?? 0;

    expect(sets).toHaveLength(20);
    expect(throws).toHaveLength(60);
    expect(stats?.completedThrows).toBe(60);

    const markdown = buildAnalysisMarkdown({
      session,
      player: undefined,
      equipment: undefined,
      stats: stats!,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: true,
    });
    const csv = buildSessionCsv(session, throws, setNumberOf);

    expect(markdown).toContain("| 60 | 20 | 3 |");
    expect(csv.trim().split("\r\n")).toHaveLength(61);
  });
});
