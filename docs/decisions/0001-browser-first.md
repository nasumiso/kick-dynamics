# ADR-0001: ブラウザ先行（デスクトップブラウザ・静的ホスティング）

- Status: Accepted (provisional)
- Date: 2026-10-18
- 関連：[01-vision.md](../01-vision.md)、[04-architecture.md](../04-architecture.md)

## Context

- 個人開発であり、すぐに試せること・他人に見せやすいこと・短い反復で改良できることが重要。
- 3D の可視化と直感的な入力 UI が必要。
- 将来のゲーム化（候補名 FootBallistics）を想定するが、初期は物理的妥当性と検証可能性を優先する。
- スマホ対応は将来検討とし、初期はデスクトップで十分。

## Decision

- 最初のターゲットを**デスクトップブラウザ**とし、**静的ホスティング**で配布できる構成にする。
- 開発言語は TypeScript、ビルドは Vite、3D 描画は Three.js（初期は WebGLRenderer）とする。
- UI は素の HTML/CSS と軽量なコントロールで始め、React などのフレームワークは必須としない（コントロール用ライブラリの採否は未決定、[OQ-17](../research/references-and-open-questions.md)）。
- スマホ対応は、Phase 1 の完了後に入力方式と性能を評価してから検討する。

## Consequences

- 良い点：インストール不要で共有しやすい。サーバーが不要。Three.js の資料が多い。
- 注意点：JavaScript の計算性能の上限がある（必要なら Web Worker や WASM を検討、[ADR-0002](0002-independent-physics-core.md)）。JS エンジン間で初等関数の末尾の桁が異なりうるため、ブラウザ間のビット単位の再現性は保証しない。
- 依存パッケージ（Vite、TypeScript、Three.js、テストランナー）の導入は、M1.1 着手時にユーザーの承認を得て行う（2026-10-18 に承認済み：[ADR-0004](0004-npm-workspaces-and-initial-dependencies.md)）。

## Alternatives

| 案 | 評価 |
|---|---|
| ゲームエンジン（Unity、Unreal、Godot など）のネイティブアプリ | 描画・ゲーム機能は強力だが、エンジン付属の物理と結びつきやすく、Core を独立させる方針と相性がよくない。配布の手間も増える。不採用（ゲーム化の段階で再検討の余地あり） |
| Python（Jupyter など）の研究用ツール | 数値検証には便利だが、対話的な 3D 入力 UI とゲーム化に向かない。検証ツールとして補助的に使う可能性は残す |
| Electron / Tauri のデスクトップアプリ | 現段階では配布コストに見合う利点がない |
| React + React Three Fiber | 必須ではない。UI が複雑になった時点で再検討 |
| WebGPU | 将来の候補。初期は対応状況と実装コストを考えて WebGL を使う |

## 見直し条件

- 性能計測で、ブラウザ上の計算・描画が要求を満たさないと分かった場合
- スマホ対応を始める場合
- UI の複雑化でフレームワークが必要になった場合
