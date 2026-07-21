import { describe, expect, it } from "vitest";
import { ja } from "./ja";
import { scoringStyleLabel } from "../export/markdown";
import { VERSION_HISTORY } from "../config/versionHistory";
import { STAT_DEFINITIONS } from "../config/statsDefinitions";
import { CENTER_NEAR_THRESHOLD } from "../config/constants";

describe("表記の回帰確認(ファットブル)", () => {
  it("UI文言辞書に誤記「フィットブル」が存在しない", () => {
    expect(JSON.stringify(ja)).not.toContain("フィットブル");
  });

  it("スコアリング形式の正式値はfat_bull・表示名はファットブル", () => {
    expect(ja.preSession.scoringStyles.fat_bull).toBe("ファットブル");
    expect(scoringStyleLabel("fat_bull")).toContain("ファットブル");
    expect(scoringStyleLabel("fat_bull")).not.toContain("フィットブル");
  });

  it("旧値fit_bullは後方互換としてファットブルの表示ラベルへ正規化する", () => {
    // fit_bull は旧誤記由来の保存値。表示・出力では fat_bull(ファットブル)扱い。
    expect(scoringStyleLabel("fit_bull")).toContain("ファットブル");
    expect(scoringStyleLabel("fit_bull")).not.toContain("フィットブル");
  });

  it("バージョン履歴はv1.22.0の修正告知の引用以外に旧誤記を含まない", () => {
    for (const entry of VERSION_HISTORY) {
      if (entry.version === "1.22.0") {
        // 「誤記『フィットブル』を修正」という告知としての引用は許容
        expect(entry.summary).toContain("ファットブル");
        continue;
      }
      expect(entry.summary).not.toContain("フィットブル");
    }
  });
});

describe("統計定義の表示文と実装値の一致", () => {
  it("中心付近の判定しきい値が定数と一致する", () => {
    const centerDef = STAT_DEFINITIONS.find((d) => d.term === "中心付近の判定");
    expect(centerDef?.definition).toContain(String(CENTER_NEAR_THRESHOLD));
  });

  it("正規化座標の定義(外側ダブル半径=1.0、Xは右が正、Yは上が正)を含む", () => {
    const coordDef = STAT_DEFINITIONS.find((d) => d.term === "座標系");
    expect(coordDef?.definition).toContain("1.0");
    expect(coordDef?.definition).toContain("Xは右が正");
    expect(coordDef?.definition).toContain("Yは上が正");
  });

  it("必須の定義項目がすべて存在する", () => {
    const terms = STAT_DEFINITIONS.map((d) => d.term);
    for (const required of [
      "座標系",
      "誤差距離",
      "平均誤差距離の分母",
      "詳細座標と簡易入力の違い",
      "命中判定対象数と総投擲数",
      "N/Aになる条件",
      "中心付近の判定",
      "主な外れ方向",
      "アウトボード・バウンスアウト",
      "グルーピング径",
    ]) {
      expect(terms).toContain(required);
    }
  });
});
