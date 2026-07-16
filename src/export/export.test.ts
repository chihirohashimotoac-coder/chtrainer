import { describe, expect, it } from "vitest";
import { buildSessionCsv, csvToBlob, escapeCsvField, CSV_COLUMNS } from "./csv";
import { buildAnalysisMarkdown } from "./markdown";
import { buildBackup, parseBackup, serializeBackup, validateBackup } from "./backup";
import { calculateStatistics } from "../domain/stats";
import {
  fixtureSession,
  handComputedThrows,
} from "../test/fixtures";
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
    expect(skillMd).toContain("ブル精度");
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
