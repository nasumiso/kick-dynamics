// 飛翔のテストで共通に使う、テスト用の任意の値（05 §10 の採用値ではない）。
import type { BallParams } from '../../src/bodies/types';
import type { DegeneracyThresholds, FlightEnvironment, FlightForceSettings, FlightSettings } from '../../src/flight/types';

export const ball: BallParams = { mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 };
export const environment: FlightEnvironment = { gravity: 9.80665, airDensity: 1.225, airViscosity: 1.8e-5, wind: [0, 0, 0] };
// 閾値は 05 §10.2 の仮置きの値（P-21 ε、P-23 ε_v、P-24 ε_ω）。
export const thresholds: DegeneracyThresholds = { magnus: 1e-9, zeroSpeed: 1e-6, zeroSpin: 1e-6 };

export const allOff: FlightForceSettings = {
  gravity: false,
  drag: { enabled: false, coefficient: { kind: 'constant', value: 0.25 } },
  magnus: { enabled: false, coefficient: { kind: 'constant', value: 0.2 } },
  spinDecay: { kind: 'none' },
};

export function settingsWith(forces: Partial<FlightForceSettings>, timeStep: number): FlightSettings {
  return { timeStep, forces: { ...allOff, ...forces }, thresholds };
}
