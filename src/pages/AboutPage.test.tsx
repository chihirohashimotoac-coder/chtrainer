import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AboutPage from "./AboutPage";
import { VERSION_HISTORY } from "../config/versionHistory";

/**
 * バージョン履歴のサマリには previous_throw_was_hit_in_same_set や fat_bull などの
 * 折り返し位置を持たない長い識別子が含まれる。折り返し指定がないと flex 行の
 * min-width:auto と相まって狭幅画面で横スクロールが発生するため、
 * サマリ要素に overflow-wrap と min-width:0 が設定されていることを保証する。
 */
describe("AboutPage (バージョン履歴の折り返し)", () => {
  it("長い識別子を含むサマリが横はみ出ししないよう折り返し指定を持つ", () => {
    const { container } = render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // 長い英数字トークンを含む代表的なサマリのテキストノードを探す
    const longEntry = VERSION_HISTORY.find((e) =>
      e.summary.includes("previous_throw_was_hit_in_same_set")
    );
    expect(longEntry).toBeDefined();

    const summarySpans = Array.from(
      container.querySelectorAll<HTMLElement>("span.small")
    ).filter((el) => el.textContent === longEntry!.summary);
    expect(summarySpans.length).toBe(1);

    const style = summarySpans[0]!.style;
    // 長いトークンを分割可能にし、flex 収縮を許可する
    expect(style.overflowWrap).toBe("anywhere");
    expect(["0", "0px"]).toContain(style.minWidth);
  });
});
