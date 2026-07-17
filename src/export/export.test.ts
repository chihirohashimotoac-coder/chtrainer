import { describe, expect, it } from "vitest";
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
import { STEEL_BOARD } from "../config/boardProfiles";
import { BACKUP_VERSION } from "../config/constants";

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
    expect(markdown).toContain("医学的診断を行わないでください");
    expect(markdown).toContain("【事実】");
    expect(markdown).toContain("次回優先して練習すべき課題");
  });

  it("全投擲データの表を含む", () => {
    expect(markdown).toContain("| No. | セット | 投順 |");
    expect(markdown).toContain("| T20 |");
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
    expect(skillMd).toContain("グルーピング力");
    expect(skillMd).toContain("ブル精度");
    expect(skillMd).toContain("ナンバー精度");
    expect(skillMd).toContain("チェックアウト力");
    expect(
      build({ trainingMode: "zero_one", arrangement: "fixed_three" })
    ).toContain("分析焦点(フィニッシュ3投指定)");
    expect(
      build({ trainingMode: "zero_one", arrangement: "same_per_set" })
    ).toContain("分析焦点(同一ターゲット反復練習)");
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
      player: { ...player, displayName: "変更後ユーザー", goal: "pro" },
      equipment: currentEquipment,
      stats,
      throws,
      setNumberOf,
      comparisons: [],
      embedAllThrows: false,
    });
    expect(md).toContain("開始時の復調ユーザー");
    expect(md).toContain("開始時セッティング");
    expect(md).not.toContain("変更後ユーザー");
    expect(md).not.toContain("変更後セッティング");
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
