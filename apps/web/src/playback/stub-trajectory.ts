// スタブの軌道（T1.4-09、描画の確認用）。キックの衝突から軌道を求めるパイプラインは M1.5（T1.5-01）で作る。
// ここでは Core の simulateFlight で、決まった初期状態から重力だけの真空中の飛翔を最初の接地まで計算する。
// 空力係数（P-12〜P-14、P-22）と地面の係数（P-15〜P-17）は未決定のため使わない。初期状態は描画の確認用の任意の値。
import { simulateFlight, type FlightSimulationSettings, type RigidBodyState, type SimResult, type Trajectory } from '@kick-dynamics/physics-core';
import { STUB_PARAMETER_SET } from '../params/stub-parameter-set';
import { WORKING_BALL } from '../params/working-values';

/** 描画の確認用の初期状態：ボールの位置から、前方 20 m/s・上 8 m/s・右 1 m/s、横軸まわりのバックスピン 30 rad/s。 */
export const STUB_INITIAL_STATE: RigidBodyState = {
  position: [0, WORKING_BALL.radius, 0],
  orientation: [0, 0, 0, 1],
  linearVelocity: [20, 8, 1],
  angularVelocity: [0, 0, 30],
};

export function stubTrajectory(): SimResult<Trajectory> {
  const p = STUB_PARAMETER_SET;
  const value = <T>(entry: { readonly value: T | null }): T => {
    if (entry.value === null) throw new Error('stub parameter has no value');
    return entry.value;
  };
  const settings: FlightSimulationSettings = {
    timeStep: value(p.timeStep), // P-18（仮置き）
    maxTime: 5,
    eventTimeTolerance: 1e-9, // δ_t（仮置き、06 §3 の TOL-C）
    forces: {
      gravity: true,
      drag: { enabled: false, coefficient: { kind: 'constant', value: 0 } },
      magnus: { enabled: false, coefficient: { kind: 'constant', value: 0 } },
      spinDecay: { kind: 'none' },
    },
    thresholds: { magnus: value(p.magnusThreshold), zeroSpeed: value(p.zeroSpeedThreshold), zeroSpin: value(p.zeroSpinThreshold) },
  };
  // 真空中のため ρ・η は使われない（力の項がすべて無効）。値は P-10 の候補、η は未決定のため 0 を渡す。
  const environment = { gravity: value(p.gravity), airDensity: value(p.airDensity), airViscosity: 0, wind: value(p.wind) };
  return simulateFlight(STUB_INITIAL_STATE, WORKING_BALL, environment, settings);
}
