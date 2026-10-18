# AI エージェントの運用メモ

> 状態：2026-10-18。AGENTS.md の永続ルールを補う、作業手順上の注意をまとめる。ローカル（Claude Code CLI）とクラウド（Claude Code のクラウドセッション、Codex のクラウドタスク）のどちらで作業しても同じように守る。独立検証の手順の正本は [06 §9](06-validation.md)。

## 1. 独立検証の資料を見ない

- Claude Code は、対象機能の照合（`IV-xx-C`）が終わるまで `verification/independent/` 配下を読まない（AGENTS.md）。
- **検索でも除外する**：リポジトリ全体を `grep`・`rg`・`find` などで検索するときは、`--exclude-dir=verification` を付けるか、検索範囲を `docs/`・`specs/`・`packages/`・`apps/` に絞る。`cat` や `ls -R` で中身を表示しない。存在の確認はファイル名とサイズまでにする。
- 誤って見えてしまった場合は、`specs/001-kick-prototype/tasks.md` の該当タスクの結果欄に経緯を記録し、照合のときに考慮する。

## 2. Codex への依頼

- **モデルと推論の強さ**：独立導出・照合は `gpt-6.1-sol`、推論の強さ `medium` を明示して依頼する（既定設定に任せない）。使った設定は tasks.md の結果欄に記録する。
- **ローカル**：Claude Code の `codex:codex-rescue` エージェントに `--model gpt-6.1-sol --effort medium` を付けて渡す。完了まで 10 分を超えるとバックグラウンドに移るので、完了の通知を待つ。
- **クラウド**：ローカルの Codex CLI がないため、Codex のクラウドタスク、または PR のコメントでの `@codex` で依頼する。
- 依頼文には、読んでよい文書・読んではいけない場所（`packages/`、`apps/`、`tools/`、対象外の `verification/independent/IV-xx/`）・出力先のファイル・「そのファイル以外を変更しない、コミットしない」を必ず書く。
- 返ってくる報告は「仕様の不足・疑義の要約」だけを受け取る（導出の数式や期待値は受け取らない）。

## 3. Git

- `git add -A` や `git add .` を使わず、追加するパスを明示する（Codex が作業中のファイルを誤ってコミットしないため）。
- `.github/workflows/` を変更する push には、`gh` の認証に `workflow` スコープが必要。
- PR では CI（`npm run check`）と Codex の自動レビュー（AGENTS.md の「Code Review Rules」）が動く。

## 4. クラウドでの作業

- 動作環境は Node 24、最初に `npm ci` を実行する（CI と同じ）。
- ローカルの Claude Code のメモリはクラウドから読めない。続けて守るべき運用は本書か AGENTS.md に書く。
- 作業の引き継ぎ状態（次のタスク、未決定の事項）は `specs/001-kick-prototype/tasks.md` と PR の説明・コメントに残す。
