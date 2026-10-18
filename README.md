# KickDynamics — サッカーキック軌道シミュレータ

*The Physics Behind Every Kick.*

> **開発段階：ドキュメント初版のみ（実装未着手）**
> 現時点でこのリポジトリには、アプリケーション、物理ソルバー、テストコード、依存パッケージは含まれていません。

## 概要

KickDynamics は、キックの物理現象を解明・再現することを目的とした個人開発プロジェクトです。最初の成果物として、ブラウザで動作する 3D のサッカーボール・キック軌道シミュレータを開発します。

飛距離・カーブ量・打ち出し角をゲーム的に直接指定するのではなく、**足とボールの接触条件**（ボール上の接触点、足の速度・移動方向・姿勢など）から物理モデルでボールの並進初速度と角速度を求め、その後の飛翔・バウンドを計算して可視化します。

将来のゲーム化も想定していますが、初期段階では物理的妥当性と検証可能性を優先します。

## 名称体系

| 用途 | 名称 | 状態 |
|---|---|---|
| プロジェクト全体 | **KickDynamics**（リポジトリ名 `kick-dynamics`） | 採用 |
| 物理計算エンジン（`packages/physics-core/`） | KickDynamics Core | 仮称 |
| ブラウザ上の物理シミュレータ（`apps/web/`） | KickDynamics Lab | 仮称 |
| 将来のゲーム | FootBallistics | 有力候補（商標・既存作品との重複は未確認） |

名称の正本は [docs/01-vision.md](docs/01-vision.md) §8 です。

## 設計思想

1. **物理的妥当性・検証可能性 ＞ ゲーム的な楽しさ・演出**（初期段階の優先順位）
2. **結果は条件から計算する**：軌道を先に与える操作を主操作にしない。
3. **キック種別は物理的結果として扱う**：インステップ／インサイド／インフロント／アウトサイドの違いを、名前ごとのスピン補正ではなく、足の形状・姿勢・衝突条件の違いから再現することを目指す（Phase 1 では点接触剛体モデルによる近似に留まる）。
4. **Physics Core の独立**：物理計算は Three.js・DOM・WebGL・UI フレームワークに依存しない純粋な TypeScript モジュールとする。
5. **仮定と限界の明示**：パラメータの出典と確からしさを追跡し、実測で確認していないものは「未検証」と明記する。

## 現在の状態

| 項目 | 状態 |
|---|---|
| ドキュメント | 初版（2026-10-18） |
| KickDynamics Core（`packages/physics-core/`） | 未作成・未実装 |
| KickDynamics Lab（`apps/web/`） | 未作成・未実装 |
| 自動テスト | 未実装 |
| 実測データとの照合 | 未実施（データ未収集） |
| ライセンス | 未決定 |

次の段階は Phase 1「点接触・瞬間衝突・剛体モデルによるブラウザ MVP」です（[ロードマップ](docs/03-roadmap.md)、[Phase 1 仕様](specs/001-kick-prototype/spec.md)）。

## 技術方針（暫定）

| 領域 | 方針 | 状態 |
|---|---|---|
| 実行環境 | デスクトップブラウザ先行、静的ホスティング。スマホは将来検討 | 暫定採用（[ADR-0001](docs/decisions/0001-browser-first.md)） |
| 言語・ビルド | TypeScript / Vite | 暫定採用 |
| 3D 描画 | Three.js（初期は WebGLRenderer） | 暫定採用 |
| UI | 素の HTML/CSS ＋ 軽量コントロール。React 等は必須としない | 暫定採用（ライブラリは未決定） |
| 物理計算 | 独自の TypeScript 製 Physics Core。汎用剛体エンジンに衝突モデルの中核を委ねない | 暫定採用（[ADR-0002](docs/decisions/0002-independent-physics-core.md)） |
| 初期接触モデル | 有限質量の剛体足 × 剛体球の瞬間点接触。無限質量の動く壁を比較基準に併置 | 暫定採用（[ADR-0003](docs/decisions/0003-finite-mass-initial-contact.md)） |
| 自動テスト | Vitest | 候補 |
| 高速化 | Rust/WASM 等への差し替えは、計測で必要性が確認された場合に検討 | 未決定 |

## ドキュメント索引

| 文書 | 内容 | 正本となる範囲 |
|---|---|---|
| [AGENTS.md](AGENTS.md) | AI エージェント向けの永続ルール | 作業ルール |
| [CLAUDE.md](CLAUDE.md) | Claude Code 向けの案内（AGENTS.md を参照） | — |
| [docs/01-vision.md](docs/01-vision.md) | 目的、利用シナリオ、差別化方針、優先順位、非目標 | ビジョン・非目標 |
| [docs/02-requirements.md](docs/02-requirements.md) | ユーザーストーリー、機能・非機能要求、MVP の範囲 | 要求 ID（US / FR / NFR） |
| [docs/03-roadmap.md](docs/03-roadmap.md) | Phase 1〜5、M1.1〜M1.5、物理成熟度と UI 成熟度の 2 軸管理 | ロードマップ・成熟度定義 |
| [docs/04-architecture.md](docs/04-architecture.md) | 責務分離、パッケージ構造案、データフロー、I/O API 草案、時間の分離 | アーキテクチャ・API |
| [docs/05-physics-model.md](docs/05-physics-model.md) | 数式、記号、座標系、単位系、仮定、適用限界、パラメータ表 | 物理モデル・パラメータ |
| [docs/06-validation.md](docs/06-validation.md) | 数理・実装検証（Verification）、実測による妥当性確認（Validation）、AI による独立検証の手順 | 検証項目 ID（VER / VAL / IV）・許容誤差・独立検証ワークフロー |
| [docs/decisions/](docs/decisions/) | 軽量 ADR | 設計判断 |
| [docs/research/references-and-open-questions.md](docs/research/references-and-open-questions.md) | 調査テーマ、参考文献候補、必要な実測データ、技術的未決事項 | 未決事項 ID（OQ）・データ ID（D） |
| [specs/001-kick-prototype/spec.md](specs/001-kick-prototype/spec.md) | Phase 1 の機能・制約・受入条件 | Phase 1 受入条件（AC） |
| [specs/001-kick-prototype/plan.md](specs/001-kick-prototype/plan.md) | Phase 1 の実装計画・依存順・懸念 | — |
| [specs/001-kick-prototype/tasks.md](specs/001-kick-prototype/tasks.md) | Phase 1 の小タスク一覧と完了確認方法 | タスク ID |

設計判断（ADR）：

- [ADR-0001 ブラウザ先行](docs/decisions/0001-browser-first.md) — Accepted (provisional)
- [ADR-0002 描画から独立した Physics Core](docs/decisions/0002-independent-physics-core.md) — Accepted (provisional)
- [ADR-0003 初期接触モデルに有限質量の剛体足を採用](docs/decisions/0003-finite-mass-initial-contact.md) — Accepted (provisional)

初期の合意事項は [soccer_kick_simulator_docs_prompt.md](soccer_kick_simulator_docs_prompt.md)（引き継ぎプロンプト）に記録されています。以後の正本は上表の各文書です。

## 開発体制

Claude Code が設計の具体化・実装・テストを、Codex が物理モデルと数値計算の独立検証を担当し、開発者が最終判断を行います。役割は [AGENTS.md](AGENTS.md)、独立検証の手順は [docs/06-validation.md](docs/06-validation.md) §9 を参照してください。

## 未実装・未決定の主な事項

- アプリケーション、物理ソルバー、テストはすべて未実装です。
- 足の簡略形状、キック入力の自由度と UI、反発・摩擦・空力係数、接地モデル、検証用実測データの入手方法などは未決定です（[未決事項一覧](docs/research/references-and-open-questions.md)）。
- 物理パラメータの多くは出典未確認・未検証です。
- Phase 1 の完了時点でも、本プロジェクトは「実際のキックを高精度に再現している」とは主張しません。

## 予定するリポジトリ構成

```text
.
├── README.md / AGENTS.md / CLAUDE.md
├── docs/                      # 設計文書（作成済み）
├── specs/001-kick-prototype/  # Phase 1 の仕様・計画・タスク（作成済み）
├── apps/web/                  # 未作成：KickDynamics Lab（Vite + Three.js の Web アプリ）
├── packages/physics-core/     # 未作成：KickDynamics Core（描画非依存の物理計算コア）
├── tools/validation/          # 未作成・候補：検証用スクリプト
└── verification/independent/  # 未作成・予定：独立検証の記録（実装側のテストとは分けて管理）
```

詳細は [docs/04-architecture.md](docs/04-architecture.md) を参照してください。
