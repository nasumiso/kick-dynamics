// 結果の出力（T1.5-06、FR-20・AC-14）。形式は JSON 1 ファイル（OQ-19 の決定、2026-10-20）。
// 入力・パラメータ（値・単位・確からしさ・出典）・設定・モデルの版・結果（衝突・測定値・警告・軌道の全サンプル）を
// Core の内部単位（SI）のまま出力する。出力した入力・パラメータ・設定で Core を再実行すると同じ結果が得られる（NFR-05・NFR-06）。
import type {
  FlightEvent, ImpactResult, KickInput, KickMetrics, KickSimulationResult, KickWarning, ParameterSet, SimulationSettings,
} from '@kick-dynamics/physics-core';

/** 出力の形式の名前と版（暫定）。形式を変えたら版を上げる。 */
export const RESULT_SCHEMA = 'kickdynamics-result';
export const RESULT_SCHEMA_VERSION = 1;

export interface ResultFile {
  readonly schema: typeof RESULT_SCHEMA;
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  /** 出力した日時（ISO 8601）。計算には使わない */
  readonly exportedAt: string;
  readonly units: 'SI';
  readonly modelVersion: string;
  readonly input: KickInput;
  readonly parameters: ParameterSet;
  readonly settings: SimulationSettings;
  readonly result: {
    readonly impact: ImpactResult;
    readonly metrics: KickMetrics;
    readonly warnings: readonly KickWarning[];
    readonly trajectory: {
      /** サンプル数 N */
      readonly sampleCount: number;
      /** s、N */
      readonly time: number[];
      /** m、3N（x, y, z の順に並べる） */
      readonly position: number[];
      /** m/s、3N */
      readonly linearVelocity: number[];
      /** 4N、[x, y, z, w] */
      readonly orientation: number[];
      /** rad/s、3N */
      readonly angularVelocity: number[];
      readonly events: readonly FlightEvent[];
    };
  };
}

export function toResultFile(result: KickSimulationResult, exportedAt: Date): ResultFile {
  const t = result.trajectory;
  return {
    schema: RESULT_SCHEMA,
    schemaVersion: RESULT_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    units: 'SI',
    modelVersion: result.modelVersion,
    input: result.input,
    parameters: result.parameters,
    settings: result.settings,
    result: {
      impact: result.impact,
      metrics: result.metrics,
      warnings: result.warnings,
      trajectory: {
        sampleCount: t.time.length,
        time: Array.from(t.time),
        position: Array.from(t.position),
        linearVelocity: Array.from(t.linearVelocity),
        orientation: Array.from(t.orientation),
        angularVelocity: Array.from(t.angularVelocity),
        events: t.events,
      },
    },
  };
}

export function toResultJson(result: KickSimulationResult, exportedAt: Date): string {
  return JSON.stringify(toResultFile(result, exportedAt), null, 2);
}

/** 出力のファイル名（例：kick-20261020-043512.json、ローカル時刻）。 */
export function resultFileName(exportedAt: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  const d = exportedAt;
  return `kick-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}

/** ブラウザでファイルとして保存する。 */
export function downloadResult(result: KickSimulationResult): void {
  const now = new Date();
  const blob = new Blob([toResultJson(result, now)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resultFileName(now);
  link.click();
  URL.revokeObjectURL(url);
}
