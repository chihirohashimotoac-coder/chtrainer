/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error ブラウザ向けアプリは Node 型を意図的に除外している(Vite はビルド時に Node で動く)。
import { readFileSync, writeFileSync } from "node:fs";

// package.json の version を Service Worker のキャッシュ名へ埋め込む。
// public/sw.js の "__APP_VERSION__" をビルド出力(dist/sw.js)で実バージョンへ置換し、
// リリースごとに sw.js の内容を変えて更新検知(updatefound)を確実に発火させる。
function injectServiceWorkerVersion(): Plugin {
  const version = (
    JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
  ).version;
  return {
    name: "inject-sw-version",
    apply: "build",
    closeBundle() {
      const swPath = "dist/sw.js";
      try {
        const src = readFileSync(swPath, "utf8") as string;
        if (src.includes("__APP_VERSION__")) {
          writeFileSync(swPath, src.replaceAll("__APP_VERSION__", version));
        }
      } catch {
        // dist/sw.js が存在しない構成では何もしない
      }
    },
  };
}

// GitHub Pages ではリポジトリ名がパスに含まれるため、相対パス base を使う。
// HashRouter と組み合わせることで、リポジトリ名が変わっても設定変更は不要。
export default defineConfig({
  base: "./",
  plugins: [react(), injectServiceWorkerVersion()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // CI等の低速環境での userEvent 待ちフレークを避ける
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
