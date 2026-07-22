// @ts-expect-error The browser app intentionally excludes Node types; Vitest runs in Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

/**
 * 履歴画面などの .top-bar は h1 見出しと複数のボタンを横並びにする。
 * 折り返し指定がないと、狭幅(スマホ)でボタンに圧迫された h1(flex:1)が
 * 日本語見出しを1文字ずつ縦に折り返し、「過去セッション」が縦書きになる。
 * 回帰防止として、CSS が以下を満たすことを保証する:
 *   - .top-bar が flex-wrap: wrap(収まらないボタンは次の行へ送る)
 *   - .top-bar h1 が white-space: nowrap(見出しは横書きのまま保つ)
 */
function block(source: string, selector: string): string {
  const start = source.indexOf(selector + " {");
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe(".top-bar の折り返し(スマホでタイトルが縦書きにならない)", () => {
  it(".top-bar は flex-wrap: wrap を持つ", () => {
    expect(block(css, ".top-bar")).toMatch(/flex-wrap:\s*wrap/);
  });

  it(".top-bar h1 は white-space: nowrap を持つ", () => {
    expect(block(css, ".top-bar h1")).toMatch(/white-space:\s*nowrap/);
  });
});
