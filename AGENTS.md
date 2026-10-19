# AGENTS.md

KickDynamics（サッカーキック軌道シミュレータ）で作業する AI エージェント向けの、毎回守るルールだけを置く。名称・構成・コマンドは [README.md](README.md)、作業手順は [docs/ai-workflow.md](docs/ai-workflow.md) を参照。

## 現在の段階

- M1.4（ブラウザのキック入力 UI と軌道描画）を実装中。**ユーザーの指示なしに、指示された範囲を超える実装・依存パッケージ導入・フレームワーク初期化を始めない。**
- 実装は [specs/001-kick-prototype/tasks.md](specs/001-kick-prototype/tasks.md) の順に 1 タスクずつ進め、完了したら結果欄を書く。変更後は `npm run check` を通す。

## 正本

数式や一覧を他の文書へ複製せず、正本へリンクする。

| 対象 | 正本 |
|---|---|
| 物理モデル（数式・座標系・単位・パラメータ表） | [docs/05-physics-model.md](docs/05-physics-model.md) |
| 検証項目（VER / VAL）・許容誤差・独立検証の手順 | [docs/06-validation.md](docs/06-validation.md) |
| アーキテクチャ・API・依存ルール | [docs/04-architecture.md](docs/04-architecture.md) |
| 要求・ロードマップ | [docs/02-requirements.md](docs/02-requirements.md)、[docs/03-roadmap.md](docs/03-roadmap.md) |
| 未決事項（OQ）・実測データ（D） | [docs/research/references-and-open-questions.md](docs/research/references-and-open-questions.md) |
| Phase 1 受入条件・タスク | [specs/001-kick-prototype/](specs/001-kick-prototype/) |
| AI エージェントの運用（Codex への依頼、Git、クラウド） | [docs/ai-workflow.md](docs/ai-workflow.md) |

## 役割と独立検証

- 人間：最終判断と承認。Claude Code：設計の具体化・実装・テスト。Codex：物理モデル・数値計算の独立検証（実装コードは原則変更しない）。
- 重要な物理機能は、仕様確定 → Codex の独立導出 → 実装 → Codex の照合 → 根拠に基づく差異の解決、の順で進める（[06 §9](docs/06-validation.md)）。
- Claude Code は、対象機能の照合が終わるまで `verification/independent/` を読まない（検索でも除外する）。
- 差異は物理法則・解析解・実測などの根拠で解決し、AI 同士の多数決で決めない。

## ルール

1. **Physics Core の独立**：`packages/physics-core` は Three.js、DOM、WebGL、ブラウザ API、UI フレームワーク、外部パッケージを import しない。
2. **物理的根拠のない補正をしない**：キック種別ごとのスピン付与、軌道の後付け補正、目標への吸い寄せなどを Core に入れない。
3. **軌道を主入力にしない**：飛距離・カーブ量・打ち出し角を直接指定する操作を主操作にしない。
4. **SI 単位**：Core の入出力は SI。km/h・rpm・度への変換は表示層だけ。
5. **時間の分離**：物理の時間刻みは描画 FPS・再生速度から独立させる。
6. **仕様と同時に更新**：モデル・API・受入条件を変えたら、正本文書と対応する VER テストを同じ変更で更新する。設計判断は `docs/decisions/` に ADR を追加する。
7. **断定しない・捏造しない**：未決定は「未決定」「暫定」「候補」と書く。確認していない文献・数値・URL・検証結果を書かない。パラメータには出典と確からしさを付ける。
8. **許容誤差を根拠なく決め打ちしない**：根拠がなければ未決定として残し、仮の値は「仮置き」と明記する。
9. **依存を勝手に追加しない**：パッケージの追加は事前にユーザーの承認を得る。Core のランタイム依存は原則ゼロ。
10. **Phase の範囲を守る**：有限時間接触・変形・面接触・FEM などを Phase 1 に紛れ込ませない。
11. **既存内容を壊さない**：大幅な改変の前に既存の内容を確認する。無関係なファイルは変更しない。
12. 文書は日本語で書く（コード識別子・規格名は英語でよい）。

## Code Review Rules

PR レビュー（Codex の GitHub 連携など）の観点のうち、リポジトリ全体に共通するもの。指摘は日本語で書く。Physics Core 固有の観点は [packages/physics-core/AGENTS.md](packages/physics-core/AGENTS.md) にある。PR レビューは独立検証の照合（06 §9 の手順 4）の代わりにはならない。

- P0：物理モデル・API・受入条件を変えたのに、正本文書（05・06・04・spec）と対応する VER テストが同じ PR で更新されていない（ルール 6）。
- P1：未決定のパラメータや許容誤差に、根拠のない値が「仮置き」の明記なしで入っている（ルール 7・8）。承認されていない依存パッケージの追加（ルール 9、ADR-0004）。
- 対象外：`verification/independent/` 配下の導出資料の内容（独立検証の手順で扱う）。文体・書式だけの指摘。
