// キックの実行（T1.5-02）：Core の simulateKick を呼び、失敗したら理由を表示用の文にする（AC-05）。
import { simulateKick, type KickInput, type KickSimulationResult, type SimulationSettings } from '@kick-dynamics/physics-core';
import { LAB_PARAMETER_SET } from '../params/lab-parameter-set';

/**
 * Lab の計算設定（暫定）。回転減衰は係数が未決定（P-14・P-22）のため「なし」。
 * 最大時間 20 s：横回転のあるボールは鉛直軸まわりの回転が転がりで減衰せず停止しない（05 §8.2）ため、そこで打ち切る。
 * δ_t は 06 §3 の TOL-C の仮置きの値。
 */
export const LAB_SIMULATION_SETTINGS: SimulationSettings = {
  maxTime: 20,
  eventTimeTolerance: 1e-9,
  forces: { gravity: true, drag: true, magnus: true, spinDecay: 'none' },
  ground: 'bounce-and-roll',
};

export type KickRun =
  | { readonly ok: true; readonly result: KickSimulationResult }
  | { readonly ok: false; readonly message: string };

export function runKick(input: KickInput, settings: SimulationSettings = LAB_SIMULATION_SETTINGS): KickRun {
  const result = simulateKick(input, LAB_PARAMETER_SET, settings);
  if (result.ok) return { ok: true, result: result.value };
  const { code, message, details } = result.error;
  switch (code) {
    case 'separating-input':
      return { ok: false, message: 'キックを実行できません：足がボールから離れる向きに動いています（v_A^p · n ≤ 0）。方向か接触点を変えてください。' };
    case 'invalid-input':
      return { ok: false, message: `キックを実行できません：入力が範囲外です（${message}）` };
    case 'invalid-parameter':
      if (Array.isArray(details?.['missing'])) {
        return { ok: false, message: `キックを実行できません：計算に使うパラメータの値が未決定です（${(details['missing'] as string[]).join('、')}）` };
      }
      return { ok: false, message: `キックを実行できません：パラメータが範囲外です（${message}）` };
    default:
      return { ok: false, message: `キックを実行できません（${code}）：${message}` };
  }
}
