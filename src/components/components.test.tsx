import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SimpleInput } from "./SimpleInput";
import { AssessmentForm } from "./AssessmentForm";
import { StatsView } from "./StatsView";
import { Scale11 } from "./Scale11";
import { PlayerForm } from "./PlayerForm";
import SetCountPage from "../pages/SetCountPage";
import { SetupProvider } from "../state/SetupContext";
import { STEEL_BOARD } from "../config/boardProfiles";
import { calculateStatistics } from "../domain/stats";
import { handComputedThrows } from "../test/fixtures";

describe("SimpleInput (簡易入力)", () => {
  it("トリプル+20でT20の概算着弾を返す", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<SimpleInput profile={STEEL_BOARD} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "トリプル" }));
    await user.click(screen.getByRole("button", { name: "20" }));
    await user.click(screen.getByRole("button", { name: "確認" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const landing = onConfirm.mock.calls[0]?.[0];
    expect(landing.ring).toBe("triple");
    expect(landing.number).toBe(20);
    expect(landing.positionPrecision).toBe("segment_approximation");
    expect(landing.x).toBeCloseTo(0);
    expect(landing.y).toBeGreaterThan(0);
  });

  it("ナンバー未選択では確定できない", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<SimpleInput profile={STEEL_BOARD} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "ダブル" }));
    expect(screen.getByRole("button", { name: "確認" })).toBeDisabled();
  });

  it("インナーブルは即確定できる", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<SimpleInput profile={STEEL_BOARD} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "インナーブル" }));
    await user.click(screen.getByRole("button", { name: "確認" }));
    expect(onConfirm.mock.calls[0]?.[0].ring).toBe("inner_bull");
  });

  it("アウトボードは方向を選択して確定する", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<SimpleInput profile={STEEL_BOARD} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "アウトボード" }));
    await user.click(screen.getByRole("button", { name: "左上" }));
    const landing = onConfirm.mock.calls[0]?.[0];
    expect(landing.ring).toBe("outboard");
    expect(landing.outboardDirection).toBe("up_left");
    expect(landing.positionPrecision).toBe("direction_only");
    expect(landing.x).toBeUndefined();
  });

  it("バウンスアウトは位置不明として記録できる", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<SimpleInput profile={STEEL_BOARD} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "バウンスアウト" }));
    await user.click(
      screen.getByRole("button", { name: "位置不明のまま記録" })
    );
    const landing = onConfirm.mock.calls[0]?.[0];
    expect(landing.ring).toBe("bounce_out");
    expect(landing.positionPrecision).toBe("unknown");
  });
});

describe("Scale11", () => {
  it("0〜10の11段階を選択できる", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Scale11 label="疲労度" value={5} onChange={onChange} />);
    expect(screen.getAllByRole("radio")).toHaveLength(11);
    await user.click(screen.getByRole("radio", { name: "0" }));
    expect(onChange).toHaveBeenCalledWith(0);
    await user.click(screen.getByRole("radio", { name: "10" }));
    expect(onChange).toHaveBeenCalledWith(10);
  });
});

describe("AssessmentForm (中間自己評価)", () => {
  it("中間評価では調子の変化を選べる", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AssessmentForm timing="middle" onSubmit={onSubmit} />);
    expect(screen.getByText("現在の調子")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "開始時より悪くなった" })
    );
    await user.click(screen.getByRole("button", { name: "次へ" }));
    const assessment = onSubmit.mock.calls[0]?.[0];
    expect(assessment.timing).toBe("middle");
    expect(assessment.conditionChange).toBe("worse");
    expect(assessment.fatigue).toBe(5);
    expect(assessment.pain).toBe(0);
  });

  it("開始前評価では調子の変化を表示しない", () => {
    render(<AssessmentForm timing="before" onSubmit={vi.fn()} />);
    expect(screen.queryByText("現在の調子")).not.toBeInTheDocument();
  });

  it("痛みの免責事項を表示する", () => {
    render(<AssessmentForm timing="before" onSubmit={vi.fn()} />);
    expect(screen.getByText(/医学的評価ではありません/)).toBeInTheDocument();
  });

  it("開始前・中間・終了時共通の投擲プロセス指標を任意保存できる", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AssessmentForm timing="after" onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "メンタル評価(任意)" }));
    await user.selectOptions(screen.getByRole("combobox", { name: /止まらず投げられた割合/ }), "70");
    await user.selectOptions(screen.getByRole("combobox", { name: /リリースが止まる主なタイミング/ }), "before_release");
    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      timing: "after",
      uninterruptedThrowRate: 70,
      releaseStopTiming: "before_release",
    });
  });
});

describe("PlayerForm (アクセシブルな任意フォーム情報)", () => {
  it("4つのselectをラベル名から取得できる", async () => {
    const user = userEvent.setup();
    render(<PlayerForm onSave={vi.fn()} />);
    await user.click(screen.getByText(/フォーム情報/));
    expect(screen.getByRole("combobox", { name: "グリップ本数" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "グリップ位置" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "テイクバック" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "投擲テンポ" })).toBeInTheDocument();
  });
});

describe("StatsView (セッション結果)", () => {
  it("統計値を表示する", () => {
    const stats = calculateStatistics("session-1", 6, handComputedThrows());
    render(<StatsView stats={stats} />);
    expect(screen.getByText("完全命中率")).toBeInTheDocument();
    expect(screen.getAllByText("16.7%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.150").length).toBeGreaterThan(0);
    expect(screen.getAllByText("命中判定対象").length).toBeGreaterThan(0);
  });
});

describe("SetCountPage (トレーニング設定)", () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <SetupProvider>
          <SetCountPage />
        </SetupProvider>
      </MemoryRouter>
    );

  it("プリセットで総投擲数が更新される", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /40セット/ }));
    expect(screen.getByText("120投")).toBeInTheDocument();
  });

  it("不正なセット数はエラーを表示し進めない", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "5");
    expect(screen.getByText(/20〜333の範囲/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
  });

  it("333セットは受け付ける", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "333");
    expect(screen.queryByText(/20〜333の範囲/)).not.toBeInTheDocument();
    expect(screen.getByText("999投")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次へ" })).toBeEnabled();
  });
});
