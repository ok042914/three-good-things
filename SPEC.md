# Three Good Things AI Companion — 仕様書

## 概要

日中にAIと会話しながらその日の出来事を5W1Hで記録し、
夜にGemini AIが「今日の3つのよかったこと」として各項目5〜10行の濃い日記形式で要約するアプリ。  
iPhoneブラウザで動作し、出力結果を手動でiPhone「ジャーナル」アプリへコピーする用途を想定。

---

## ユーザーフロー

```
[日中]
  ① 出来事のタネを一言入力（例:「上司に褒められた」）
         ↓
  ② AIが5W1Hを問いかけ（2〜4往復の会話）
         ↓
  ③ 十分な情報が集まったら「記録する」ボタン
         ↓
  ④ 1件のエピソードとしてSupabaseに保存（会話ログ込み）

  ← この ①〜④ を複数回繰り返す →

[夜]
  「今日をまとめる」ボタンをタップ
         ↓
  Gemini APIが全エピソードを分析
         ↓
  「3つのよかったこと」を各項目5〜10行の日記形式で出力
         ↓
  コピーボタン → iPhoneジャーナルに貼り付け
```

---

## 画面構成（4画面）

### 1. ログイン画面 `/login`
- メールアドレス + パスワード入力
- Supabase Auth（メール認証）

### 2. ホーム画面 `/`
- **本日のエピソード一覧**（記録済みカード形式）
- **「新しい出来事を記録」ボタン** → チャット画面へ遷移
- 「今日をまとめる」ボタン（エピソードが1件以上で有効） → AI要約画面へ
- 日付ヘッダー（例: 2026年6月20日）

### 3. チャット画面 `/chat`（日中の記録）

#### 目的
一言メモをもとにAIが5W1Hを掘り下げ、後から読んでも状況が伝わるエピソードにする。

#### 流れ
1. ユーザーが出来事を一言入力
2. AIが以下の観点から順番に質問（1つずつ、会話の流れで自然に）
   - **When/Where**: いつ・どこで起きたか
   - **Who**: 誰が関わっていたか
   - **What/How**: 具体的に何があったか、どう感じたか
   - **Why**: なぜそれがよかったと思うか、どんな意味があるか
3. 2〜4往復程度で「記録する」ボタンが現れる（AIが「これで記録しますか？」と促す）
4. 保存後はホーム画面に戻り、エピソードカードが追加される

#### AIの会話スタイル
- 共感 + 掘り下げ（「それはいいですね！もう少し聞かせてください」系）
- 一度に複数質問しない（1ターン1質問）
- 3往復経過後は自然にまとめに誘導

### 4. AI要約画面 `/summary`

#### 出力形式（各項目5〜10行）
```
【今日の3つのよかったこと】
2026年6月20日

━━━━━━━━━━━━━━━━
① タイトル（出来事を一言で）
━━━━━━━━━━━━━━━━
（5〜10行の日記文。その場の状況・感情・背景・なぜよかったかを
 自分が書いた日記と同等かそれ以上の具体性で記述する。
 体言止めでなく、「〜だった」「〜と感じた」等の語り口で）

━━━━━━━━━━━━━━━━
② タイトル
━━━━━━━━━━━━━━━━
（同上）

━━━━━━━━━━━━━━━━
③ タイトル
━━━━━━━━━━━━━━━━
（同上）

✨ 今日の一言
（全体を振り返った励ましや気づき、30〜50字）
```

#### 機能
- Gemini APIへのリクエスト中はローディング表示
- 全文をコピーするボタン
- 「保存する」ボタン → journalsテーブルに保存
- 「やり直す」ボタン → 再生成

### 5. 履歴画面 `/history`
- 過去のAI要約一覧（日付順、カード型UI）
- タップで全文展開

---

## 技術スタック

| 役割 | 技術 |
|------|------|
| ホスティング | Vercel |
| フロントエンド | Next.js（App Router） + TypeScript |
| スタイル | Tailwind CSS |
| バックエンド | Vercel Serverless Functions（API Routes） |
| データベース | Supabase（PostgreSQL） |
| 認証 | Supabase Auth（メール＋パスワード） |
| AI（チャット＋要約） | Google Gemini API（`gemini-1.5-flash`、無料枠） |
| バージョン管理 | GitHub |

---

## データベース設計（Supabase）

### テーブル: `episodes`（日中の記録）
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES auth.users NOT NULL
date          date NOT NULL                        -- 記録した日付
seed_text     text NOT NULL                        -- 最初の一言メモ
chat_log      jsonb NOT NULL                       -- 会話ログ全体
summary_text  text                                 -- AI生成のエピソードまとめ（保存時に生成）
created_at    timestamptz DEFAULT now()
```
- RLS: `user_id = auth.uid()` のみ読み書き可

### テーブル: `journals`（夜の要約）
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES auth.users NOT NULL
date        date NOT NULL
summary     text NOT NULL                          -- AI生成テキスト（3つのよかったこと）
created_at  timestamptz DEFAULT now()
UNIQUE(user_id, date)
```
- RLS: 同上

---

## Gemini API 設計

### エンドポイント①: チャット（日中の深掘り）
`POST /api/chat`

リクエスト:
```json
{
  "history": [{"role": "user"|"model", "parts": "string"}, ...],
  "message": "string"
}
```

サーバー側プロンプト（system instruction）:
```
あなたはやさしいジャーナリングコーチです。
ユーザーが話す今日のよかったことを、後から読み返しても
状況が伝わるよう5W1H（いつ・どこで・誰が・何を・なぜ・どのように）
の観点で自然な会話で掘り下げてください。

ルール:
- 1ターンで質問は1つだけ
- 共感を示してから質問する
- 3往復以上経ちかつ十分な情報が集まったら「これで記録しますか？」と促す
- 日本語のみで返答する
```

レスポンス:
```json
{
  "reply": "string",
  "readyToSave": true | false
}
```

---

### エンドポイント②: エピソード保存時のまとめ生成
`POST /api/episode-summary`

リクエスト:
```json
{
  "chatLog": [{"role": "user"|"model", "parts": "string"}, ...]
}
```

プロンプト:
```
以下の会話ログは、ユーザーが今日の出来事についてコーチと話したものです。
この会話から、後から読み返せる日記文（3〜5行）を日本語で書いてください。
体言止めでなく「〜だった」「〜と感じた」形式で、具体的に書くこと。
```

レスポンス:
```json
{
  "summaryText": "string"
}
```

---

### エンドポイント③: 夜の要約（3つのよかったこと）
`POST /api/summarize`

リクエスト:
```json
{
  "episodes": [
    {"seedText": "string", "summaryText": "string"},
    ...
  ],
  "date": "2026-06-20"
}
```

プロンプト:
```
あなたはポジティブ心理学を活用したジャーナリングコーチです。
ユーザーが今日記録したエピソードから、最もよかった3つを選び、
それぞれ5〜10行の日記文として書いてください。

条件:
- 体言止めでなく「〜だった」「〜と感じた」語り口
- 5W1H（いつ・どこで・誰が・何を・なぜ・どのように）が含まれること
- 自分で書いた日記と同等かそれ以上の具体性と感情の深さ
- 出力は以下のフォーマットに従う

出力フォーマット:
【今日の3つのよかったこと】
{date}

━━━━━━━━━━━━━━━━
① {タイトル}
━━━━━━━━━━━━━━━━
{5〜10行の日記文}

━━━━━━━━━━━━━━━━
② {タイトル}
━━━━━━━━━━━━━━━━
{5〜10行の日記文}

━━━━━━━━━━━━━━━━
③ {タイトル}
━━━━━━━━━━━━━━━━
{5〜10行の日記文}

✨ {今日の一言: 30〜50字}
```

---

## UI指針

- カラー: `#FF6B6B`（メインカラー、CSS変数 `--main`）
- フォント: `Noto Sans JP`（Google Fonts）
- ボタン最小高さ: 44px（タッチ操作対応）
- カード: `border-radius: 16px` + `box-shadow`
- チャット画面: LINEライクな吹き出しUI（右=ユーザー、左=AI）
- フッター: バージョン（例: v1.0.0）+ デプロイ日付を常時表示

---

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # サーバーサイドのみ
GEMINI_API_KEY=               # サーバーサイドのみ
```

---

## ディレクトリ構成（Next.js App Router）

```
three-good-things/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # ホーム（エピソード一覧）
│   ├── login/page.tsx
│   ├── chat/page.tsx               # 日中の深掘りチャット
│   ├── summary/page.tsx            # 夜のAI要約
│   ├── history/page.tsx
│   └── api/
│       ├── chat/route.ts           # チャット応答
│       ├── episode-summary/route.ts # エピソード保存まとめ
│       └── summarize/route.ts      # 夜の要約
├── components/
│   ├── ChatBubble.tsx
│   ├── EpisodeCard.tsx
│   ├── SummaryOutput.tsx
│   └── NavBar.tsx
├── lib/
│   ├── supabase.ts
│   └── gemini.ts
├── .env.local
└── SPEC.md
```

---

## 開発ステップ

1. Supabaseプロジェクト作成 → テーブル作成 → RLS設定
2. Next.jsプロジェクト作成 → GitHub push → Vercel連携
3. 認証実装（ログイン・ログアウト）
4. チャット画面実装（深掘り会話 + エピソード保存）
5. ホーム画面実装（エピソード一覧）
6. 夜の要約機能実装（Gemini API + コピー機能）
7. 履歴画面実装
8. デプロイ確認 + バージョン表示

---

## 制約・注意事項

- Gemini 1.5 Flash 無料枠: 15 RPM・100万トークン/日 → 個人利用で十分
- チャット1セッションあたりのトークン数: 概算で入力500〜1000トークン程度
- `GEMINI_API_KEY` と `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみ（`NEXT_PUBLIC_` なし）
- エピソードの編集・削除は v1 スコープ外（削除のみ対応）
- オフライン対応は v1 スコープ外

---

*v0.2.0 — 2026-06-20 作成*
