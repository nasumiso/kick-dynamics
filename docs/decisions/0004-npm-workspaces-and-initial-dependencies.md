# ADR-0004: npm workspaces と初期の依存パッケージ

- Status: Accepted
- Date: 2026-10-18
- 関連：[04-architecture.md](../04-architecture.md) §3〜§4、[ADR-0001](0001-browser-first.md)、[ADR-0002](0002-independent-physics-core.md)、tasks T0-01・T0-04

## Context

- `apps/web`（KickDynamics Lab）と `packages/physics-core`（KickDynamics Core）を 1 つのリポジトリで管理し、Lab から Core を参照する必要がある。
- 開発環境では Node 24・npm 11 が使える。pnpm はインストールされていない。
- AGENTS.md のルールにより、依存パッケージの追加にはユーザーの承認が必要。M1.1 と M1.4 に必要な最小限の依存を先に承認しておく。

## Decision

### ワークスペース

- **npm workspaces** を使う。ルートの `package.json` に `"workspaces": ["apps/*", "packages/*"]` を置く。`tools/validation` は作成するときに追加する。
- `package-lock.json` をコミットし、依存の版を固定する。

### 承認済みの依存パッケージ（2026-10-18、ユーザー承認）

| パッケージ | 種別 | 配置 |
|---|---|---|
| `typescript` | 開発依存 | ルート、または各ワークスペース |
| `vitest` | 開発依存 | ルート、または各ワークスペース |
| `vite` | 開発依存 | `apps/web` |
| `three` | 依存 | `apps/web` |
| `@types/three` | 開発依存 | `apps/web` |

- 版は導入時点の安定版を使い、lockfile で固定する。
- `packages/physics-core` はランタイム依存を持たない（`dependencies` なし）。開発依存は `typescript` と `vitest` のみ。

### 承認していないもの

- UI コントロール用ライブラリ（[OQ-17](../research/references-and-open-questions.md)）
- lint ツール、フォーマッタ
- 上記以外のパッケージ

これらを追加する場合は、改めてユーザーの承認を得て、本 ADR を更新するか新しい ADR を追加する。

## Consequences

- 追加ツールなしでワークスペースを構成できる。
- npm workspaces は依存を巻き上げる（hoist）ため、Core が宣言していない依存を誤って import できてしまう可能性がある。依存境界の検査（T1.1-03、VER-S05）で補う。

## Alternatives

| 案 | 評価 |
|---|---|
| pnpm workspaces | 依存の分離が厳密でインストールも速いが、pnpm の導入が必要。現時点では不採用 |
| ワークスペースを使わない（単一パッケージ） | Core の独立性を、パッケージの境界として表現できない。不採用 |
