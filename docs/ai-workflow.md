# AI エージェントの運用メモ

> 状態：2026-10-18。AGENTS.md の永続ルールを補う、作業手順上の注意をまとめる。ローカル（Claude Code CLI）とクラウド（Claude Code のクラウドセッション、Codex のクラウドタスク）のどちらで作業しても同じように守る。独立検証の手順の正本は [06 §9](06-validation.md)。

## 1. 独立検証の資料を見ない

- Claude Code は、対象機能の照合（`IV-xx-C`）が終わるまで `verification/independent/` 配下を読まない（AGENTS.md）。
- **検索でも除外する**：リポジトリ全体を `grep`・`rg`・`find` などで検索するときは、`--exclude-dir=verification` を付けるか、検索範囲を `docs/`・`specs/`・`packages/`・`apps/` に絞る。`cat` や `ls -R` で中身を表示しない。存在の確認はファイル名とサイズまでにする。
- 誤って見えてしまった場合は、`specs/001-kick-prototype/tasks.md` の該当タスクの結果欄に経緯を記録し、照合のときに考慮する。

## 2. Codex への依頼

- **モデルと推論の強さ**：独立導出・照合は `gpt-6.1-sol`、推論の強さ `medium` を明示して依頼する（既定設定に任せない）。使った設定は tasks.md の結果欄に記録する。
- **ローカル**：Claude Code の `codex:codex-rescue` エージェントに `--model gpt-6.1-sol --effort medium` を付けて渡す。完了まで 10 分を超えるとバックグラウンドに移るので、完了の通知を待つ。
- **クラウド**：ローカルの Codex CLI がないため、Codex のクラウドタスクで依頼する（人間が依頼文を貼り付ける）。PR のコメントでの `@codex` は、依頼文を書いてもコードレビューとして処理され、照合のファイルは作られなかった（2026-10-18、PR #5）。
- 依頼文には、読んでよい文書・読んではいけない場所（`packages/`、`apps/`、`tools/`、対象外の `verification/independent/IV-xx/`）・出力先のファイル・「そのファイル以外を変更しない、コミットしない」を必ず書く。
- 返ってくる報告は「仕様の不足・疑義の要約」だけを受け取る（導出の数式や期待値は受け取らない）。

### 2.1 照合（`IV-xx-C`）の依頼文の雛形

`< >` を埋めて使う。導出（`IV-xx-D`）の依頼も、出力先と「実装・テストを見ない」を変えて同じ形で書く。2 回の照合（PR #6、#8）で、指定外の文書を読んだ例があったため、読む範囲は節まで具体的に書く。

```text
<IV-xx-C>（<機能名>の照合）をお願いします。手順は docs/06-validation.md §9.2 の手順 4 です。コードレビューではなく、照合結果のファイルを作る作業です。

【対象】ブランチ <ブランチ名> の最新のコミット（PR #<番号>）

【読んでよいもの】
- docs/04-architecture.md、docs/05-physics-model.md の <§…>、docs/06-validation.md の <§…>、docs/research/references-and-open-questions.md、specs/001-kick-prototype/tasks.md
- packages/physics-core/src/ の <ディレクトリ> と packages/physics-core/test/ の <ディレクトリ>
- 自分の導出資料：verification/independent/<IV-xx>/derivation.md

【読んではいけないもの】apps/、tools/、対象外の verification/independent/IV-xx/、上に挙げていない 05・06 の節。読んでしまった場合は、範囲と理由を結果の冒頭に書き、判定の根拠から除く。

【照合の観点】<機能ごとの観点>。共通：符号、単位、テストの期待値が独立した根拠を持つか、仕様そのものの誤り（次元解析・極限・対称性）。

【出力】
- verification/independent/<IV-xx>/comparison.md を新規作成する。各差異を「一致／不一致／判断保留」に分類し、前提条件・期待値・許容誤差・根拠を書く（06 §9.3）。使ったモデルと推論の強さも冒頭に書く。
- このファイル以外は変更しない（実装コード・テスト・文書は直さない。修正は IV-xx-R で Claude Code が行う）。
- 変更は <ブランチ名> を基にしたブランチで、PR として出す（<ブランチ名> 宛て）。
- 最後に、不一致と判断保留の要約を返す。
```

## 3. Git

- `git add -A` や `git add .` を使わず、追加するパスを明示する（Codex が作業中のファイルを誤ってコミットしないため）。
- `.github/workflows/` を変更する push には、`gh` の認証に `workflow` スコープが必要。
- PR では CI（`npm run check`）と Codex の自動レビューが動く。レビューの観点は、ルートの AGENTS.md（全体に共通）と `packages/physics-core/AGENTS.md`（Core 固有）の「Code Review Rules」に置く。Codex のレビューは、変更したファイルに最も近い AGENTS.md の「Code Review Rules」を使う。

## 4. クラウドでの作業

- Node：ローカルは 24、クラウドの VM は既定で 22（20・21 も同梱）。CI は 22 と 24 の両方で `npm run check` を実行し、どちらでも動くことを確かめる。
- 依存のインストール：`.claude/settings.json` の SessionStart フックが `scripts/cloud-setup.sh` を実行し、クラウドのときだけ `npm ci` する（lockfile などが変わっていなければ省く）。クラウドの環境の「Setup script」には何も書かない（キャッシュされ、lockfile の変更に追従しないため）。
- ローカルの Claude Code のメモリはクラウドから読めない。続けて守るべき運用は本書か AGENTS.md に書く。
- 作業の引き継ぎ状態（次のタスク、未決定の事項）は `specs/001-kick-prototype/tasks.md` と PR の説明・コメントに残す。
