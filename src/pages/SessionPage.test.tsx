import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SessionPage from "./SessionPage";
import { AppProvider } from "../state/AppContext";
import {
  getThrows,
  saveAppSettings,
  savePlayer,
  saveSession,
} from "../db/db";
import { fixtureSession } from "../test/fixtures";
import { SCHEMA_VERSION, type PlayerProfile } from "../types/models";
import { newId } from "../utils/id";

const player: PlayerProfile = {
  schemaVersion: SCHEMA_VERSION,
  id: "player-1",
  displayName: "テスト",
  dominantHand: "right",
  defaultBoardType: "steel",
  dartColors: ["#e05252", "#4f7fe0", "#f0f0f0"],
  defaultInputMethod: "simple",
  vibrationEnabled: false,
  soundEnabled: false,
  autoAdvanceEnabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderSession() {
  return render(
    <MemoryRouter initialEntries={["/train/session"]}>
      <AppProvider>
        <Routes>
          <Route path="/train/session" element={<SessionPage />} />
          <Route path="/session/:id/result" element={<div>結果画面</div>} />
          <Route path="/" element={<div>ホーム画面</div>} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  );
}

/** 簡易入力でT20を1本入力する */
async function inputT20(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "トリプル" }));
  await user.click(screen.getByRole("button", { name: "20" }));
  await user.click(screen.getByRole("button", { name: "確認" }));
}

/** 簡易入力でシングル5を1本入力する */
async function inputS5(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "シングル" }));
  await user.click(screen.getByRole("button", { name: "5" }));
  await user.click(screen.getByRole("button", { name: "確認" }));
}

describe("SessionPage (3投入力フロー)", () => {
  let sessionId: string;

  beforeEach(async () => {
    sessionId = newId();
    await savePlayer(player);
    await saveAppSettings({
      onboardingCompleted: true,
      activePlayerId: player.id,
    });
    // 各テストで最新のstartedAtを持たせ、getActiveSessionが
    // このテストのセッションを一意に選択できるようにする
    await saveSession(
      fixtureSession({
        id: sessionId,
        status: "active",
        inputMethod: "simple",
        startedAt: new Date().toISOString(),
        progress: { currentSetNumber: 1, middleAssessmentDone: false },
        assessments: [],
        endedAt: undefined,
      })
    );
  });

  it("ターゲットを大きく表示し、3投入力→確認→修正→入れ替え→保存できる", async () => {
    const user = userEvent.setup();
    renderSession();

    // ターゲット表示 (セット1)
    expect(await screen.findByText("T20")).toBeInTheDocument();
    expect(screen.getByText(/セット/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3投の結果を入力" }));

    // 1投目
    expect(await screen.findByText("1投目")).toBeInTheDocument();
    await inputT20(user);
    // 2投目
    expect(await screen.findByText("2投目")).toBeInTheDocument();
    await inputS5(user);
    // 3投目
    expect(await screen.findByText("3投目")).toBeInTheDocument();
    await inputT20(user);

    // 確認画面
    expect(await screen.findByText("セット内容の確認")).toBeInTheDocument();
    expect(screen.getAllByText("T20").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("S5")).toBeInTheDocument();

    // 2投目を修正 (S5 → T20)
    await user.click(screen.getByRole("button", { name: "2投目を修正" }));
    await inputT20(user);
    expect(await screen.findByText("セット内容の確認")).toBeInTheDocument();
    expect(screen.queryByText("S5")).not.toBeInTheDocument();

    // 保存して次のセットへ (セット1完了 → setCount=2 の中間評価)
    await user.click(screen.getByRole("button", { name: "次のセットへ" }));
    expect(await screen.findByText("中間の自己評価")).toBeInTheDocument();

    // DBに3投保存されている
    const throws = await getThrows(sessionId);
    expect(throws).toHaveLength(3);
    expect(throws.every((x) => x.derived.exactHit)).toBe(true);
    expect(throws[0]?.dartColor).toBe("#e05252");
  });

  it("矢速を任意入力でき、入力した投擲だけに保存される", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(
      await screen.findByRole("button", { name: "3投の結果を入力" })
    );
    // 1投目: 着弾入力画面の矢速欄へ入力してから確定
    await user.click(await screen.findByRole("button", { name: "トリプル" }));
    await user.click(screen.getByRole("button", { name: "20" }));
    await user.type(screen.getByLabelText("矢速(km/h・任意)"), "64.2");
    await user.click(screen.getByRole("button", { name: "確認" }));
    // 2投目・3投目: 矢速なし
    await inputT20(user);
    await inputT20(user);
    // 確認画面: 1投目の値が引き継がれ、3投目を後から入力できる
    expect(await screen.findByText("セット内容の確認")).toBeInTheDocument();
    const speedInputs = screen.getAllByLabelText("矢速(km/h・任意)");
    expect((speedInputs[0] as HTMLInputElement).value).toBe("64.2");
    await user.type(speedInputs[2] as HTMLElement, "58.9");
    await user.click(screen.getByRole("button", { name: "次のセットへ" }));
    expect(await screen.findByText("中間の自己評価")).toBeInTheDocument();

    const throws = await getThrows(sessionId);
    expect(throws[0]?.speedKmh).toBe(64.2);
    expect(throws[1]?.speedKmh).toBeUndefined();
    expect(throws[2]?.speedKmh).toBe(58.9);
  });

  it("Undoで戻ると入力済みの矢速もクリアされる", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(
      await screen.findByRole("button", { name: "3投の結果を入力" })
    );
    // 1投目: 矢速付きで確定した後、Undoで戻って矢速なしで再入力
    await user.click(await screen.findByRole("button", { name: "トリプル" }));
    await user.click(screen.getByRole("button", { name: "20" }));
    await user.type(screen.getByLabelText("矢速(km/h・任意)"), "64.2");
    await user.click(screen.getByRole("button", { name: "確認" }));
    expect(await screen.findByText("2投目")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取り消す" }));
    expect(await screen.findByText("1投目")).toBeInTheDocument();
    await inputT20(user);
    await inputT20(user);
    await inputT20(user);
    expect(await screen.findByText("セット内容の確認")).toBeInTheDocument();
    const speedInputs = screen.getAllByLabelText("矢速(km/h・任意)");
    expect((speedInputs[0] as HTMLInputElement).value).toBe("");
    await user.click(screen.getByRole("button", { name: "次のセットへ" }));
    expect(await screen.findByText("中間の自己評価")).toBeInTheDocument();
    const throws = await getThrows(sessionId);
    expect(throws[0]?.speedKmh).toBeUndefined();
  });

  it("Undoで前の投擲へ戻れる", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(
      await screen.findByRole("button", { name: "3投の結果を入力" })
    );
    await inputT20(user);
    expect(await screen.findByText("2投目")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取り消す" }));
    expect(await screen.findByText("1投目")).toBeInTheDocument();
  });

  it("投順の入れ替えができる", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(
      await screen.findByRole("button", { name: "3投の結果を入力" })
    );
    await inputS5(user); // 1投目 S5
    await inputT20(user); // 2投目 T20
    await inputT20(user); // 3投目 T20
    expect(await screen.findByText("セット内容の確認")).toBeInTheDocument();

    const swapButtons = screen.getAllByRole("button", {
      name: "投擲順の入れ替え",
    });
    await user.click(swapButtons[0] as HTMLElement);
    await user.click(swapButtons[1] as HTMLElement);

    // 1投目がT20、2投目がS5になっている
    const cards = screen.getAllByText(/^(S5|T20)$/);
    expect(cards[0]?.textContent).toBe("T20");
  });

  it("中間自己評価は予定セットの50%完了直後に表示され、提出後に次セットへ進む", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(
      await screen.findByRole("button", { name: "3投の結果を入力" })
    );
    await inputT20(user);
    await inputT20(user);
    await inputT20(user);
    await user.click(
      await screen.findByRole("button", { name: "次のセットへ" })
    );
    // setCount=2 → ceil(2/2)=1セット終了後に中間評価
    expect(await screen.findByText("中間の自己評価")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "次へ" }));
    // セット2のターゲット表示へ
    expect(await screen.findByText("T20")).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
  });
});
