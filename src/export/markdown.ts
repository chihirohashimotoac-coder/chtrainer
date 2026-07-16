import type {
  EquipmentProfile,
  MissDirection,
  PlayerProfile,
  SelfAssessment,
  SessionStatistics,
  ThrowRecord,
  TrainingSession,
} from "../types/models";
import { compareStatistics } from "../domain/compare";
import { ALL_DIRECTIONS } from "../domain/stats";
import { fmtNum, fmtNumDiff, fmtRate, fmtRateDiff, fmtDateTime, fmtElapsed } from "../utils/format";
import { t } from "../i18n/ja";

const NA = "N/A";

const MODE_LABELS: Record<string, string> = {
  same_target: "同一ターゲット3投",
  per_dart_targets: "3投別ターゲット",
  random: "ランダムターゲット",
  sequence: "登録順出題",
  bull: "ブル練習",
  double: "ダブル練習",
  triple: "トリプル練習",
  number: "特定ナンバー練習",
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

const CONDITION_LABELS: Record<string, string> = {
  better_than_usual: "普段より良い",
  usual: "普段通り",
  worse_than_usual: "普段より悪い",
};

const HAND_LABELS: Record<string, string> = {
  right: "右",
  left: "左",
  ambidextrous: "両利き",
};

const INPUT_LABELS: Record<string, string> = {
  simple: "簡易入力",
  coordinate: "詳細座標入力",
};

const ARRANGEMENT_LABELS: Record<string, string> = {
  balanced: "均等ランダム",
  pure: "完全ランダム",
  same_per_set: "同一ターゲット3投",
  fixed_three: "3投別ターゲット",
  cycle: "登録順",
};

const EYE_LABELS: Record<string, string> = {
  right: "右",
  left: "左",
  unknown: "不明",
};

const STANCE_LABELS: Record<string, string> = {
  closed: "クローズド",
  middle: "ミドル",
  open: "オープン",
};

const TIMING_LABELS: Record<string, string> = {
  before: "開始前",
  middle: "中間",
  after: "終了後",
};

const CHANGE_LABELS: Record<string, string> = {
  better: "開始時より良くなった",
  same: "変わらない",
  worse: "開始時より悪くなった",
};

export function directionLabel(dir: MissDirection | undefined): string {
  if (!dir) return NA;
  return t().direction[dir];
}

export function ringLabel(ring: string): string {
  const r = t().ring as Record<string, string>;
  return r[ring] ?? ring;
}

function landingLabel(throwRecord: ThrowRecord): string {
  const l = throwRecord.landing;
  if (l.ring === "outboard") {
    const dir = l.outboardDirection
      ? t().direction[l.outboardDirection as MissDirection] ?? "不明"
      : "";
    return dir ? `アウトボード(${dir})` : "アウトボード";
  }
  if (l.ring === "bounce_out") return "バウンスアウト";
  if (l.ring === "inner_bull") return "インナーブル";
  if (l.ring === "outer_bull") return "アウターブル";
  if (l.ring === "unknown") return "不明";
  const prefix =
    l.ring === "double" ? "D" : l.ring === "triple" ? "T" : "S";
  return `${prefix}${l.number ?? "?"}`;
}

/** AI分析依頼文(分析指示ブロック) */
export const ANALYSIS_INSTRUCTIONS = `あなたは、ダーツ競技、スポーツデータ分析、統計解析、運動学習に精通した分析者です。
以下の投擲データを多角的に分析してください。

## 分析上の重要ルール

- データから直接確認できる事実と、推測または仮説を分けてください。
- サンプル数が少ない項目は断定しないでください。
- 投擲位置だけからフォームや身体動作の原因を断定しないでください。
- フォームに言及する場合は、可能性のある仮説として説明してください。
- 分析できない項目は「分析不能」と明記してください。
- 数値を再計算した場合は、使用した値と計算方法を示してください。
- アプリ算出値と原始データに矛盾がある場合は指摘してください。
- 一般論だけで終わらせず、このデータの具体的な数値を引用してください。
- 医学的診断を行わないでください。

## 必ず分析する項目

1. データ品質と分析上の制約
2. 全体の命中精度
3. 1投目、2投目、3投目の違い
4. 1投目と2投目から調整し、3投目で精度が上がる傾向があるか
5. 成功した次の投擲と失敗した次の投擲の違い
6. 前投の外れ方向に対する次投の修正傾向
7. 大きく外した後に反対方向へ修正しすぎる傾向があるか
8. 同じターゲットを3本投げた場合のグルーピング
9. 1投ごとにターゲットを変えた場合の精度
10. ターゲット変更直後に精度が低下するか
11. ターゲットごとの得意・不得意
12. シングル、ダブル、トリプル、ブルごとの違い
13. 上、下、左、右および斜め方向の外れ傾向
14. 縦方向と横方向のどちらのばらつきが大きいか
15. ターゲットによって外れ方向が変化するか
16. セッション前半と後半の違い
17. 疲労度、集中度、痛み、当日の調子との関係
18. 過去セッションから改善または悪化した点
19. データから考えられる投げ方や修正方法の仮説
20. 次回優先して練習すべき課題

## 出力形式

以下の順に回答してください。

1. 結論の要約
2. データ品質と分析上の制約
3. データから確認できる事実
4. 1投目、2投目、3投目の比較
5. ターゲット別分析
6. 外れ方向とグルーピング
7. 前投から次投への修正傾向
8. ターゲット切替の影響
9. 時間経過、疲労、集中度との関係
10. 過去セッションとの比較
11. フォームや狙い方に関する仮説
12. 優先課題トップ3
13. 次回の具体的な練習メニュー
14. 追加で必要なデータ
15. 分析不能だった項目
16. データの矛盾または注意点

各記述には、可能な限り以下の分類を付けてください。

- 【事実】
- 【統計的傾向】
- 【仮説】
- 【分析不能】
- 【追加検証】

各項目の信頼度を以下で示してください。

- 高
- 中
- 低`;

function equipmentSummary(equipment: EquipmentProfile | undefined): string {
  if (!equipment) return NA;
  const parts: string[] = [equipment.name];
  if (equipment.barrel?.maker || equipment.barrel?.model) {
    const w = equipment.barrel.weightG != null ? ` ${equipment.barrel.weightG}g` : "";
    parts.push(
      `バレル: ${[equipment.barrel.maker, equipment.barrel.model].filter(Boolean).join(" ")}${w}`
    );
  }
  if (equipment.shaft?.maker || equipment.shaft?.model) {
    parts.push(
      `シャフト: ${[equipment.shaft.maker, equipment.shaft.model].filter(Boolean).join(" ")}`
    );
  }
  if (equipment.flight?.shape || equipment.flight?.model) {
    parts.push(
      `フライト: ${[equipment.flight.maker, equipment.flight.model, equipment.flight.shape].filter(Boolean).join(" ")}`
    );
  }
  return parts.join(" / ");
}

function assessmentSection(assessments: readonly SelfAssessment[]): string {
  if (assessments.length === 0) return "記録なし\n";
  const lines: string[] = [
    "| タイミング | 疲労度 | 集中度 | 痛み | 自信度 | 調子の変化 | メモ |",
    "|---|---:|---:|---:|---:|---|---|",
  ];
  for (const a of assessments) {
    lines.push(
      `| ${TIMING_LABELS[a.timing] ?? a.timing} | ${a.fatigue} | ${a.concentration} | ${a.pain} | ${a.confidence} | ${a.conditionChange ? CHANGE_LABELS[a.conditionChange] : NA} | ${a.note ?? ""} |`
    );
  }
  lines.push("");
  lines.push("(各項目は0〜10の自己評価。0=まったくない/非常に低い、10=非常に強い/非常に高い。医学的評価ではない)");
  return lines.join("\n") + "\n";
}

function errorStatsBlock(
  title: string,
  stats: SessionStatistics["coordinateError"]
): string {
  const lines = [
    `#### ${title}`,
    "",
    `- サンプル数: ${stats.sampleCount}`,
    `- 平均誤差距離: ${fmtNum(stats.averageErrorDistance)}`,
    `- 中央値誤差距離: ${fmtNum(stats.medianErrorDistance)}`,
    `- 平均誤差X: ${fmtNum(stats.averageErrorX)}`,
    `- 平均誤差Y: ${fmtNum(stats.averageErrorY)}`,
    "",
  ];
  return lines.join("\n");
}

function statsSection(stats: SessionStatistics): string {
  const s = stats;
  const out: string[] = [];
  out.push("### 全体");
  out.push("");
  out.push(`- 総投擲数(予定): ${s.totalThrows}`);
  out.push(`- 完了投擲数: ${s.completedThrows}`);
  out.push(`- 完全命中数: ${s.exactHits}`);
  out.push(`- 完全命中率: ${fmtRate(s.exactHitRate)}`);
  out.push(`- アウトボード数: ${s.outboardCount} (${fmtRate(s.outboardRate)})`);
  out.push(`- バウンスアウト数: ${s.bounceOutCount}`);
  out.push(`- 座標入力数: ${s.coordinateInputCount} / 簡易入力数: ${s.approximateInputCount}`);
  out.push("");
  out.push(errorStatsBlock("詳細座標入力による誤差統計", s.coordinateError));
  out.push(
    errorStatsBlock("簡易入力(概算)を含む誤差統計 ※簡易入力の座標はエリア代表点による概算値", s.combinedError)
  );
  out.push("### 1投目・2投目・3投目");
  out.push("");
  out.push("| 投順 | 投擲数 | 命中数 | 命中率 | 平均誤差距離 | アウトボード率 |");
  out.push("|---|---:|---:|---:|---:|---:|");
  for (const order of ["1", "2", "3"] as const) {
    const d = s.byDartInSet[order];
    out.push(
      `| ${order}投目 | ${d.throwCount} | ${d.hitCount} | ${fmtRate(d.hitRate)} | ${fmtNum(d.averageErrorDistance)} | ${fmtRate(d.outboardRate)} |`
    );
  }
  out.push("");
  out.push("### ターゲット別");
  out.push("");
  out.push("| ターゲット | 出題数 | 命中数 | 命中率 | 平均誤差距離 | 主な外れ方向 | アウトボード数 |");
  out.push("|---|---:|---:|---:|---:|---|---:|");
  for (const label of Object.keys(s.byTarget).sort()) {
    const g = s.byTarget[label];
    if (!g) continue;
    out.push(
      `| ${label} | ${g.throwCount} | ${g.hitCount} | ${fmtRate(g.hitRate)} | ${fmtNum(g.averageErrorDistance)} | ${directionLabel(g.mainMissDirection)} | ${g.outboardCount} |`
    );
  }
  out.push("");
  out.push("### 外れ方向");
  out.push("");
  out.push("| 方向 | 回数 |");
  out.push("|---|---:|");
  for (const dir of ALL_DIRECTIONS) {
    out.push(`| ${directionLabel(dir)} | ${s.byDirection[dir]} |`);
  }
  out.push("");
  out.push("### 前半・後半");
  out.push("");
  out.push("| 区間 | 投擲数 | 命中率 | 平均誤差距離 | アウトボード率 |");
  out.push("|---|---:|---:|---:|---:|");
  out.push(
    `| 前半 | ${s.firstHalf.throwCount} | ${fmtRate(s.firstHalf.hitRate)} | ${fmtNum(s.firstHalf.averageErrorDistance)} | ${fmtRate(s.firstHalf.outboardRate)} |`
  );
  out.push(
    `| 後半 | ${s.secondHalf.throwCount} | ${fmtRate(s.secondHalf.hitRate)} | ${fmtNum(s.secondHalf.averageErrorDistance)} | ${fmtRate(s.secondHalf.outboardRate)} |`
  );
  out.push("");
  out.push("### アウトボードとバウンスアウト");
  out.push("");
  out.push(`- アウトボード: ${s.outboardCount}回 (${fmtRate(s.outboardRate)})`);
  out.push(`- バウンスアウト: ${s.bounceOutCount}回 (着弾位置不明として記録)`);
  out.push("");
  return out.join("\n");
}

function throwTable(
  throws: readonly ThrowRecord[],
  setNumberOf: (setId: string) => number | undefined
): string {
  const out: string[] = [];
  out.push(
    "| No. | セット | 投順 | 狙い | 着弾 | 命中 | X | Y | 誤差X | 誤差Y | 誤差距離 | ズレ方向 | 入力精度 | 前投命中 | ターゲット変更 | 経過時間 | メモ |"
  );
  out.push(
    "|---:|---:|---:|---|---|---|---:|---:|---:|---:|---:|---|---|---|---|---:|---|"
  );
  const sorted = throws
    .slice()
    .sort((a, b) => a.globalThrowNumber - b.globalThrowNumber);
  for (const th of sorted) {
    const approx =
      th.landing.positionPrecision === "segment_approximation" ? "≈" : "";
    const num = (v: number | undefined) =>
      v == null ? NA : `${approx}${fmtNum(v)}`;
    const precisionLabel =
      th.landing.positionPrecision === "coordinate"
        ? "座標"
        : th.landing.positionPrecision === "segment_approximation"
          ? "概算"
          : th.landing.positionPrecision === "direction_only"
            ? "方向のみ"
            : "不明";
    out.push(
      [
        "",
        th.globalThrowNumber,
        setNumberOf(th.setId) ?? NA,
        th.dartInSet,
        th.target.label,
        landingLabel(th),
        th.derived.exactHit ? "○" : "×",
        num(th.landing.x),
        num(th.landing.y),
        num(th.derived.errorX),
        num(th.derived.errorY),
        num(th.derived.errorDistance),
        directionLabel(th.derived.missDirection),
        precisionLabel,
        th.derived.previousThrowWasHit == null
          ? NA
          : th.derived.previousThrowWasHit
            ? "○"
            : "×",
        th.derived.targetChangedFromPrevious ? "あり" : "なし",
        fmtElapsed(th.elapsedMs),
        th.note ?? "",
        "",
      ].join(" | ")
    );
  }
  out.push("");
  out.push("(座標は外側ダブル半径=1.0の正規化値。≈は簡易入力による概算値。X:右が正 / Y:上が正)");
  return out.join("\n");
}

export interface MarkdownInput {
  session: TrainingSession;
  player: PlayerProfile | undefined;
  equipment: EquipmentProfile | undefined;
  stats: SessionStatistics;
  throws: readonly ThrowRecord[];
  setNumberOf: (setId: string) => number | undefined;
  comparisons: {
    session: TrainingSession;
    stats: SessionStatistics;
  }[];
  /** 全データ埋め込み(true) or 集計+CSV別添(false) */
  embedAllThrows: boolean;
}

function comparisonSection(input: MarkdownInput): string {
  if (input.comparisons.length === 0) {
    return "比較対象セッションなし\n";
  }
  const out: string[] = [];
  for (const cmp of input.comparisons) {
    const c = compareStatistics(input.stats, cmp.stats);
    out.push(
      `### 比較対象: ${fmtDateTime(cmp.session.startedAt)} (${modeLabel(cmp.session.trainingMode)}, ${cmp.session.boardType === "steel" ? "スティール" : "ソフト"})`
    );
    out.push("");
    out.push(`- 完全命中率: 今回 ${fmtRate(c.hitRate.base)} / 過去 ${fmtRate(c.hitRate.other)} / 差 ${fmtRateDiff(c.hitRate.diff)}`);
    out.push(
      `- 平均誤差距離: 今回 ${fmtNum(c.averageErrorDistance.base)} / 過去 ${fmtNum(c.averageErrorDistance.other)} / 差 ${fmtNumDiff(c.averageErrorDistance.diff)}`
    );
    out.push("");
    out.push("| 投順 | 命中率(今回) | 命中率(過去) | 差 |");
    out.push("|---|---:|---:|---:|");
    for (const order of ["1", "2", "3"] as const) {
      const d = c.byDartInSet[order];
      out.push(
        `| ${order}投目 | ${fmtRate(d.hitRate.base)} | ${fmtRate(d.hitRate.other)} | ${fmtRateDiff(d.hitRate.diff)} |`
      );
    }
    out.push("");
    out.push(
      `- 前半命中率の差: ${fmtRateDiff(c.firstHalfHitRate.diff)} / 後半命中率の差: ${fmtRateDiff(c.secondHalfHitRate.diff)}`
    );
    const beforeBase = input.session.assessments.find((a) => a.timing === "before");
    const beforeOther = cmp.session.assessments.find((a) => a.timing === "before");
    if (beforeBase && beforeOther) {
      out.push(
        `- 開始前自己評価の差(今回-過去): 疲労度 ${fmtNumDiff(beforeBase.fatigue - beforeOther.fatigue, 0)} / 集中度 ${fmtNumDiff(beforeBase.concentration - beforeOther.concentration, 0)} / 痛み ${fmtNumDiff(beforeBase.pain - beforeOther.pain, 0)} / 自信度 ${fmtNumDiff(beforeBase.confidence - beforeOther.confidence, 0)}`
      );
    }
    out.push("");
  }
  return out.join("\n");
}

/** AI分析依頼Markdown全体を生成する */
export function buildAnalysisMarkdown(input: MarkdownInput): string {
  const { session, player, equipment, stats } = input;
  const out: string[] = [];
  out.push("# ダーツ投擲データ分析依頼");
  out.push("");
  out.push("## AIへの分析指示");
  out.push("");
  out.push(ANALYSIS_INSTRUCTIONS);
  out.push("");
  out.push("## セッション概要");
  out.push("");
  out.push(`- セッションID: ${session.id}`);
  out.push(`- 実施日時: ${fmtDateTime(session.startedAt)}${session.endedAt ? ` 〜 ${fmtDateTime(session.endedAt)}` : ""}`);
  out.push(
    `- 練習モード: ${modeLabel(session.trainingMode)}${session.arrangement ? ` (出題方式: ${ARRANGEMENT_LABELS[session.arrangement] ?? session.arrangement})` : ""}`
  );
  out.push(`- ボード種別: ${session.boardType === "steel" ? "スティール" : "ソフト"}`);
  out.push(`- セット数: ${session.setCount} (1セット3投)`);
  out.push(`- 総投擲数(予定): ${session.plannedThrowCount}`);
  out.push(`- セッティング: ${equipmentSummary(equipment)}`);
  out.push(`- 利き腕: ${HAND_LABELS[session.dominantHand] ?? session.dominantHand}`);
  if (player?.dominantEye) {
    out.push(`- 利き目: ${EYE_LABELS[player.dominantEye] ?? player.dominantEye}`);
  }
  if (player?.stance) {
    out.push(`- スタンス: ${STANCE_LABELS[player.stance] ?? player.stance}`);
  }
  out.push(`- 入力方式: ${INPUT_LABELS[session.inputMethod] ?? session.inputMethod}`);
  out.push(`- 今日の調子: ${CONDITION_LABELS[session.dailyCondition] ?? session.dailyCondition}${session.dailyConditionNote ? ` (${session.dailyConditionNote})` : ""}`);
  if (player) out.push(`- プレイヤー: ${player.displayName}`);
  out.push("");
  out.push("## 環境情報");
  out.push("");
  const env = session.environment;
  if (
    env &&
    (env.location || env.boardName || env.lighting || env.temperatureC != null || env.ocheNote || env.formChangeNote || env.gripChangeNote || env.stanceChangeNote || env.otherNote)
  ) {
    if (env.location) out.push(`- 練習場所: ${env.location}`);
    if (env.boardName) out.push(`- ボード名称: ${env.boardName}`);
    if (env.lighting) out.push(`- 照明: ${env.lighting}`);
    if (env.temperatureC != null) out.push(`- 室温: ${env.temperatureC}℃`);
    if (env.ocheNote) out.push(`- スローライン環境: ${env.ocheNote}`);
    if (env.formChangeNote) out.push(`- フォーム変更: ${env.formChangeNote}`);
    if (env.gripChangeNote) out.push(`- グリップ変更: ${env.gripChangeNote}`);
    if (env.stanceChangeNote) out.push(`- 立ち位置変更: ${env.stanceChangeNote}`);
    if (env.otherNote) out.push(`- その他: ${env.otherNote}`);
  } else {
    out.push("記録なし");
  }
  out.push("");
  out.push("## 開始前・中間・終了後の自己評価");
  out.push("");
  out.push(assessmentSection(session.assessments));
  out.push("");
  out.push("## アプリ算出の基本統計");
  out.push("");
  out.push(statsSection(stats));
  out.push("## 過去セッションとの比較");
  out.push("");
  out.push(comparisonSection(input));
  out.push("## 全投擲データ");
  out.push("");
  if (input.embedAllThrows) {
    out.push(throwTable(input.throws, input.setNumberOf));
  } else {
    out.push("全投擲データは添付のCSVファイルを参照してください。");
    out.push("");
    out.push("CSVの列: session_id, session_date, training_mode, board_type, set_number, global_throw_number, dart_in_set, dart_color, target_label, target_number, target_ring, landing_number, landing_ring, exact_hit, landing_x, landing_y, error_x, error_y, error_distance, miss_direction, position_precision, previous_throw_was_hit, target_changed, elapsed_ms, session_progress, throw_note");
  }
  out.push("");
  out.push("## セッションメモ");
  out.push("");
  out.push(session.sessionNote ? session.sessionNote : "記録なし");
  out.push("");
  out.push("## データ利用上の注意");
  out.push("");
  out.push("- 座標は外側ダブル外周の半径を1.0とする正規化値です(右が+X、上が+Y、20方向が角度0度で時計回り)。");
  out.push("- 入力精度が「概算」(segment_approximation)の投擲は、実際の着弾座標ではなく選択エリアの代表点(幾何学的中心)を使用しています。ズレ方向・誤差距離は概算値として扱ってください。");
  out.push("- バウンスアウトは着弾位置不明です。");
  out.push("- 自己評価(疲労度・痛み等)は主観的な記録であり、医学的評価ではありません。");
  out.push("- このデータは個人のトレーニング記録です。分析は運動学習の参考情報であり、医学的診断を行わないでください。");
  out.push("");
  return out.join("\n");
}
