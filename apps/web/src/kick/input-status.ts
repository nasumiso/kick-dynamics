// キック入力の妥当性（Core の buildImpactSetup による判定、05 §6.2）を表示用の文に変換する。
import { buildImpactSetup, type ImpactGeometryParameters, type KickInput } from '@kick-dynamics/physics-core';

export interface InputStatus {
  readonly ok: boolean;
  readonly message: string;
}

export function inputStatus(input: KickInput, geometry: ImpactGeometryParameters): InputStatus {
  const setup = buildImpactSetup(input, geometry);
  if (setup.ok) return { ok: true, message: '入力は有効です（足は接触点でボールへ向かって動いています）。' };
  switch (setup.error.code) {
    case 'separating-input':
      return { ok: false, message: '足がボールから離れる向きに動いています（v_A^p · n ≤ 0）。方向か接触点を変えてください。' };
    case 'invalid-input':
      return { ok: false, message: `入力が範囲外です：${setup.error.message}` };
    default:
      return { ok: false, message: `計算できない入力です（${setup.error.code}）：${setup.error.message}` };
  }
}
