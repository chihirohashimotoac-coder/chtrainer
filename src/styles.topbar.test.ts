// @ts-expect-error The browser app intentionally excludes Node types; Vitest runs in Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

/**
 * 履歴画面のヘッダー崩れに対する回帰テスト。
 *
 * 1) .top-bar の h1 見出しは white-space:nowrap で、狭幅でも日本語見出しが
 *    1文字ずつ縦に折り返さない(「過去セッション」の縦書きを防ぐ)。
 * 2) 見出し下のアクション列 .top-actions は、各ボタンを均等幅(flex:1 1 0)で
 *    分け合い、狭幅(スマホ)でも縦積み・2段にならず横1列に収まる。
 */
function block(source: string, selector: string): string {
  const start = source.indexOf(selector + " {");
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe("履歴ヘッダーのレイアウト(スマホで崩れない)", () => {
  it(".top-bar h1 は white-space: nowrap を持つ(見出しが縦書きにならない)", () => {
    expect(block(css, ".top-bar h1")).toMatch(/white-space:\s*nowrap/);
  });

  it(".top-actions > .btn は均等幅(flex:1 1 0)で1列に並ぶ", () => {
    const rule = block(css, ".top-actions > .btn");
    expect(rule).toMatch(/flex:\s*1\s+1\s+0/);
    expect(rule).toMatch(/min-width:\s*0/);
  });

  it(".top-actions は縦積みにする flex-direction:column を持たない", () => {
    expect(block(css, ".top-actions")).not.toMatch(/flex-direction:\s*column/);
  });
});
