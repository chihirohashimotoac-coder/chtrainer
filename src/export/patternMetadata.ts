import type { ThrowRecord } from "../types/models";

export type PatternMetadataSource =
  | "recorded"
  | "inferred_from_observed_targets";

export interface EffectivePatternMetadata {
  patternId: string;
  patternKind: "fixed" | "switch";
  analysisCategory: string;
  source: PatternMetadataSource;
}
function isR4(record: ThrowRecord): boolean {
  return record.target.roundId === "skill-r4" ||
    record.target.roundKind === "checkout";
}

function inferredCategory(labels: readonly string[]): string {
  const sequence = labels.join(">");
  if (sequence === "D20>D20>D20") return "d20_fixed";
  if (sequence === "D16>D16>D16") return "d16_fixed";
  if (sequence === "D20>D10>D5") return "route20";
  if (sequence === "D16>D8>D4") return "route16";
  if (sequence === "D12>D18>D6") return "position_spread";
  return labels.every((label) => label === labels[0])
    ? "other_fixed"
    : "other_switch";
}

function safeIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * R4 pattern metadata was introduced after round metadata. For older throws,
 * infer only what the observed targets prove; never rewrite stored records or
 * pretend that an unobserved v1.19 pattern was measured.
 */
export function effectiveR4PatternMetadata(
  throws: readonly ThrowRecord[]
): Map<string, EffectivePatternMetadata> {
  const bySet = new Map<string, ThrowRecord[]>();
  for (const record of throws) {
    if (!isR4(record)) continue;
    const group = bySet.get(record.setId) ?? [];
    group.push(record);
    bySet.set(record.setId, group);
  }

  const result = new Map<string, EffectivePatternMetadata>();
  for (const [setId, records] of bySet) {
    const sorted = records.slice().sort((a, b) =>
      a.dartInSet - b.dartInSet || a.globalThrowNumber - b.globalThrowNumber
    );
    const recorded = sorted.find((record) =>
      record.target.patternId != null &&
      record.target.patternKind != null &&
      record.target.analysisCategory != null
    );
    if (
      recorded?.target.patternId &&
      recorded.target.patternKind &&
      recorded.target.analysisCategory
    ) {
      result.set(setId, {
        patternId: recorded.target.patternId,
        patternKind: recorded.target.patternKind,
        analysisCategory: recorded.target.analysisCategory,
        source: "recorded",
      });
      continue;
    }

    const labels = sorted.map((record) => record.target.label);
    if (labels.length === 0) continue;
    const patternKind = labels.every((label) => label === labels[0])
      ? "fixed"
      : "switch";
    result.set(setId, {
      patternId: `legacy-observed-${patternKind}-${safeIdPart(labels.join("-"))}`,
      patternKind,
      analysisCategory: inferredCategory(labels),
      source: "inferred_from_observed_targets",
    });
  }
  return result;
}
