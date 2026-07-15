/** Service Worker の登録とアプリ更新通知 */

type UpdateListener = (apply: () => void) => void;

let updateListener: UpdateListener | undefined;

export function onUpdateAvailable(listener: UpdateListener): void {
  updateListener = listener;
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // 新バージョンが待機中
              updateListener?.(() => {
                installing.postMessage({ type: "SKIP_WAITING" });
              });
            }
          });
        });
      })
      .catch(() => {
        // 登録失敗時もアプリ本体は動作させる
      });

    let refreshed = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });
  });
}
