# ADR-0008: モデルの版（`MODEL_VERSION`）の付け方

- Status: Accepted
- Date: 2026-11-15
- 関連：[04-architecture.md](../04-architecture.md) §10、[02-requirements.md](../02-requirements.md) NFR-06、[ADR-0006](0006-result-json-format.md)、[Phase 1 検証レポート](../reports/phase1-verification-report.md) §6.3、tasks T1.5-10

## Context

- Core は、結果に `modelVersion` を付けて返す（NFR-06）。Lab は、それを結果の JSON（ADR-0006）に書き出す。
- Phase 1 の間、`MODEL_VERSION` は `0.0.0` のままだった。その間に、転がりの間の抗力（T1.5-12）やねじり摩擦（T1.5-14）など、結果が変わる変更があった。そのため、`modelVersion` からはモデルの状態を区別できなかった（検証レポート §6.3）。
- 結果の JSON の形式の版は、別に `schemaVersion` で表している（ADR-0006）。npm のパッケージの版（`package.json` の `version`）は、公開しないため使っていない。

## Decision

2026-11-15、人間が決定。

- `MODEL_VERSION` は `MAJOR.MINOR.PATCH` の 3 つの数で表す。
- Phase 1 の完了時点のモデル（PM-1、実装検証済み・実測未照合）を `0.1.0` とする。
- 版を上げる規則：
  - **MINOR**：同じ入力・パラメータ・設定に対して、結果（衝突・軌道・測定値・警告・エラー）が変わりうる変更。モデルの式、解法、積分、イベントの処理、入力の検証の変更を含む。
  - **PATCH**：結果を変えない変更のうち、モデルの版で記録しておきたいもの（性能の改善、エラーの説明文の変更など）。
  - **MAJOR**：`1.0.0` をどの時点にするかは**未決定**。候補は、主要な量を実測と照合したとき（Phase 4、[03](../03-roadmap.md)）。それまでは `0` のままにする。
- 版は、結果が変わる変更と同じ変更（コミット・PR）で上げる。変更の内容は、tasks.md の結果欄など、その変更の記録に書く。
- `MODEL_VERSION` は `schemaVersion`、npm のパッケージの版とは独立に扱う。

## Consequences

- 結果の JSON の `modelVersion` で、Phase 1 の完了時点のモデルと、それ以降のモデルを区別できる。
- `0.0.0` と書かれた過去の結果の JSON は、Phase 1 の途中のどの状態のモデルかを `modelVersion` からは特定できない。特定にはコミットが要る。
- 結果が変わるかどうかの判断は人とレビューに頼る。VER のテストは、版を上げ忘れたことを検出しない。

## 再検討の条件

- `1.0.0` の時期を決めるとき。
- Lab とゲーム（Phase 5）が同じ Core を使い、版の互換性を確かめる必要が出たとき。
