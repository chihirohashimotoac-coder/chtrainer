import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildSessionCsv, csvToBlob, escapeCsvField, CSV_COLUMNS } from "./csv";
import { buildAnalysisMarkdown } from "./markdown";
import { buildBackup, parseBackup, serializeBackup, validateBackup } from "./backup";
import { calculateStatistics } from "../domain/stats";
import {
  buildThrows,
  fixtureSession,
  handComputedThrows,
  T20,
} from "../test/fixtures";
import { landingFromCoordinate } from "../domain/landing";
import { SOFT_BOARD, STEEL_BOARD } from "../config/boardProfiles";
import { BACKUP_VERSION } from "../config/constants";
import { buildAnalysisZip } from "./zip";
import { buildSkillCheckPlan } from "../domain/skillCheck";

const session = fixtureSession();
const throws = handComputedThrows();
const stats = calculateStatistics(session.id, 6, throws);
const setNumberOf = (setId: string) => Number(setId.replace("set-", ""));

describe("CSV生成", () => {
  it("エスケープ: カンマ・引用符・改行", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line\nbreak")).toBe('"line\nbreak"');
  });

  it("ヘッダーと行数", () => {
    const csv = buildSessionCsv(session, throws, setNumberOf);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(1 + throws.length);
  });

  it("行の内容 (1投目)", () => {
    const csv = buildSessionCsv(session, throws, setNumberOf);
    const lines = csv.trim().split("\r\n");
    const first = (lines[1] ?? "").split(",");
    expect(first[0]).toBe(session.id);
    expect(first[CSV_COLUMNS.indexOf("set_number")]).toBe("1");
    expect(first[CSV_COLUMNS.indexOf("dart_in_set")]).toBe("1");
    expect(first[CSV_COLUMNS.indexOf("target_label")]).toBe("T20");
    expect(first[CSV_COLUMNS.indexOf("exact_hit")]).toBe("true");
  });

  it("scoring_style列: 記録ありは値、未記録は空フィールド", () => {
    const styled = fixtureSession({
      trainingMode: "skill_check",
      scoringStyle: "separate_bull",
    });
    const csv = buildSessionCsv(styled, throws, setNumberOf);
    const lines = csv.trim().split("\r\n");
    expect(CSV_COLUMNS).toContain("scoring_style");
    const col = CSV_COLUMNS.indexOf("scoring_style");
    expect((lines[1] ?? "").split(",")[col]).toBe("separate_bull");
    const legacyCsv = buildSessionCsv(session, throws, setNumberOf);
    const legacyLines = legacyCsv.trim().split("\r\n");
    expect((legacyLines[1] ?? "").split(",")[col]).toBe("");
  });

  it("開始・中間・終了の投擲プロセス評価を明確な列へ出力する", () => {
    const assessed = fixtureSession({ assessments: [
      { timing: "before", recordedAt: "2026-01-01T09:00:00Z", fatigue: 1, concentration: 5, pain: 0, confidence: 4, uninterruptedThrowRate: 30, releaseStopTiming: "during_setup" },
      { timing: "middle", recordedAt: "2026-01-01T09:30:00Z", fatigue: 2, concentration: 6, pain: 0, confidence: 5, uninterruptedThrowRate: 50, releaseStopTiming: "before_takeback" },
      { timing: "after", recordedAt: "2026-01-01T10:00:00Z", fatigue: 3, concentration: 7, pain: 0, confidence: 6, uninterruptedThrowRate: 70, releaseStopTiming: "none" },
    ] });
    const first = (buildSessionCsv(assessed, throws, setNumberOf).trim().split("\r\n")[1] ?? "").split(",");
    expect(first[CSV_COLUMNS.indexOf("assessment_before_uninterrupted_throw_rate_percent")]).toBe("30");
    expect(first[CSV_COLUMNS.indexOf("assessment_middle_uninterrupted_throw_rate_percent")]).toBe("50");
    expect(first[CSV_COLUMNS.indexOf("assessment_after_uninterrupted_throw_rate_percent")]).toBe("70");
    expect(first[CSV_COLUMNS.indexOf("assessment_after_release_stop_timing")]).toBe("none");
  });

  it("R4パターンとセット境界の意味をCSV列へ一致させる", () => {
    const target = {
      ...T20,
      evaluationKind: "exact_hit" as const,
      roundId: "skill-r4",
      roundKind: "checkout" as const,
      patternId: "r4-route-20",
      patternKind: "switch" as const,
      analysisCategory: "route20",
    };
    const [record] = buildThrows([{ target, landing: landingFromCoordinate(
      target.representativePoint.x,
      target.representativePoint.y,
      STEEL_BOARD
    ) }], 1);
    const csv = buildSessionCsv(session, [record!], setNumberOf);
    const first = (csv.trim().split("\r\n")[1] ?? "").split(",");
    expect(first[CSV_COLUMNS.indexOf("round_kind")]).toBe("checkout");
    expect(first[CSV_COLUMNS.indexOf("pattern_id")]).toBe("r4-route-20");
    expect(first[CSV_COLUMNS.indexOf("pattern_kind")]).toBe("switch");
    expect(first[CSV_COLUMNS.indexOf("analysis_category")]).toBe("route20");
    expect(first[CSV_COLUMNS.indexOf("pattern_metadata_source")]).toBe("recorded");
    expect(first[CSV_COLUMNS.indexOf("previous_throw_was_hit")]).toBe("");
    expect(first[CSV_COLUMNS.indexOf("same_target_as_previous")]).toBe("");
    expect(first[CSV_COLUMNS.indexOf("target_changed")]).toBe("");
  });

  it("座標なしの投擲は空フィールド", () => {
    const csv = buildSessionCsv(session, throws, setNumberOf);
    const lines = csv.trim().split("\r\n");
    const bounce = (lines[5] ?? "").split(",");
    expect(bounce[CSV_COLUMNS.indexOf("landing_ring")]).toBe("bounce_out");
    expect(bounce[CSV_COLUMNS.indexOf("landing_x")]).toBe("");
    expect(bounce[CSV_COLUMNS.indexOf("error_distance")]).toBe("");
  });

  it("BOM付きBlobを生成する", () => {
    const blob = csvToBlob("a,b\r\n");
    expect(blob.type).toContain("text/csv");
    expect(blob.size).toBeGreaterThan(6);
  });
});

describe("Markdown生成", () => {
  const markdown = buildAnalysisMarkdown({
    session,
    player: undefined,
    equipment: undefined,
    stats,
    throws,
    setNumberOf,
    comparisons: [],
    embedAllThrows: true,
  });

  it("必須セクションを含む", () => {
    for (const heading of [
      "# ダーツ投擲データ分析依頼",
      "## AIへの分析指示",
      "## セッション概要",
      "## 環境情報",
      "## 開始前・中間・終了後の自己評価",
      "## アプリ算出の基本統計",
      "## 過去セッションとの比較",
      "## 全投擲データ",
      "## セッションメモ",
      "## データ利用上の注意",
    ]) {
      expect(markdown).toContain(heading);
    }
  });

  it("分析指示のルールを含む", () => {
    expect(markdown).toContain("医学的診断、心理的診断、性格診断は禁止");
    expect(markdown).toContain("【事実】");
    expect(markdown).toContain("### 2. ユーザーの問題点");
    expect(markdown).toContain("優先して改善すべき項目");
    expect(markdown).toContain("原因候補・仮説");
    expect(markdown).toContain("仮説と矛盾する点");
    expect(markdown).toContain("改善方法（原因仮説を確認するための実験）");
    expect(markdown).toContain("成功判定");
    expect(markdown).toContain("原因を絞り込む追加質問");
    expect(markdown).toContain("ユーザー回答後の再診断");
    expect(markdown).toContain("着弾データだけから");
  });

  it("全投擲データの表を含む", () => {
    expect(markdown).toContain("| No. | セット | 投順 |");
    expect(markdown).toContain("| T20 |");
    expect(markdown).toContain("evaluation_kind");
    expect(markdown).toContain("same_set_as_previous");
  });

  it("grouping_onlyは命中数・命中率・投擲命中をN/A表示にする", () => {
    const groupingTarget = buildSkillCheckPlan(SOFT_BOARD, 20)[0]![0]!;
    const groupingThrows = buildThrows(
      [0, 0.01, -0.01].map((x) => ({
        target: groupingTarget,
        setId: "grouping-set",
        landing: landingFromCoordinate(x, 0, SOFT_BOARD),
      })),
      3
    );
    const groupingStats = calculateStatistics("grouping", 3, groupingThrows, "skill_check");
    const md = buildAnalysisMarkdown({
      session: fixtureSession({ trainingMode: "skill_check", plannedThrowCount: 3, setCount: 1 }),
      player: undefined,
      equipment: undefined,
      stats: groupingStats,
      throws: groupingThrows,
      setNumberOf: () => 1,
      comparisons: [],
      embedAllThrows: true,
    });
    expect(md).toContain("| 1投目の着弾点 | 3 | 0 | N/A | N/A |");
    expect(md).toContain("| 1投目の着弾点 |");
    expect(md).not.toContain("| 1投目の着弾点 | 3 | 0 | 0.0% |");
    const csv = buildSessionCsv(session, groupingThrows, () => 1);
    const exactHit = (csv.trim().split("\r\n")[1] ?? "").split(",")[
      CSV_COLUMNS.indexOf("exact_hit")
    ];
    expect(exactHit).toBe("");
  });

  it("投順別表は総投擲数と命中率の分母を分けて表示する", () => {
    const plan = buildSkillCheckPlan(SOFT_BOARD, 20, "fit_bull");
    const skillThrows = buildThrows(
      plan.flatMap((targets, setIndex) =>
        targets.map((target) => ({
          target,
          setId: `skill-set-${setIndex + 1}`,
          landing: landingFromCoordinate(
            target.representativePoint.x,
            target.representativePoint.y,
            SOFT_BOARD
          ),
        }))
      ),
      60
    );
    const skillStats = calculateStatistics("skill-denominator", 60, skillThrows, "skill_check");
    const md = buildAnalysisMarkdown({
      session: fixtureSession({
        id: "skill-denominator",
        trainingMode: "skill_check",
        scoringStyle: "fit_bull",
        plannedThrowCount: 60,
        setCount: 20,
      }),
      player: undefined,
      equipment: undefined,
      stats: skillStats,
      throws: skillThrows,
      setNumberOf: (setId) => Number(setId.replace("skill-set-", "")),
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).toContain("| 投順 | 総投擲数 | 命中判定対象数(命中率の分母) |");
    expect(md).toContain("| 1投目 | 20 | 15 | 15 | 100.0% |");
  });

  it("旧R4は観測ターゲット列から安全に補完し未測定パターンを明示する", () => {
    const current = buildSkillCheckPlan(SOFT_BOARD, 20, "fit_bull")[15]!;
    const legacyTargets = current.map((target) => ({
      ...target,
      patternId: undefined,
      patternKind: undefined,
      analysisCategory: undefined,
    }));
    const legacyThrows = buildThrows(
      legacyTargets.map((target) => ({
        target,
        setId: "legacy-r4-set",
        landing: landingFromCoordinate(
          target.representativePoint.x,
          target.representativePoint.y,
          SOFT_BOARD
        ),
      })),
      3
    );
    const legacySession = fixtureSession({
      id: "legacy-r4",
      trainingMode: "skill_check",
      plannedThrowCount: 3,
      setCount: 1,
    });
    const legacyStats = calculateStatistics("legacy-r4", 3, legacyThrows, "skill_check");
    const md = buildAnalysisMarkdown({
      session: legacySession,
      player: undefined,
      equipment: undefined,
      stats: legacyStats,
      throws: legacyThrows,
      setNumberOf: () => 1,
      comparisons: [],
      embedAllThrows: true,
    });
    expect(md).toContain("legacy-observed-fixed-d20-d20-d20");
    expect(md).toContain("inferred_from_observed_targets");
    expect(md).toContain("switchパターン: 未測定（分析不能）");
    const csv = buildSessionCsv(legacySession, legacyThrows, () => 1);
    const first = (csv.trim().split("\r\n")[1] ?? "").split(",");
    expect(first[CSV_COLUMNS.indexOf("pattern_kind")]).toBe("fixed");
    expect(first[CSV_COLUMNS.indexOf("analysis_category")]).toBe("d20_fixed");
    expect(first[CSV_COLUMNS.indexOf("pattern_metadata_source")]).toBe(
      "inferred_from_observed_targets"
    );
  });

  it("座標なしはN/A、バウンスアウトを明示", () => {
    expect(markdown).toContain("N/A");
    expect(markdown).toContain("バウンスアウト");
  });

  it("統計値がアプリ計算と一致する", () => {
    expect(markdown).toContain("完全命中率: 16.7%");
    expect(markdown).toContain("平均誤差距離: 0.150");
  });

  it("モード別の分析焦点セクションを含む (同一ターゲット系)", () => {
    // fixtureSession は same_target → 反復練習の焦点
    expect(markdown).toContain("このセッションの分析焦点(同一ターゲット反復練習)");
    expect(markdown).toContain("該当なし");
  });

  it("モードごとに分析焦点が切り替わる", () => {
    const build = (overrides: Parameters<typeof fixtureSession>[0]) =>
      buildAnalysisMarkdown({
        session: fixtureSession(overrides),
        player: undefined,
        equipment: undefined,
        stats,
        throws,
        setNumberOf,
        comparisons: [],
        embedAllThrows: false,
      });
    expect(build({ trainingMode: "bull" })).toContain(
      "分析焦点(ブル反復練習)"
    );
    expect(build({ trainingMode: "cricket" })).toContain(
      "分析焦点(クリケット練習)"
    );
    expect(build({ trainingMode: "cricket" })).toContain("平均マーク数");
    expect(build({ trainingMode: "random" })).toContain(
      "分析焦点(全体診断)"
    );
    const skillMd = build({
      trainingMode: "skill_check",
      arrangement: "blocks",
    });
    expect(skillMd).toContain("分析焦点(スキル診断)");
    expect(skillMd).toContain("R1 グルーピング(grouping_only)");
    expect(skillMd).toContain("R2 スコアリング(scoring)");
    expect(skillMd).toContain("R3 ナンバー(number)");
    expect(skillMd).toContain("R4 チェックアウト(checkout)");
    expect(skillMd).toContain("100点満点評価や採点基準の創作は禁止");
    expect(
      build({ trainingMode: "zero_one", arrangement: "fixed_three" })
    ).toContain("分析焦点(フィニッシュ3投指定)");
    expect(
      build({ trainingMode: "zero_one", arrangement: "same_per_set" })
    ).toContain("分析焦点(同一ターゲット反復練習)");
  });

  it("スキル診断の分析焦点はスコアリング形式で主役・副が切り替わる", () => {
    const build = (overrides: Parameters<typeof fixtureSession>[0]) =>
      buildAnalysisMarkdown({
        session: fixtureSession(overrides),
        player: undefined,
        equipment: undefined,
        stats,
        throws,
        setNumberOf,
        comparisons: [],
        embedAllThrows: false,
      });
    const fitBull = build({
      trainingMode: "skill_check",
      scoringStyle: "fit_bull",
    });
    expect(fitBull).toContain("フィットブル");
    expect(fitBull).toContain("01の削りの主役ターゲットはBull");
    expect(fitBull).toContain("R3 ナンバー(number): 副ターゲットT20");
    expect(fitBull).toContain("- スコアリング形式: フィットブル");
    const steel = build({
      trainingMode: "skill_check",
      scoringStyle: "steel",
    });
    expect(steel).toContain("ハード(スティール");
    expect(steel).toContain("01の削りの主役ターゲットはT20");
    expect(steel).toContain("R3 ナンバー(number): 副ターゲットBull");
    // 旧データ(形式未記録)はフィットブル相当として扱い、その旨を明記する
    const legacy = build({ trainingMode: "skill_check" });
    expect(legacy).toContain("スコアリング形式は記録されていません");
    expect(legacy).toContain("01の削りの主役ターゲットはBull");
    expect(legacy).not.toContain("- スコアリング形式:");
  });

  it("CSV別添方式では表を含めない", () => {
    const summary = buildAnalysisMarkdown({
      session,
      player: undefined,
      equipment: undefined,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(summary).not.toContain("| No. | セット | 投順 |");
    expect(summary).toContain("CSVファイルを参照");
  });

  it("比較セッションのセクションを出力する", () => {
    const other = fixtureSession({ id: "session-2", startedAt: "2025-12-01T10:00:00.000Z" });
    const otherStats = calculateStatistics("session-2", 6, throws);
    const withCompare = buildAnalysisMarkdown({
      session,
      player: undefined,
      equipment: undefined,
      stats,
      throws,
      setNumberOf,
      comparisons: [{ session: other, stats: otherStats }],
      embedAllThrows: false,
    });
    expect(withCompare).toContain("### 比較対象:");
    expect(withCompare).toContain("差 0.0pt");
  });
});

describe("ZIP出力", () => {
  it("Markdown・CSV・metadata.jsonを正しい内部名で含む", async () => {
    const csv = buildSessionCsv(session, throws, setNumberOf);
    const blob = await buildAnalysisZip("# analysis", csv, session);
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual([
      "analysis-request.md",
      "metadata.json",
      "throws.csv",
    ]);
    expect(await zip.file("analysis-request.md")?.async("string")).toBe(
      "# analysis"
    );
    expect(await zip.file("throws.csv")?.async("string")).toBe(csv);
    const metadata = JSON.parse(
      (await zip.file("metadata.json")?.async("string")) ?? "{}"
    ) as Record<string, unknown>;
    expect(metadata["sessionId"]).toBe(session.id);
    expect(metadata["assessments"]).toEqual(session.assessments);
  });
});

describe("目的プロファイル・メンタル評価・長期トレンドの出力", () => {
  const player = {
    schemaVersion: 1,
    id: "player-1",
    displayName: "テスト",
    dominantHand: "right" as const,
    goal: "recovery" as const,
    currentLevel: "レーティング8相当",
    targetLevel: "レーティング12",
    concern: "3投目で失速する",
    defaultBoardType: "soft" as const,
    dartColors: ["#111", "#222", "#333"] as [string, string, string],
    defaultInputMethod: "simple" as const,
    vibrationEnabled: false,
    soundEnabled: false,
    autoAdvanceEnabled: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("ユーザーの目的・背景セクションを出力する", () => {
    const md = buildAnalysisMarkdown({
      session,
      player,
      equipment: undefined,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).toContain("## ユーザーの目的・背景");
    expect(md).toContain("復調(以前の実力に戻る)");
    expect(md).toContain("レーティング8相当");
    expect(md).toContain("3投目で失速する");
    expect(md).toContain("この目的と悩みに直接応える形で");
    expect(md).toContain("目的別の注意（復調）");
    expect(md).toContain("医学的・心理的診断はしない");
  });

  it("プロ志望でもベンチマーク未記録なら合否を断定させない", () => {
    const md = buildAnalysisMarkdown({
      session: fixtureSession({ contextSnapshot: {
        capturedAt: "2026-01-01T09:59:00.000Z",
        displayName: "プロ志望",
        dominantHand: "right",
        goal: "pro",
        dartColors: ["#111", "#222", "#333"],
        boardType: "steel",
        inputMethod: "coordinate",
      } }),
      player,
      equipment: undefined,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).toContain("プロテストの合否を断定しない");
    expect(md).toContain("JAPANプロテスト基準を推測・創作しない");
  });

  it("開始時スナップショットは現在の人物・用品変更に影響されない", () => {
    const snapshotted = fixtureSession({ contextSnapshot: {
      capturedAt: "2026-01-01T09:59:00.000Z",
      displayName: "開始時の復調ユーザー",
      dominantHand: "left",
      goal: "recovery",
      currentLevel: "Rt8",
      targetLevel: "Rt16",
      concern: "リリースの怖さ",
      form: {
        gripFingerCount: "3",
        gripPosition: "center",
        takeback: "standard",
        throwingTempo: "slow",
        concern: "開始時は3投目で腕が止まる",
      },
      dartColors: ["#111", "#222", "#333"],
      boardType: "steel",
      inputMethod: "coordinate",
      equipmentSnapshot: { name: "開始時セッティング", barrel: { model: "OLD" } },
    } });
    const currentEquipment = {
      schemaVersion: 2,
      id: "equipment-current",
      name: "変更後セッティング",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const md = buildAnalysisMarkdown({
      session: snapshotted,
      player: {
        ...player,
        displayName: "変更後ユーザー",
        goal: "pro",
        form: { gripFingerCount: "4", concern: "変更後フォーム" },
      },
      equipment: currentEquipment,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).toContain("開始時の復調ユーザー");
    expect(md).toContain("開始時セッティング");
    expect(md).toContain("3フィンガー");
    expect(md).toContain("開始時は3投目で腕が止まる");
    expect(md).not.toContain("変更後ユーザー");
    expect(md).not.toContain("変更後セッティング");
    expect(md).not.toContain("変更後フォーム");
  });

  it("開始時に用品未選択なら現在用品へフォールバックしない", () => {
    const md = buildAnalysisMarkdown({
      session: fixtureSession({ contextSnapshot: {
        capturedAt: "2026-01-01T09:59:00.000Z",
        displayName: "用品なし",
        dominantHand: "right",
        dartColors: ["#111", "#222", "#333"],
        boardType: "steel",
        inputMethod: "coordinate",
      } }),
      player,
      equipment: {
        schemaVersion: 2, id: "later", name: "後日追加用品",
        createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
      },
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).toContain("セッティング: N/A");
    expect(md).not.toContain("後日追加用品");
  });

  it("目的未設定なら目的セクションを出力しない", () => {
    const md = buildAnalysisMarkdown({
      session,
      player: undefined,
      equipment: undefined,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).not.toContain("## ユーザーの目的・背景");
  });

  it("メンタル評価があると自己評価表に列が追加される", () => {
    const md = buildAnalysisMarkdown({
      session: fixtureSession({
        assessments: [
          {
            timing: "before",
            recordedAt: "2026-01-01T09:59:00.000Z",
            fatigue: 3,
            concentration: 7,
            pain: 0,
            confidence: 6,
            anxiety: 8,
            releaseFear: 6,
            routineAdherence: 4,
          },
        ],
      }),
      player: undefined,
      equipment: undefined,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).toContain("投げる前の不安");
    expect(md).toContain("リリースの怖さ");
    expect(md).toContain("| 8 | 6 | 4 |");
    expect(md).toContain("心理的・医学的診断ではない");
  });

  it("30%→50%→70%の時間変化と旧データN/Aを表で出力する", () => {
    const md = buildAnalysisMarkdown({
      session: fixtureSession({ assessments: [
        { timing: "before", recordedAt: "2026-01-01T09:00:00Z", fatigue: 1, concentration: 5, pain: 0, confidence: 4, uninterruptedThrowRate: 30, releaseStopTiming: "during_setup" },
        { timing: "middle", recordedAt: "2026-01-01T09:30:00Z", fatigue: 2, concentration: 6, pain: 0, confidence: 5, uninterruptedThrowRate: 50, releaseStopTiming: "before_takeback" },
        { timing: "after", recordedAt: "2026-01-01T10:00:00Z", fatigue: 3, concentration: 7, pain: 0, confidence: 6, uninterruptedThrowRate: 70, releaseStopTiming: "none" },
      ] }),
      player: undefined, equipment: undefined, stats, throws, setNumberOf,
      comparisons: [], embedAllThrows: false,
    });
    expect(md).toContain("| 開始前 | 1 | 5 | 0 | 4 | N/A | N/A | N/A | 30% | セットアップ中 |");
    expect(md).toContain("| 中間 | 2 | 6 | 0 | 5 | N/A | N/A | N/A | 50% | テイクバック開始前 |");
    expect(md).toContain("| 終了後 | 3 | 7 | 0 | 6 | N/A | N/A | N/A | 70% | なし |");
  });

  it("長期トレンドセクションを出力する", () => {
    const past = fixtureSession({
      id: "session-past",
      startedAt: "2025-12-01T10:00:00.000Z",
    });
    const pastStats = calculateStatistics("session-past", 6, throws);
    const md = buildAnalysisMarkdown({
      session,
      player: undefined,
      equipment: undefined,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      recentSessions: [{ session: past, stats: pastStats }],
      embedAllThrows: false,
    });
    expect(md).toContain("## 長期トレンド");
    expect(md).toContain("2025/12/01");
    expect(md).toContain("| 今回");
    expect(md).toContain("改善中/停滞/悪化");
  });
});

describe("60投セッションの通し検証 (統計→Markdown→CSV)", () => {
  // 20セット×3投=60投。T20狙いで規則的な着弾を生成
  const specs = Array.from({ length: 60 }, (_, i) => {
    const rep = T20.representativePoint;
    const dx = ((i % 5) - 2) * 0.03;
    const dy = ((i % 7) - 3) * 0.02;
    return {
      target: T20,
      landing: landingFromCoordinate(rep.x + dx, rep.y + dy, STEEL_BOARD),
    };
  });
  const throws60 = buildThrows(specs, 60);
  const session60 = fixtureSession({
    setCount: 20,
    plannedThrowCount: 60,
  });
  const stats60 = calculateStatistics(session60.id, 60, throws60);

  it("60投すべてが統計に反映される", () => {
    expect(stats60.completedThrows).toBe(60);
    expect(
      stats60.byDartInSet["1"].throwCount +
        stats60.byDartInSet["2"].throwCount +
        stats60.byDartInSet["3"].throwCount
    ).toBe(60);
    expect(stats60.firstHalf.throwCount + stats60.secondHalf.throwCount).toBe(60);
    expect(stats60.combinedError.sampleCount).toBe(60);
  });

  it("Markdownに60投分の行が含まれる", () => {
    const md = buildAnalysisMarkdown({
      session: session60,
      player: undefined,
      equipment: undefined,
      stats: stats60,
      throws: throws60,
      setNumberOf,
      comparisons: [],
      embedAllThrows: true,
    });
    const rows = md
      .split("\n")
      .filter((line) => /^ \| \d+ \| \d+ \|/.test(line) || /^\| \d+ \|/.test(line.trim()));
    expect(rows.length).toBeGreaterThanOrEqual(60);
    expect(md).toContain("- 完了投擲数: 60");
  });

  it("CSVに60行のデータが含まれる", () => {
    const csv = buildSessionCsv(session60, throws60, setNumberOf);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(1 + 60);
  });
});

describe("JSONバックアップ検証", () => {
  const backup = buildBackup({
    settings: [],
    players: [],
    equipmentProfiles: [],
    trainingPlans: [],
    sessions: [session],
    throwSets: [],
    throws,
    sessionStatistics: [stats],
  });

  it("バックアップのメタ情報", () => {
    expect(backup.format).toBe("darts-training-analyzer-backup");
    expect(backup.backupVersion).toBe(BACKUP_VERSION);
    expect(backup.counts["sessions"]).toBe(1);
    expect(backup.counts["throws"]).toBe(6);
  });

  it("正常なバックアップは検証を通過する", () => {
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    expect(result.counts?.["throws"]).toBe(6);
  });

  it("投擲プロセス評価をJSONバックアップ・復元で維持する", () => {
    const assessed = fixtureSession({ assessments: [{
      timing: "after", recordedAt: "2026-01-01T10:00:00Z",
      fatigue: 3, concentration: 7, pain: 0, confidence: 6,
      uninterruptedThrowRate: 70, releaseStopTiming: "before_release",
    }] });
    const value = buildBackup({
      settings: [], players: [], equipmentProfiles: [], trainingPlans: [],
      sessions: [assessed], throwSets: [], throws: [], sessionStatistics: [],
    });
    const restored = parseBackup(serializeBackup(value)).backup;
    expect(restored?.data.sessions[0]?.assessments[0]).toMatchObject({
      uninterruptedThrowRate: 70,
      releaseStopTiming: "before_release",
    });
  });

  it("旧バックアップv1/v2も引き続き読み込める", () => {
    expect(validateBackup({ ...backup, backupVersion: 1 }).ok).toBe(true);
    expect(validateBackup({ ...backup, backupVersion: 2 }).ok).toBe(true);
  });

  it("不正なJSONは拒否する", () => {
    expect(parseBackup("not json").ok).toBe(false);
    expect(parseBackup("{}").ok).toBe(false);
  });

  it("formatが違うファイルは拒否する", () => {
    expect(validateBackup({ format: "other", backupVersion: 1, data: {} }).ok).toBe(false);
  });

  it("新しすぎるバージョンは拒否する", () => {
    const result = validateBackup({
      ...backup,
      backupVersion: BACKUP_VERSION + 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("version_too_new");
  });

  it("ストア欠落は拒否する", () => {
    const broken = JSON.parse(serializeBackup(backup)) as {
      data: Record<string, unknown>;
    };
    delete broken.data["throws"];
    expect(validateBackup(broken).ok).toBe(false);
  });

  it("idを持たないレコードは拒否する", () => {
    const broken = JSON.parse(serializeBackup(backup)) as {
      data: { sessions: Record<string, unknown>[] };
    };
    broken.data.sessions = [{ notId: true }];
    expect(validateBackup(broken).ok).toBe(false);
  });
});
