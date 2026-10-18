# AGENTS.md

KickDynamics（サッカーキック軌道シミュレータ）で作業する AI エージェント向けの永続ルールです。名称：物理コア = KickDynamics Core（仮称、`packages/physics-core`）、ブラウザシミュレータ = KickDynamics Lab（仮称、`apps/web`）、将来のゲーム名 = FootBallistics（候補・商標未確認のため確定名として扱わない）。詳細は各正本文書を参照し、ここには要点のみを置きます。

## 現在の段階

- ドキュメント初版のみ。**ユーザーの指示なしに、アプリ実装・依存パッケージ導入・フレームワーク初期化を始めない。**
- 実装に着手するときは [specs/001-kick-prototype/tasks.md](specs/001-kick-prototype/tasks.md) の順に、1 タスクずつ進める。

## 正本

| 対象 | 正本 |
|---|---|
| 物理モデル（数式・記号・座標系・単位・パラメータ表） | [docs/05-physics-model.md](docs/05-physics-model.md) |
| 検証項目（VER / VAL）・許容誤差・独立検証の手順（IV） | [docs/06-validation.md](docs/06-validation.md) |
| アーキテクチャ・API・依存ルール | [docs/04-architecture.md](docs/04-architecture.md) |
| ロードマップ・成熟度 | [docs/03-roadmap.md](docs/03-roadmap.md) |
| 要求（US / FR / NFR） | [docs/02-requirements.md](docs/02-requirements.md) |
| 未決事項（OQ）・必要な実測データ（D） | [docs/research/references-and-open-questions.md](docs/research/references-and-open-questions.md) |
| Phase 1 受入条件（AC） | [specs/001-kick-prototype/spec.md](specs/001-kick-prototype/spec.md) |

数式や一覧を他の文書へ複製せず、正本へリンクする。

## 役割分担

| 担当 | 役割 |
|---|---|
| 人間（開発者） | 最終的な設計判断と承認 |
| Claude Code（主担当） | 設計の具体化、実装、リファクタリング、テストの実装 |
| Codex（独立検証担当） | 物理モデル・数式・数値計算・テストの妥当性の検証。結果を報告し、実装コードは原則として直接変更しない |

**独立検証の原則**（手順の正本は [docs/06-validation.md §9](docs/06-validation.md)）：

- 重要な物理機能（06 §9.4 の対象）は、仕様確定 → Codex による独立導出 → Claude Code による実装 → Codex による照合 → 根拠に基づく差異の解決、の順で進める。
- Codex の独立導出は、実装コードとテストを見ずに仕様だけから行う。
- Claude Code は、対象機能の照合が終わるまで `verification/independent/` の導出資料を参照しない。
- 差異は物理法則・解析解・実測などの根拠で解決する。AI 同士の多数決で判断しない。
- 独立検証の結果は実装側のテストと区別して管理する。AI による検証は正しさの保証ではなく、自動テストと実測検証を併用する。

## ルール

1. **Physics Core の独立**：`packages/physics-core` は Three.js、DOM、WebGL、ブラウザ API、UI フレームワークを import しない。Three.js 型との変換は `apps/web` 側のアダプタで行う。
2. **物理的根拠のない補正をしない**：キック種別ごとのスピン付与、軌道の後付け補正、目標への吸い寄せなどを Physics Core に入れない。結果は接触条件と物理モデルから計算する。
3. **軌道を主入力にしない**：飛距離・カーブ量・打ち出し角を直接指定する操作を主操作として作らない。
4. **SI 単位**：Core の入出力は SI（m, kg, s, N, rad）。km/h・rpm・度などへの変換は表示層だけで行う。
5. **時間の分離**：物理の時間刻みは描画 FPS から独立させる。再生速度の変更で計算結果を変えない。
6. **仕様変更時は文書とテストを同時に更新**：モデル・API・受入条件を変えたら、正本文書と対応するテスト（VER ID）を同じ変更で更新する。設計判断は `docs/decisions/` に ADR を追加する。
7. **断定しない・捏造しない**：未決定事項は「未決定」「暫定」「候補」と書く。確認していない文献・著者・数値・URL・検証結果を書かない。パラメータには出典と確からしさを付ける（[05 §10](docs/05-physics-model.md)）。
8. **許容誤差を根拠なく決め打ちしない**：根拠がなければ [06](docs/06-validation.md) に未決定として残す。仮の値を使う場合は「仮置き」と明記する。
9. **依存を勝手に追加しない**：npm パッケージ等の追加は事前にユーザーの承認を得て、理由を文書に残す。Physics Core のランタイム依存は原則ゼロ。
10. **Phase の範囲を守る**：有限時間接触、変形、面接触、FEM などを Phase 1 の必須事項に紛れ込ませない。
11. **既存内容を壊さない**：上書きや大幅な改変の前に既存の内容を確認する。無関係なファイルは変更しない。
12. 文書は日本語で書く（コード識別子・規格名は英語でよい）。

## コマンド

未整備（M1.1 完了時に、セットアップ・テスト・型検査・ビルドのコマンドを追記する）。
