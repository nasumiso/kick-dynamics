// キック入力の状態（SI、spec §4、T0-07）。表示単位（km/h・度・mm）への変換は UI 側で行う（AGENTS.md ルール 4）。
// 初期値と入力範囲は UI の試作用の暫定値（2026-10-19、ユーザー承認）で、物理的な根拠・出典はない。
import type { FootModel, KickInput, Vec3 } from '@kick-dynamics/physics-core';
import { anglesToDirection } from '../units/direction';
import { degToRad } from '../units/units';

export interface KickState {
  /** d：ボール中心 → 接触点の単位ベクトル */
  readonly contactDirection: Vec3;
  /** 接触点での足の速さ |v_A^p| m/s */
  readonly footSpeed: number;
  /** v_A^p の方位角 rad（spec §4 の定義） */
  readonly footAzimuth: number;
  /** v_A^p の仰角 rad */
  readonly footElevation: number;
  /** φ：接触法線まわりの足の回転角 rad */
  readonly footRoll: number;
  /** (s_x, s_y)：接触面上の接触位置 m */
  readonly footContactLocation: readonly [number, number];
  /** ω_A rad/s（ワールド座標） */
  readonly footAngularVelocity: Vec3;
  readonly footModel: FootModel;
}

/** 入力範囲（暫定、2026-10-19）。角度は rad、速さは m/s、長さは m、角速度は rad/s。 */
export const KICK_INPUT_RANGES = {
  footSpeed: { min: 0, max: 40 },
  footAzimuth: { min: -Math.PI, max: Math.PI },
  footElevation: { min: degToRad(-45), max: degToRad(60) },
  footRoll: { min: -Math.PI, max: Math.PI },
  footAngularVelocity: { min: -50, max: 50 },
} as const;

export const INITIAL_KICK_STATE: KickState = {
  contactDirection: [-1, 0, 0], // ボールの真後ろ
  footSpeed: 20,
  footAzimuth: 0,
  footElevation: degToRad(10),
  footRoll: 0,
  footContactLocation: [0, 0],
  footAngularVelocity: [0, 0, 0],
  footModel: 'finite-mass',
};

/** Core に渡す KickInput（SI）。v_A^p = |v_A^p| (cos θ cos ψ, sin θ, cos θ sin ψ)。 */
export function toKickInput(state: KickState): KickInput {
  const direction = anglesToDirection({ azimuth: state.footAzimuth, elevation: state.footElevation });
  return {
    contactDirection: state.contactDirection,
    footRollAboutNormal: state.footRoll,
    footContactLocation: state.footContactLocation,
    footContactPointVelocity: [direction[0] * state.footSpeed, direction[1] * state.footSpeed, direction[2] * state.footSpeed],
    footAngularVelocity: state.footAngularVelocity,
    footModel: state.footModel,
  };
}
