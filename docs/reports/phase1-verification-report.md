# Phase 1 検証レポート

> 状態：初版（2026-11-14、T1.5-08）。[06 §8](../06-validation.md) の項目を記録する。
> 本レポートは記録で、正本ではない。検証項目の定義と許容誤差は [06](../06-validation.md)、数式とパラメータは [05](../05-physics-model.md)、独立検証の経緯は [tasks.md](../../specs/001-kick-prototype/tasks.md) が正本。数値はその時点の実行結果の写し。

**要約**

- **数理・実装検証（VER）**：06 §6 の Phase 1 の項目は、すべて自動テストで合格した（AC-15）。
  - VER-M01〜M06、F01〜F14、C01〜C18、G01〜G12、S01〜S05。転がりは実装済みなので、G03〜G12 を含む。
  - 許容誤差は、厳密な判定を除いてすべて**仮置き**（OQ-13 が未決定）。
- **現実との妥当性確認（VAL）**：すべて**未実施**。実測データを集めていないため（OQ-14）。
  - VER に合格しても、モデルが実物のキックを再現しているとは言えない（06 §1）。
- **独立検証（IV）**：Phase 1 で実施すると決めた IV-01〜IV-05 は、照合と差異の解決まで終わった（AC-20）。
  - 不一致はすべて修正した。
  - 判断保留の一部は、理由と扱う先（OQ・後続のタスク）を記録して残している（§4.2）。

## 1. 対象の版と実行環境

| 項目 | 値 |
|---|---|
| 対象のコミット | `e165224`（main、PR #25 のマージ） |
| Core の `MODEL_VERSION` | `0.0.0`（`packages/physics-core/src/pipeline/simulate-kick.ts`）。Phase 1 の間に版を上げていないため、この値ではモデルの状態を区別できない。版はコミットで特定する（§6） |
| 結果の JSON のスキーマ | `kickdynamics-result` 版 1（暫定、[ADR-0006](../decisions/0006-result-json-format.md)） |
| 実行環境 | Apple M1（メモリ 16 GB）、macOS 26.5.1、Node 24.6.0 |
| ツール | TypeScript 7.0.2、Vitest 5.0.5（Core は `environment: 'node'`） |
| CI | GitHub Actions の Node 22・24 で `npm run check`（`.github/workflows/ci.yml`）。本レポートの数値はローカルの実行結果 |

**実行したコマンドと結果**（2026-11-14）

- `npm run typecheck`（`tsc -b`）：合格。
- `npm run check:boundary`：合格（「physics-core の依存境界の検査に合格しました。」）。
- `vitest run`：47 ファイル・407 テストがすべて合格（不合格 0、スキップ 0）。
  - 内訳は Core 339、Lab（`apps/web`）68。

## 2. VER の結果

### 2.1 一覧

- 「テスト数」は、テスト名（`describe`・`it`）に VER ID を含むテストの数。
- 1 つのテストが複数の ID を確かめる場合（例：`VER-C01 / C02`）は、それぞれの ID に数えた。
- 許容誤差の区分は [06 §3](../06-validation.md)。各区分の値と、それが仮置きかどうかは §2.2 に書く。

**数学ユーティリティ・座標系・単位**

| ID | 結果 | テスト数 | テストのファイル | 許容誤差 |
|---|---|---|---|---|
| VER-M01 | 合格 | 6 | `test/math/vec3.test.ts` | TOL-A |
| VER-M02 | 合格 | 10 | `test/math/mat3.test.ts` | TOL-A |
| VER-M03 | 合格 | 11 | `test/math/quat.test.ts`、`test/flight/rotation.test.ts` | TOL-A |
| VER-M04 | 合格 | 7 | `test/bodies/dynamics.test.ts` | TOL-A |
| VER-M05 | 合格 | 4 | `apps/web/test/units/units.test.ts` | TOL-A |
| VER-M06 | 合格 | 3 | `test/frames.test.ts` | 厳密 |

**飛翔**

| ID | 結果 | テスト数 | テストのファイル | 許容誤差 |
|---|---|---|---|---|
| VER-F01 | 合格 | 2 | `test/flight/vacuum.test.ts` | TOL-A |
| VER-F02 | 合格 | 2 | `test/flight/convergence.test.ts` | TOL-B（観測した次数は 06 §4.2 の記録） |
| VER-F03 | 合格 | 2 | `test/flight/drag.test.ts` | TOL-A・TOL-B |
| VER-F04 | 合格 | 2 | `test/flight/drag.test.ts` | TOL-B |
| VER-F05 | 合格 | 2 | `test/flight/magnus.test.ts` | TOL-B |
| VER-F06 | 合格 | 9 | `test/flight/magnus.test.ts`、`test/flight/rotation.test.ts` | 厳密 |
| VER-F07 | 合格 | 2 | `test/flight/magnus.test.ts` | TOL-A |
| VER-F08 | 合格 | 2 | `test/flight/ground-events.test.ts` | TOL-C |
| VER-F09 | 合格 | 1 | `test/flight/rotation.test.ts` | TOL-A |
| VER-F10 | 合格 | 2 | `test/flight/magnus.test.ts` | 厳密（符号） |
| VER-F11 | 合格 | 3 | `test/flight/rotation.test.ts` | TOL-B（向きは厳密） |
| VER-F12 | 合格 | 6 | `test/flight/ground-events.test.ts` | 厳密 |
| VER-F13 | 合格 | 3 | `test/flight/rotation.test.ts` | TOL-B（向きは TOL-A） |
| VER-F14 | 合格 | 11 | `test/flight/spin-table.test.ts` | TOL-A |

VER-F14 のテスト名には VER ID が入っていない（ファイルの冒頭のコメントにだけある）。06 §7 の「テスト名に VER ID を含める」に合っていない（§6）。

**接触（足–ボール）**

| ID | 結果 | テスト数 | テストのファイル | 許容誤差 |
|---|---|---|---|---|
| VER-C01 | 合格 | 8 | `test/contact/frictionless.test.ts` | TOL-A |
| VER-C02 | 合格 | 8 | `test/contact/frictionless.test.ts`（C01 と同じテスト群） | TOL-A |
| VER-C03 | 合格 | 1 | `test/contact/frictionless.test.ts` | TOL-A |
| VER-C04 | 合格 | 1 | `test/contact/frictionless.test.ts` | TOL-A |
| VER-C05 | 合格 | 7 | `test/contact/diagnostics.test.ts` | TOL-A |
| VER-C06 | 合格 | 7 | `test/contact/diagnostics.test.ts`（C05 と同じテスト群） | TOL-A |
| VER-C07 | 合格 | 1 | `test/contact/diagnostics.test.ts` | TOL-A |
| VER-C08 | 合格 | 2 | `test/contact/diagnostics.test.ts` | TOL-A |
| VER-C09 | 合格 | 4 | `test/contact/frictionless.test.ts`、`test/contact/friction.test.ts` | TOL-A |
| VER-C10 | 合格 | 8 | `test/contact/friction.test.ts` | TOL-A |
| VER-C11 | 合格 | 3 | `test/contact/friction.test.ts` | 仮置きの判定方法（06 §4.3） |
| VER-C12 | 合格 | 2 | `test/contact/kinematic-wall.test.ts` | 仮置きの判定方法（06 §4.3） |
| VER-C13 | 合格 | 2 | `test/contact/frictionless.test.ts` | 厳密 |
| VER-C14 | 合格 | 2 | `test/contact/diagnostics.test.ts` | TOL-A |
| VER-C15 | 合格 | 4 | `test/contact/k-matrix.test.ts` | TOL-A |
| VER-C16 | 合格 | 5 | `test/contact/kinematic-wall.test.ts` | TOL-A |
| VER-C17 | 合格 | 12 | `test/contact/setup.test.ts` | TOL-A。$\varepsilon_\phi$ の直上は $64\,\epsilon_{\text{mach}}/\ell$（仮置き） |
| VER-C18 | 合格 | 1 | `test/contact/diagnostics.test.ts` | 厳密（警告の有無） |

**接地**

| ID | 結果 | テスト数 | テストのファイル | 許容誤差 |
|---|---|---|---|---|
| VER-G01 | 合格 | 4 | `test/ground/bounce.test.ts` | TOL-A |
| VER-G02 | 合格 | 13 | `test/ground/bounce.test.ts` | TOL-A |
| VER-G03 | 合格 | 3 | `test/ground/rolling.test.ts` | TOL-A |
| VER-G04 | 合格 | 8 | `test/ground/rolling.test.ts`、`rolling-drag.test.ts`、`rolling-spin.test.ts` | 厳密（イベントの種類と時刻） |
| VER-G05 | 合格 | 4 | `test/ground/rolling.test.ts`、`rolling-drag.test.ts` | TOL-A（加速度が一定の区間のため） |
| VER-G06 | 合格 | 4 | `test/ground/rolling.test.ts` | TOL-A |
| VER-G07 | 合格 | 3 | `test/ground/rolling-drag.test.ts` | TOL-B。切り替えのステップは厳密な大小 |
| VER-G08 | 合格 | 3 | `test/ground/rolling-drag.test.ts` | TOL-A・厳密（ステップ）、抗力 ON は TOL-B |
| VER-G09 | 合格 | 2 | `test/ground/rolling-drag.test.ts` | 厳密（状態の種類と向き） |
| VER-G10 | 合格 | 1 | `test/ground/rolling-drag.test.ts` | TOL-A、大小は厳密 |
| VER-G11 | 合格 | 1 | `test/ground/rolling-drag.test.ts` | 時刻の差は厳密な大小。速度の誤差は 1e-12 以下（06 §4.4 の記録） |
| VER-G12 | 合格 | 7 | `test/ground/rolling-spin.test.ts` | (1) $4n\varepsilon_{\text{mach}}\lvert\omega_{y,0}\rvert$（$c = 4$ は仮置き）、(2)(3) 厳密 |

**システム全体**

| ID | 結果 | テスト数 | テストのファイル | 許容誤差 |
|---|---|---|---|---|
| VER-S01 | 合格 | 1 | `test/pipeline/simulate-kick.test.ts` | 厳密（ビット単位の一致） |
| VER-S02 | 合格 | 1 | `test/pipeline/simulate-kick.test.ts` | 厳密 |
| VER-S03 | 合格 | 8 | `test/metrics/flight-metrics.test.ts` | TOL-A・TOL-C |
| VER-S04 | 合格 | 1 | `apps/web/test/playback/playback-clock.test.ts` | 厳密（ビット単位の一致） |
| VER-S05 | 合格 | — | `npm run check:boundary`（`packages/physics-core/scripts/check-boundary.mjs`）と、DOM の型を含まない型検査（`packages/physics-core/tsconfig.json` の `lib: ["ES2022"]`） | 厳密 |

- 表のファイルの場所：`apps/web/` で始まるもの以外は、`packages/physics-core/` の下にある。
- VER-S05 は Vitest のテストではない。`npm run check` の一部として実行している。

**未実装・不合格**：なし。

### 2.2 使用した許容誤差

[OQ-13](../research/references-and-open-questions.md) は未決定。そのため、「厳密」以外の判定幅はすべて仮置きである。

| 区分 | 値 | 仮置きか | 定義 |
|---|---|---|---|
| TOL-A | rel = abs = $10^{-12}$ | 仮置き | 06 §3、`packages/physics-core/test/tolerance.ts` |
| TOL-B | 観測した収束次数が理論次数 ±0.5 以内 | 仮置き | 06 §3 |
| TOL-C | 二分法の打ち切り幅 $\delta_t = 10^{-9}$ s（真空中の接地時刻に限る） | 仮置き | 06 §3、05 §7.7 |
| TOL-D | — | 未決定（実測との比較に使う。Phase 1 では使っていない） | 06 §3 |
| 個別の判定方法 | VER-C11・C12 の比 100 の ±10%、VER-C17 の $64\,\epsilon_{\text{mach}}/\ell$、VER-G12 の $c = 4$ | 仮置き | 06 §4.3・§4.4 |
| 厳密 | 符号、イベントの種類と時刻、状態の種類、ビット単位の一致 | — | 06 §4 |

## 3. VAL の状態

すべて未実施。理由は、検証用の実測データ（D-xx）を集めていないこと（OQ-14 は未決定）。

Phase 1 の完了に VAL は必須ではない（06 §5）。

| ID | 対象量 | 必要データ | 状態 | 理由 |
|---|---|---|---|---|
| VAL-01 | 足速度に対するボール初速の比 | D-01 | 未実施 | データ未収集 |
| VAL-02 | スピン量・回転軸 | D-02 | 未実施 | データ未収集 |
| VAL-03 | 打ち出し角 | D-01 | 未実施 | データ未収集 |
| VAL-04 | 軌道・着地点 | D-03、D-09 | 未実施 | データ未収集 |
| VAL-05 | バウンド・転がり | D-07 | 未実施 | データ未収集 |
| VAL-10 | 空力係数（$C_D$、$C_L$ と $Re$、$S$） | D-09 | 未実施 | データ未収集。$C_D$・$C_L$ の値の水準は文献（P-12・P-13）にもとづくが、本プロジェクトでの同定や照合はしていない |

VAL-06〜09 は Phase 2 以降の項目（Phase 1 のモデルは対応していない）。

**参考（VAL ではない）**：P-17 の $\mu_r$ は、FIFA の天然芝の評価と Kolitzus の資料から間接に見積もった値（05 §10.2）。

- これは係数の見積もりで、モデルの出力を実測と比べたものではない。
- VAL-05 の代わりにはならない。

## 4. 独立検証（IV）の照合結果

### 4.1 照合と解決

Phase 1 の範囲は T0-05 で決めた（2026-10-18）。IV-01〜IV-05 は実施する。IV-06 は実施せず、通常のテストとレビューで扱う。

- 下の表のファイルは、すべて `verification/independent/` の下にある。
- 照合はすべて Codex（`gpt-6.1-sol`）による。
- 差異の解決の詳細は、tasks.md の各タスクの結果欄に書いた。

| 照合 | 対象 | 照合結果のファイル | 対象コミット | 一致・不一致・判断保留 | 解決 |
|---|---|---|---|---|---|
| IV-03-C | 飛翔の力モデル | `IV-03/comparison.md` | `43fa5c8` | 9・2・6 | IV-03-R：F-D01・F-D02 は仕様を修正。保留は §4.2 |
| IV-04-C | 積分器・姿勢・地面イベント | `IV-04/comparison.md` | `43fa5c8` | 10・1・6 | IV-04-R：I-D01 は実装を修正。保留は §4.2 |
| IV-03-C2 | $C_L$ の $S$ の折れ線 | `IV-03/comparison-spin-table.md` | `b567796` | 12・1・1 | IV-03-R2：D01 は実装を修正。H01 は決定して修正した |
| IV-01-C | 接触ソルバー | `IV-01/comparison.md` | `ed0ca2c` | 8・0・0 | IV-01-R：解けない構成のテストを追加 |
| IV-02-C | 接触幾何 | `IV-02/comparison.md` | `ed0ca2c` | 4・1・1 | IV-02-R：I02-D01 は実装を修正。I02-H01 は許容誤差を明記 |
| IV-05-C | 接地（バウンド） | `IV-05/comparison.md` | `ed0ca2c` | 4・0・1 | I05-H01（転がりが未実装）は IV-05-C2 で解消 |
| IV-05-C2 | 転がり・停止 | `IV-05/comparison-rolling.md` | `c958a77` | 8・0・0 | IV-05-R2：照合の期待値をテストに追加して実行。**制約**：照合は静的（Codex の実行環境が起動しなかった） |
| IV-05-C3 | 転がり（抗力あり） | `IV-05/comparison-rolling-drag.md` | `4a5eeb9` | 22・3・0 | IV-05-R3：A は実装、B はテスト、C は記録を修正 |
| IV-05-C4 | ねじり摩擦 | `IV-05/comparison-spin-friction.md` | `2550850` | 14・2・1 | IV-05-R4：C14・C16 はテストを修正。C17 は再計測 |

**導出資料**：各 `IV-xx/derivation*.md`。

- IV-05 の仕様の問題（I-01〜I-08、S-01〜S-10、T-01〜T-06）は、期待値を含まない `spec-issues-*.md` に分けて書き出してもらった。
- それを受けて、実装の前に仕様を改めた（T1.5-11・T1.5-13）。

### 4.2 未解決として残した判断保留

以下は、コードも仕様も変えずに残している項目と、その扱う先。

| 項目 | 内容 | 扱う先 |
|---|---|---|
| F-H01 | 閾値（P-21・P-23・P-24）の運用域と、定数の $C_L$・$C_M$ での閾値直上の切り捨て量 | OQ-07・OQ-08・OQ-13 |
| F-H02 | $C_L$ を全スピンの $S$ で評価すること、負の $C_L$ の採用、係数の同定 | OQ-07、VAL-10 |
| F-H03 | VER-F04 の静止開始で、有限の $\varepsilon_v$ によって最初に重力だけの区間ができる（影響は非常に小さい） | 06 §3（TOL-B） |
| F-H04 の一部 | 係数の関数が例外を投げる場合。`simulateKick` は関数の係数を受け付けないため対象外。段階 API では未対応 | 未決定 |
| F-H05 | RK4 はエネルギーの単調減少を保証しない。VER-F03 の「抗力の仕事の数値積分」との直接の比較は実装していない | OQ-12・OQ-13 |
| F-H06・I-H06 | 2026-10-18 に、Claude Code が IV-03・IV-04 の導出資料の一部を誤って見た。照合では写した痕跡は見つからなかった。ただし影響がないことは証明できない | 記録として残す |
| I-H01 | 初期に $h = 0$・$v_y > 0$ で、同じステップの中で地面へ戻る場合の見落とし | OQ-12 |
| I-H02 | かすめる接地・複数回の交差（05 §7.7 で保証の対象外） | — |
| I-H03 | 非真空の接地時刻に TOL-C を当てはめると、積分誤差が加わる | OQ-13 |
| I-H04 | Δt の確定と誤差の目標。3 次元の収束試験の参照解の確度 | OQ-12 |
| IV-05-C4 の C17 | Lab の計測値を Codex は再測定していない。Claude Code が再計測し、同じ水準であることを確かめた | 解決済み（記録） |

F-H04（物性値の無効値）と I-H05（極端な設定値）は、T1.5-01 の入口の範囲の検証（05 §10.3、仮置き）で扱った。

### 4.3 手順の逸脱の記録

- **IV-03-C2**：実装を導出より先に行い、導出と照合を 1 回の依頼で行った。
- **IV-01-C・IV-02-C・IV-05-C、IV-03-C2**：Codex は、指定の範囲外の 05・06 の節を読んだ。各照合結果の冒頭に記録し、判定の根拠からは外した。
- **IV-05-D**：作成途中の版が、誤ってコミット `b237763` に含まれた。完成版で置き換えた。
- **IV-05-D3**：§8.2 から 3 項目が誤って消えた版を対象にした。この 3 項目は T1.5-11 で戻した。

## 5. 使用したパラメータセット

### 5.1 値と確からしさ

- 値・確からしさ・出典の正本は [05 §10.2](../05-physics-model.md)。
- Lab の既定のパラメータセット（`apps/web/src/params/default-parameter-set.ts`）は、05 §10.2 の写し。本レポートの作成時に、値が一致することを確かめた。
- VER のテストの多くは、05 の値ではなく、テスト用の任意の値を使っている。その値は各テストの冒頭と 06 §4 の記録にある。

| 確からしさ | パラメータ |
|---|---|
| 定義値 | P-09 $g$ |
| 規格値（一次情報は未照合） | P-10 $\rho$、P-11 $\eta$ |
| 文献値 | P-12 $C_D$ = 0.2（Goff & Carré 2009） |
| 仮置き（値の水準は文献値） | P-13 $C_L$ の $S$ の折れ線 |
| 仮置き（範囲は規格値・照合済み） | P-01 $m_B$、P-02 $R$ |
| 仮置き（文献からの間接の見積もり） | P-17 $\mu_r$ = 0.15 |
| 仮置き（出典なし） | P-03 $\kappa$、P-04〜P-06（足）、P-07 $e$、P-08 $\mu$、P-15 $e_g$、P-16 $\mu_g$、P-19（転がり・停止の閾値）、P-29 $\ell_s$ |
| 仮置き（数値上の閾値） | P-18 $\Delta t$、P-21、P-23〜P-28 |
| 仮定 | P-20 風速 $\mathbf 0$ |
| 未決定 | P-14 $c_\omega$、P-22 $C_M$（Lab の既定は回転減衰なし） |

### 5.2 Lab の既定の計算設定（暫定）

- 重力・抗力・マグヌス力は ON。回転減衰は OFF。
- 接地の扱いは `bounce-and-roll`。
- 最大時間は 20 s。待ち時間の上限で、物理的な根拠はない。
- Δt は P-18。$\delta_t = 10^{-9}$ s。

## 6. 既知の限界と、レポートで見つけた事項

### 6.1 モデルの既知の限界

本文は正本を参照する。

- **接触**：[05 §6.13](../05-physics-model.md)。
  - 接触時間・変形・接触力の時間履歴を出力しない。
  - 回転は摩擦の衝撃量だけから生じる。
  - 接線方向の弾性的な反発を表現しない。
  - 連成があると、固着と滑りの境界で結果が不連続になる。
  - 同時の多点接触を扱わない。
  - $e$・$\mu$ は定数。
- **飛翔**：[05 §7.8](../05-physics-model.md)。
  - 空力は剛体球の合力とトルクだけで表す。
  - 大気は一様で、風はない。
  - 無回転のボールの不規則な挙動は対象外。
  - **空力係数は未同定で、軌道の定量的な妥当性は保証しない**。
- **数値・接地**：05 §7.7・§8.2。
  - かすめる接地・複数回の交差は保証の対象外。
  - 転がりの状態の切り替えはステップごとの判定で、1 次の精度。
  - 停止は保証しない。

### 6.2 検証の範囲の限界

- **実物との対応は確かめていない**。VAL はすべて未実施（§3）で、パラメータの大半は仮置き（§5）。表示される軌道・測定値は、現実の予測として使えない。
- **AI による照合は正しさを保証しない**（06 §9.5）。
  - 独立導出と実装は同じ仕様にもとづく。そのため、仕様そのものの誤りは両方に同じように現れうる。
- **手動の受入条件の確認**：AC-17 などは、主にヘッドレス Chrome で確かめた。
  - 人間による目視は、静的配信の版（2026-10-23、T1.5-09）と、ねじり摩擦の後の回転の停止（2026-11-14、T1.5-14）で行った。
  - 対象ブラウザはデスクトップの Chrome の最新版だけ（OQ-20）。

### 6.3 レポートの作成中に見つけた事項（未対応）

いずれも、このレポートの変更では直していない。T1.5-10 で扱うか、判断を求める。（追記 2026-11-15：3 件とも T1.5-10 で対応した。1 は ADR-0008 で版の付け方を決め、`0.1.0` に上げた。）

1. **`MODEL_VERSION` が `0.0.0` のまま**：Phase 1 の間に、転がりの抗力・ねじり摩擦などでモデルが変わった。それでも版の値は変わっておらず、結果の JSON の `modelVersion` からモデルを区別できない。版の付け方は未決定。
2. **VER-F14 のテスト名に ID がない**：`test/flight/spin-table.test.ts` の `describe` の名前が `spin coefficient table` で、06 §7 の規約に合っていない。名前を変えるだけで済む。
3. **06 の冒頭の「現時点で実施済みの検証はありません」が古い**：06 の検証状態の更新は、T1.5-10 の範囲。

## 7. 受入条件との対応

| AC | 内容 | 本レポートでの確認 |
|---|---|---|
| AC-15 | 06 §6 の Phase 1 の VER 項目が、すべて自動テストで合格する | 満たしている（§2.1。2026-11-14 の実行で 407 テストが合格） |
| AC-20 | Phase 1 で実施すると決めた独立検証について、照合結果が記録され、未解決の差異がない（または、残る差異と判断の理由が記録されている） | 満たしている（§4.1。不一致はすべて解決した。残る判断保留は §4.2 に理由とともに記録） |
