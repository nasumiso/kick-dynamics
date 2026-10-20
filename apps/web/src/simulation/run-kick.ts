// キックの実行（T1.5-02）：入力の状態から Core の simulateKick を呼び、結果か、実行しなかった理由を返す。
// 物理の計算はすべて Core で行い、ここでは入力の変換と設定の組み立て、エラーの表示用の文への変換だけを行う。
import {
  simulateKick, type KickSimulationResult, type ParameterSet, type SimError, type SimulationSettings,
} from '@kick-dynamics/physics-core';
import { toKickInput, type KickState } from '../kick/kick-state';

/**
 * Lab の既定の計算設定（暫定、T1.5-02）。
 * - 力項：重力・抗力・マグヌス力は ON。回転減衰は P-14・P-22 が未決定のため OFF（「回転減衰なし」、tasks T1.5-02 の準備）。
 *   個別の ON/OFF の UI は T1.5-05。
 * - 接地：バウンド・転がり・停止（05 §8）。
 * - 最大時間 20 s：横回転が残ると転がりで止まらず max-time で終わる（05 §8.2）ため、待ち時間の上限として置いた値。物理的な根拠はない。
 * - δ_t = 1e-9 s：06 §3 の TOL-C の仮置き。
 */
export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  maxTime: 20,
  eventTimeTolerance: 1e-9,
  forces: { gravity: true, drag: true, magnus: true, spinDecay: 'none' },
  ground: 'bounce-and-roll',
};

export type KickOutcome =
  | { readonly ok: true; readonly result: KickSimulationResult }
  | { readonly ok: false; readonly reason: string; readonly error: SimError };

/** Core のエラーを、キックを実行しなかった理由の文にする（AC-05）。 */
export function describeKickError(error: SimError): string {
  switch (error.code) {
    case 'separating-input':
      return '足がボールから離れる向きに動いているため、キックを実行しませんでした（v_A^p · n ≤ 0）。方向か接触点を変えてください。';
    case 'invalid-input':
      return `入力が範囲外のため、キックを実行しませんでした：${error.message}`;
    case 'invalid-parameter':
      return `パラメータが未決定または範囲外のため、キックを実行しませんでした：${error.message}`;
    case 'impact-unsolvable':
      return `この接触条件では衝突を解けないため、キックを実行しませんでした：${error.message}`;
    default:
      return `キックを実行できませんでした（${error.code}）：${error.message}`;
  }
}

export function runKick(state: KickState, parameters: ParameterSet, settings: SimulationSettings = DEFAULT_SIMULATION_SETTINGS): KickOutcome {
  const result = simulateKick(toKickInput(state), parameters, settings);
  if (!result.ok) return { ok: false, reason: describeKickError(result.error), error: result.error };
  return { ok: true, result: result.value };
}
