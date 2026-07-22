import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { registerServiceWorker } from "./pwa/register";
import { applyTheme, getStoredTheme } from "./theme/theme";

// 保存済みテーマを描画前に適用する(index.htmlのインラインスクリプトと二重で担保)。
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

registerServiceWorker();
