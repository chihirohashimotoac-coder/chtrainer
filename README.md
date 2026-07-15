# Darts Training Analyzer

ダーツの投擲を記録し、AI分析用の依頼文(Markdown)を生成するトレーニング支援PWAです。

- スマートフォン最優先のUI(PCブラウザでも利用可能)
- 1セット3投で指定ターゲットへ投げ、着弾位置を記録
- 投擲データは**端末内のIndexedDBにのみ保存**(サーバー・外部DBなし)
- 基本統計(命中率・誤差・投順別・ターゲット別・方向別・前半後半)をアプリ側で算出
- 全投擲データと統計を含む**AI分析依頼Markdown**を生成し、コピーまたは`.md`保存
- CSV出力(UTF-8 BOM付き)・JSONバックアップ/復元
- オフライン動作(Service Worker)・ホーム画面追加対応

> **本アプリはAI APIを内蔵していません。** APIキーの入力機能もありません。
> 生成されたMarkdownを、ご自身が利用するChatGPT・Claude・Gemini等へ貼り付けて分析を依頼する設計です。

> **免責**: 本アプリはDARTSLIVE、PHOENIX等の既存ダーツサービスとは一切関係のない、非公式の個人用トレーニングツールです。既存サービスの名称・ロゴ・画像・デザインは使用していません。疲労度・痛み等の自己評価は医学的診断ではありません。

## スクリーン構成

ホーム / 初期設定 / プレイヤー設定 / 使用機材(一覧・編集) / トレーニングモード選択 / ターゲット選択 / セット数設定 / セッション開始前設定 / 投擲中ターゲット表示 / 3投入力(簡易・詳細座標) / 3投確認・修正 / 中間・終了時自己評価 / セッション結果 / 投擲履歴・着弾修正 / 過去セッション一覧 / セッション詳細 / セッション比較 / AI分析データ出力 / バックアップ・復元 / アプリ設定 / アプリ情報

## 使用技術

| 分類 | 技術 |
|---|---|
| フレームワーク | React 18 + TypeScript (strict) + Vite 5 |
| ルーティング | React Router (HashRouter: GitHub Pages対応) |
| 永続化 | IndexedDB ([idb](https://github.com/jakearchibald/idb)) |
| PWA | Web App Manifest + 自前Service Worker (オフラインキャッシュ・更新通知) |
| 描画 | 独自実装のSVGダーツボード |
| テスト | Vitest + React Testing Library + fake-indexeddb |
| CI/CD | GitHub Actions → GitHub Pages |

### 使用ライブラリとライセンス

すべて商用利用可能なライセンスです。

| ライブラリ | ライセンス | 用途 |
|---|---|---|
| react / react-dom | MIT | UI |
| react-router-dom | MIT | ルーティング |
| idb | ISC | IndexedDBラッパー |
| vite, vitest, @vitejs/plugin-react ほか(開発時のみ) | MIT | ビルド・テスト |
| fake-indexeddb(開発時のみ) | Apache-2.0 | テスト |

## ローカル起動

```bash
npm ci
npm run dev        # http://localhost:5173
```

## ビルド

```bash
npm run build      # 型チェック + dist/ へビルド
npm run preview    # ビルド結果の確認
```

## テスト

```bash
npm test           # 単体・コンポーネント・境界値テスト (Vitest)
```

## GitHub Pages への公開

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定する
2. `main` ブランチへプッシュすると `.github/workflows/deploy.yml` が
   ビルド → テスト → GitHub Pages デプロイを自動実行する
3. 公開URLは `https://<ユーザー名>.github.io/<リポジトリ名>/`

Viteの `base` は相対パス(`./`)、ルーティングはHashRouterのため、
**リポジトリ名が変わっても設定変更は不要**です。PWAのmanifest・Service Workerも相対パスで動作します。

## データ保存方式

- すべてのデータは端末内の IndexedDB (`darts-training-analyzer`) に保存されます
- ストア: `settings` / `players` / `equipmentProfiles` / `trainingPlans` / `sessions` / `throwSets` / `throws` / `sessionStatistics` / `appMetadata`
- 投擲はセット確定ごとに即時保存され、ページ再読み込み後も進行中セッションを再開できます
- 全レコードがスキーマバージョン(`schemaVersion`)を持ち、将来のデータ移行に備えています
- **ブラウザデータの削除でデータが消えます。** 定期的なJSONバックアップを推奨します

## バックアップ方法

- **JSONバックアップ(正式なバックアップ形式)**: 設定 → バックアップ・復元 → 「JSONバックアップを保存」。
  復元時は構造検証 → バージョン確認 → 件数表示 → 追加/置き換え選択 → 確認 → 単一トランザクションでインポート(失敗時は既存データを維持)
- **CSV出力**: セッション単位。人間による確認・表計算・AIへの添付・二次バックアップ用(完全復元はJSONのみ)

## データモデル概要

主要な型は `src/types/models.ts` を参照してください。

- `PlayerProfile` — 表示名・利き腕・標準ボード・フライト色(投順識別)・入力方式など
- `EquipmentProfile` — バレル/シャフト/フライト/チップの機材情報
- `TrainingSession` — モード・セット数・出題ターゲット計画・自己評価・環境・進行状態
- `ThrowSet` / `ThrowRecord` — セットと投擲。着弾(`landing`)と派生データ(`derived`: 誤差・ズレ方向・命中など)
- `SessionStatistics` — アプリ算出の基本統計

### 座標系

- ボード中心が原点、右が +X、上が +Y
- **外側ダブル外周の半径 = 1.0** の正規化座標
- 角度は20方向(真上)が0度、時計回りが正、0以上360未満
- 簡易入力の座標はエリア代表点(幾何学的中心)による**概算値**で、
  `positionPrecision = "segment_approximation"` として区別されます

## ボードプロファイル(初期寸法と前提)

寸法は `src/config/boardProfiles.ts` で一元管理しています(コンポーネントに直書きしていません)。
半径はすべて「外側ダブル外周 = 1.0」への正規化値です。

### スティール標準 (`steel_standard`) — WDF/PDC標準寸法(mm)を正規化

| 部位 | 実寸半径(mm) | 正規化 |
|---|---:|---:|
| インナーブル外周 | 6.35 | 0.0374 |
| アウターブル外周 | 15.9 | 0.0935 |
| トリプル内周 | 99 | 0.582 |
| トリプル外周 | 107 | 0.629 |
| ダブル内周 | 162 | 0.953 |
| ダブル外周 | 170 | 1.0 |

### ソフト15.5インチ (`soft_155`) — 一般的な電子ボードの概算値

| 部位 | 実寸半径(mm) | 正規化 |
|---|---:|---:|
| インナーブル外周 | 9 | 0.0459 |
| アウターブル外周 | 21.5 | 0.1097 |
| トリプル内周 | 105 | 0.536 |
| トリプル外周 | 120 | 0.612 |
| ダブル内周 | 180 | 0.918 |
| ダブル外周 | 196 | 1.0 |

ソフトボードは製品によって寸法差があるため**概算値**です。
`BoardProfile` を配列に追加するだけで新しいプロファイルを追加できます。
詳細入力の受付範囲は外側ダブル半径の1.3倍(`inputAreaOuter`)です。

## 外部AIへデータを渡す際の注意

- 生成Markdownにはセッション概要・環境メモ・自己評価・全投擲データが含まれます。
  外部AIサービスへ貼り付ける前に、含めたくない情報(練習場所など)がないか確認してください
- 各AIサービスの利用規約・データ取り扱いポリシーに従ってください
- 分析結果は運動学習の参考情報です。医学的判断には使用しないでください

## サンプルデータ

`samples/` に以下を同梱しています(`npx vite-node scripts/generate-samples.ts` で再生成可能)。

- `sample-backup.json` — インポート可能なJSONバックアップ
- `sample-ai-request.md` — AI分析依頼Markdownの出力例
- `sample-session.csv` — CSV出力例

## 開発メモ

- 画面文言は `src/i18n/ja.ts` に一元管理(将来の多言語化に対応)
- セット数上限などの定数は `src/config/constants.ts` に集約
- 実装の進行記録は `IMPLEMENTATION_STATUS.md` を参照
