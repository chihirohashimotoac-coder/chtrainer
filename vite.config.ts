/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages ではリポジトリ名がパスに含まれるため、相対パス base を使う。
// HashRouter と組み合わせることで、リポジトリ名が変わっても設定変更は不要。
export default defineConfig({
  base: "./",
  plugins: [react()],
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
