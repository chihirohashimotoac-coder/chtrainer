import JSZip from "jszip";
import type { TrainingSession } from "../types/models";

/** Builds a portable analysis bundle without mutating persisted data. */
export async function buildAnalysisZip(
  markdown: string,
  csv: string,
  session: TrainingSession
): Promise<Blob> {
  const zip = new JSZip();
  zip.file("analysis-request.md", markdown);
  zip.file("throws.csv", csv);
  zip.file(
    "metadata.json",
    JSON.stringify(
      {
        schemaVersion: session.schemaVersion,
        sessionId: session.id,
        startedAt: session.startedAt,
        trainingMode: session.trainingMode,
        scoringStyle: session.scoringStyle ?? null,
        contextSnapshot: session.contextSnapshot ?? null,
        assessments: session.assessments,
      },
      null,
      2
    )
  );
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
