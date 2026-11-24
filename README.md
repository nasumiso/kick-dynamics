# KickDynamics — サッカーキック軌道シミュレータ

*The Physics Behind Every Kick.*

> **開発段階：Phase 1（点接触・瞬間衝突・剛体モデルのブラウザ MVP）完了（2026-11-15）**
> モデルは「実装検証済み・実測未照合」です。数式どおりに計算されることは自動テストで確かめていますが、実際のキックを再現しているかは実測と比べていません。表示される軌道・測定値を、現実の予測として使わないでください。

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

2026-11-15 時点。

| 項目 | 状態 |
|---|---|
| 成熟度 | 物理モデル PM-1、機能 UI UM-2（[03 §2](docs/03-roadmap.md)） |
| KickDynamics Core（`packages/physics-core/`） | Phase 1 のモデル（瞬間点接触・飛翔・バウンドと転がり）を実装。モデルの版 `0.2.0`（[ADR-0008](docs/decisions/0008-model-version.md)。V1 の後に $\kappa$ を文献値へ、A1 で空力係数を $(Re, S)$ の表へ置き換えた） |
| KickDynamics Lab（`apps/web/`） | キック入力・3D 表示・軌道の再生・測定値と衝突診断・パラメータの確からしさの表示・結果の JSON 出力を実装。静的ビルドで配信できる。対象ブラウザはデスクトップの Chrome の最新版だけ（OQ-20） |
| 数理・実装検証（VER） | Phase 1 の項目はすべて自動テストで合格（[検証レポート](docs/reports/phase1-verification-report.md)）。許容誤差は、厳密な判定を除いて仮置き（OQ-13） |
| 独立検証（IV） | IV-01〜IV-05 の照合と差異の解決が終わった。IV-06 は Phase 1 では実施しない |
| 実測データとの照合（VAL） | 文献の値と比較した（V1、[V1 検証レポート](docs/reports/v1-validation-report.md)）。VAL-01・VAL-10 と VAL-04 の一部が実測照合済み（合否は付けていない）。VAL-02 は比べられる実測がなかった |
| パラメータ | 大半が仮置き（[05 §10.2](docs/05-physics-model.md)） |
| ライセンス | 未決定 |

文献による妥当性確認（V1、[03 §8](docs/03-roadmap.md)）は完了しました。続けてキック入力 UI の改善（U1、仮称、[spec 003](specs/003-input-ui/spec.md)。打点パッド・回転ギズモ・足の後ろからの視点）も完了しました（2026-11-22）。次は空力の更新（A1、仮称、仕様を作成中）で、その後に Phase 2（点接触のばねと脚のモデル）、Phase 3（面接触・足形状）の順に進めます（[ADR-0009](docs/decisions/0009-plan-after-v1.md)、[03 §3・§5](docs/03-roadmap.md)）。

## 技術方針（暫定）

| 領域 | 方針 | 状態 |
|---|---|---|
| 実行環境 | デスクトップブラウザ先行、静的ホスティング。スマホは将来検討 | 暫定採用（[ADR-0001](docs/decisions/0001-browser-first.md)） |
| ワークスペース | npm workspaces（`package-lock.json` で依存を固定） | 採用（[ADR-0004](docs/decisions/0004-npm-workspaces-and-initial-dependencies.md)） |
| 言語・ビルド | TypeScript / Vite | 採用（導入承認済み 2026-10-18、ADR-0004） |
| 3D 描画 | Three.js（初期は WebGLRenderer） | 採用（導入承認済み 2026-10-18、ADR-0004） |
| 座標系 | 右手系・y 上向き、四元数は `[x, y, z, w]` | 採用（[ADR-0005](docs/decisions/0005-coordinate-and-quaternion-conventions.md)） |
| UI | 素の HTML/CSS。UI コントロール用ライブラリは使わない | 採用（Phase 1、OQ-17。ゲーム UI で再検討） |
| 物理計算 | 独自の TypeScript 製 Physics Core。汎用剛体エンジンに衝突モデルの中核を委ねない | 暫定採用（[ADR-0002](docs/decisions/0002-independent-physics-core.md)） |
| 初期接触モデル | 有限質量の剛体足 × 剛体球の瞬間点接触。無限質量の動く壁を比較基準に併置 | 暫定採用（[ADR-0003](docs/decisions/0003-finite-mass-initial-contact.md)） |
| 自動テスト | Vitest | 採用（導入承認済み 2026-10-18、ADR-0004） |
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
- [ADR-0004 npm workspaces と初期の依存パッケージ](docs/decisions/0004-npm-workspaces-and-initial-dependencies.md) — Accepted
- [ADR-0005 座標系と四元数の規約](docs/decisions/0005-coordinate-and-quaternion-conventions.md) — Accepted
- [ADR-0006 結果の出力形式（JSON 1 ファイル）](docs/decisions/0006-result-json-format.md) — Accepted
- [ADR-0007 Phase 1 の計算はメインスレッドで行う](docs/decisions/0007-main-thread-simulation.md) — Accepted
- [ADR-0008 モデルの版の付け方](docs/decisions/0008-model-version.md) — Accepted
- [ADR-0009 V1 の結果にもとづく次の段階の順序・範囲とパラメータの置き換え](docs/decisions/0009-plan-after-v1.md) — Accepted
- [ADR-0010 A1 の前にキック入力 UI を改善する（U1）](docs/decisions/0010-input-ui-before-a1.md) — Accepted

初期の合意事項は [soccer_kick_simulator_docs_prompt.md](soccer_kick_simulator_docs_prompt.md)（引き継ぎプロンプト）に記録されています。以後の正本は上表の各文書です。

## 開発コマンド

リポジトリのルートで実行する（Node 22 / 24、npm で確認）。

| 目的 | コマンド |
|---|---|
| セットアップ | `npm install`（`package-lock.json` に従う。CI では `npm ci`） |
| 型検査 | `npm run typecheck`（`tsc -b`） |
| テスト | `npm test`（Vitest、全ワークスペース） |
| Core の依存境界の検査 | `npm run check:boundary`（VER-S05） |
| 上記 3 つをまとめて実行 | `npm run check` |
| Lab の開発サーバー | `npm run dev`（Vite、`http://localhost:5173/`） |
| Lab の静的ビルド | `npm run build`（成果物は `apps/web/dist/`。相対パスで出力するため、任意の静的ファイルサーバーのパスに置ける） |

## 開発体制

Claude Code が設計の具体化・実装・テストを、Codex が物理モデルと数値計算の独立検証を担当し、開発者が最終判断を行います。役割は [AGENTS.md](AGENTS.md)、独立検証の手順は [docs/06-validation.md](docs/06-validation.md) §9 を参照してください。

## 未実装・未決定の主な事項

- 反発・摩擦・空力・接地の係数、足の質量と寸法、時間刻み、テストの許容誤差は、仮置きのまま Phase 1 を終えました。値は実測データ（OQ-14）や Phase 2 以降の検討で決めます（[未決事項一覧](docs/research/references-and-open-questions.md)）。
- 実測データとの照合（VAL）は、文献の値との比較（V1）だけです。足の速度・当てた位置・回転がそろったデータや、横に曲がる軌道のデータは見つかっていません。
- 接触時間・変形・面接触・足の形状は、Phase 2 以降の対象です。
- Phase 1 の完了時点でも、本プロジェクトは「実際のキックを高精度に再現している」とは主張しません。

## リポジトリ構成

```text
.
├── README.md / AGENTS.md / CLAUDE.md
├── docs/                      # 設計文書、ADR（decisions/）、検証レポート（reports/）、調査（research/）
├── specs/001-kick-prototype/  # Phase 1 の仕様・計画・タスク
├── apps/web/                  # KickDynamics Lab（Vite + Three.js の Web アプリ）
├── packages/physics-core/     # KickDynamics Core（描画非依存の物理計算コア）
├── scripts/                   # 計測などの補助スクリプト
└── verification/independent/  # 独立検証の記録（実装側のテストとは分けて管理）
```

詳細は [docs/04-architecture.md](docs/04-architecture.md) を参照してください。
