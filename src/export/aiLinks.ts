/**
 * 生成した依頼文を各AIサービスへ渡すための半自動リンク。
 * 依頼文は長文になり得るためURLへ全文を載せず、クリップボードへコピーしてから
 * 各サービスの新規チャットを開く方式にする(貼り付けるだけで使える)。
 */
export interface AiProvider {
  id: string;
  name: string;
  /** 新規チャットを開くURL。 */
  url: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "claude", name: "Claude", url: "https://claude.ai/new" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app" },
];
