import { beforeEach, describe, expect, it } from "vitest";
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

  it("全データ埋め込みが標準で、Markdownを生成できる", async () => {
    const user = userEvent.setup();
    renderPage();
    const embedButton = await screen.findByRole("button", {
      name: /全データ埋め込み/,
    });
    expect(embedButton).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Markdownを生成" }));
    const preview = await screen.findByText(/# ダーツ投擲データ分析依頼/);
    expect(preview).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Markdownをコピー" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ".mdファイルを保存" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSVを保存" })).toBeInTheDocument();
  });

  it("集計+CSV別添方式へ切り替えられる", async () => {
    const user = userEvent.setup();
    renderPage();
    const summaryButton = await screen.findByRole("button", {
      name: /集計\+CSV別添/,
    });
    await user.click(summaryButton);
    expect(summaryButton).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Markdownを生成" }));
    const preview = await screen.findByText(/CSVファイルを参照/);
    expect(preview).toBeInTheDocument();
  });
});
