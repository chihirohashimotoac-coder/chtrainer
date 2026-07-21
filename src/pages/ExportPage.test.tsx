import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExportPage from "./ExportPage";
import { saveSession, saveThrows } from "../db/db";
import { fixtureSession, handComputedThrows } from "../test/fixtures";

describe("ExportPage (AI出力設定)", () => {
  beforeEach(async () => {
    await saveSession(fixtureSession());
    await saveThrows(handComputedThrows());
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/session/session-1/export"]}>
        <Routes>
          <Route path="/session/:id/export" element={<ExportPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("全データ埋め込みが標準で、AIへ渡すテキストを生成できる", async () => {
    const user = userEvent.setup();
    renderPage();
    const embedButton = await screen.findByRole("button", {
      name: /全データ埋め込み/,
    });
    expect(embedButton).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "AIへ渡すテキストを生成" }));
    const preview = await screen.findByText(/# ダーツ投擲データ分析依頼/);
    expect(preview).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "AIへ渡すテキストをコピー" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ".mdファイルを保存" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSVを保存" })).toBeInTheDocument();
  });

  it("Markdown全文が1回のコピー操作でクリップボードへ渡される", async () => {
    const user = userEvent.setup();
    // userEvent.setup() がクリップボードを差し替えるため、その後に上書きする
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "AIへ渡すテキストを生成" })
    );
    await screen.findByText(/# ダーツ投擲データ分析依頼/);
    await user.click(screen.getByRole("button", { name: "AIへ渡すテキストをコピー" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]?.[0] as string;
    // 先頭から末尾まで全文が1回で渡されている
    expect(copied.startsWith("# ダーツ投擲データ分析依頼")).toBe(true);
    expect(copied).toContain("## AIへの分析指示");
    expect(copied).toContain("## 全投擲データ");
    expect(copied).toContain("## データ利用上の注意");
    expect((await screen.findAllByText("コピーしました")).length).toBeGreaterThan(0);
  });

  it("生成前の文字数表示は実際の生成結果と一致する(両形式)", async () => {
    const user = userEvent.setup();
    renderPage();
    // 全データ埋め込み形式: 生成前表示を読む
    await screen.findByRole("button", { name: /全データ埋め込み/ });
    const before = screen.getByText(/この形式で生成されるテキスト/).textContent!;
    const predicted = Number(
      /この形式で生成されるテキスト: ([\d,]+)文字/.exec(before)![1]!.replace(/,/g, "")
    );
    await user.click(screen.getByRole("button", { name: "AIへ渡すテキストを生成" }));
    await screen.findByText(/# ダーツ投擲データ分析依頼/);
    const actualText = screen
      .getAllByText(/文字 \/ 概算トークン数/)
      .map((el) => el.textContent!)
      .find((text) => !text.includes("この形式"))!;
    const actual = Number(/([\d,]+)文字/.exec(actualText)![1]!.replace(/,/g, ""));
    // 実生成と同一ロジックのため一致する(±5%どころか完全一致)
    expect(predicted).toBe(actual);

    // 集計+CSV別添形式へ切り替えると予測が即時更新される
    await user.click(screen.getByRole("button", { name: /集計\+CSV別添/ }));
    const summaryBefore = screen.getByText(/この形式で生成されるテキスト/).textContent!;
    const summaryPredicted = Number(
      /この形式で生成されるテキスト: ([\d,]+)文字/.exec(summaryBefore)![1]!.replace(/,/g, "")
    );
    expect(summaryPredicted).toBeLessThan(predicted);
    await user.click(screen.getByRole("button", { name: "AIへ渡すテキストを生成" }));
    await screen.findByText(/CSVファイルを参照/);
    const summaryActualText = screen
      .getAllByText(/文字 \/ 概算トークン数/)
      .map((el) => el.textContent!)
      .find((text) => !text.includes("この形式"))!;
    const summaryActual = Number(
      /([\d,]+)文字/.exec(summaryActualText)![1]!.replace(/,/g, "")
    );
    expect(summaryPredicted).toBe(summaryActual);
  });

  it("集計+CSV別添方式へ切り替えられる", async () => {
    const user = userEvent.setup();
    renderPage();
    const summaryButton = await screen.findByRole("button", {
      name: /集計\+CSV別添/,
    });
    await user.click(summaryButton);
    expect(summaryButton).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "AIへ渡すテキストを生成" }));
    const preview = await screen.findByText(/CSVファイルを参照/);
    expect(preview).toBeInTheDocument();
  });
});
