import type {
  EquipmentProfile,
  PlayerProfile,
  SessionStatistics,
  TrainingSession,
} from "../types/models";
import { modeLabel } from "./markdown";
import { fmtDateTime, fmtNum, fmtRate } from "../utils/format";
import { APP_NAME } from "../config/constants";

export interface SummaryCardInput {
  session: TrainingSession;
  stats: SessionStatistics;
  player?: PlayerProfile;
  equipment?: EquipmentProfile;
}

interface Tile {
  label: string;
  value: string;
}

/** モード固有の見どころ指標を1つ返す(あれば)。 */
function modeHighlight(stats: SessionStatistics): Tile | null {
  if (stats.cricket && stats.cricket.marksPerThreeDarts != null) {
    return { label: "MPR (3投マーク)", value: fmtNum(stats.cricket.marksPerThreeDarts, 2) };
  }
  if (stats.zeroOne && stats.zeroOne.bullThrowCount > 0 && stats.zeroOne.bullHitRate != null) {
    return { label: "Bull命中率", value: fmtRate(stats.zeroOne.bullHitRate) };
  }
  if (stats.grouping && stats.grouping.validSetCount > 0 && stats.grouping.averageDiameter != null) {
    return { label: "平均グルーピング径", value: fmtNum(stats.grouping.averageDiameter, 3) };
  }
  return null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * セッション要約を共有用のPNG(1080×1350)として描画し、Blobを返す。
 * 外部ライブラリを使わずCanvasで描くためオフラインでも動作する。
 */
export async function buildSummaryCardBlob(
  input: SummaryCardInput
): Promise<Blob | null> {
  const { session, stats, equipment } = input;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const INK = "#f4f7f9";
  const DIM = "#9fb3bf";
  const ACCENT = "#e4ad50";
  const CARD = "#122a39";
  const BORDER = "#274a5d";
  const font = (size: number, weight = "400") =>
    `${weight} ${size}px "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif`;

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0e2534");
  bg.addColorStop(1, "#07141f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const M = 72;

  // ヘッダ
  ctx.fillStyle = ACCENT;
  ctx.font = font(30, "700");
  ctx.textBaseline = "alphabetic";
  ctx.fillText("PERFORMANCE REPORT", M, 120);
  ctx.fillStyle = INK;
  ctx.font = font(52, "800");
  ctx.fillText(APP_NAME, M, 182);

  ctx.fillStyle = DIM;
  ctx.font = font(30, "400");
  const boardLabel = session.boardType === "steel" ? "スティール" : "ソフト";
  ctx.fillText(
    `${modeLabel(session.trainingMode)} ・ ${boardLabel}${equipment ? " ・ " + equipment.name : ""}`,
    M,
    236
  );
  ctx.fillText(fmtDateTime(session.startedAt), M, 280);

  // ヒーロー: 命中率
  const heroY = 330;
  const heroH = 300;
  roundRect(ctx, M, heroY, W - M * 2, heroH, 28);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();

  const scorable = stats.scorableThrows ?? stats.completedThrows;
  ctx.textAlign = "center";
  ctx.fillStyle = DIM;
  ctx.font = font(34, "700");
  ctx.fillText("完全命中率", W / 2, heroY + 74);
  ctx.fillStyle = ACCENT;
  ctx.font = font(150, "800");
  ctx.fillText(scorable > 0 ? fmtRate(stats.exactHitRate) : "N/A", W / 2, heroY + 210);
  ctx.fillStyle = DIM;
  ctx.font = font(30, "400");
  ctx.fillText(
    scorable > 0 ? `${stats.exactHits} / ${scorable} 投(命中判定対象)` : "命中判定対象なし",
    W / 2,
    heroY + 262
  );
  ctx.textAlign = "left";

  // KPIタイル
  const tiles: Tile[] = [
    { label: "総投擲数", value: String(stats.completedThrows) },
    {
      label: "平均誤差距離",
      value: fmtNum(
        stats.coordinateError?.averageErrorDistance ??
          stats.combinedError?.averageErrorDistance,
        3
      ),
    },
    { label: "アウトボード率", value: fmtRate(stats.outboardRate) },
  ];
  const highlight = modeHighlight(stats);
  if (highlight) tiles.push(highlight);

  const cols = 2;
  const gap = 28;
  const gridY = heroY + heroH + 40;
  const tileW = (W - M * 2 - gap * (cols - 1)) / cols;
  const tileH = 190;
  tiles.slice(0, 4).forEach((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * (tileW + gap);
    const y = gridY + row * (tileH + gap);
    roundRect(ctx, x, y, tileW, tileH, 22);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = DIM;
    ctx.font = font(28, "700");
    ctx.fillText(tile.label, x + 34, y + 62);
    ctx.fillStyle = INK;
    ctx.font = font(66, "800");
    ctx.fillText(tile.value, x + 34, y + 140);
  });

  // フッタ
  ctx.fillStyle = DIM;
  ctx.font = font(26, "400");
  ctx.fillText("CH Darts Training Analyzer で記録", M, H - 60);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, H - 96);
  ctx.lineTo(W - M, H - 96);
  ctx.stroke();

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
}
