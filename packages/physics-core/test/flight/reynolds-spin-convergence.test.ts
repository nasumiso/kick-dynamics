// VER-F18：(Re, S) の表の格子線をまたぐ軌道の時間刻みの収束（05 §7.9、06 §4.2）。合否の基準は設けず、観測した次数を記録する。
// ここでの判定は、最も細かい刻みの誤差が最も粗い刻みより小さいことだけ。次数の記録は 06 §4.2 の VER-F18 の記録にある。
import { describe, expect, it } from 'vitest';
import { simulateFlightRun } from '../../src/flight/ground-events';
import type { ReynoldsSpinCoefficientTable } from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { ball, environment, settingsWith } from './fixtures';

/** 速さ約 25 m/s から約 15 m/s まで落ちる間に、Re の格子線（約 20 m/s・17 m/s）を 2 本またぐ表（テスト用）。 */
const reAt = (speed: number) => (environment.airDensity * speed * 2 * ball.radius) / environment.airViscosity;
const dragTable: ReynoldsSpinCoefficientTable = {
  kind: 'reynolds-spin-table',
  reynolds: [reAt(17), reAt(20)],
  spin: [0, 0.4],
  values: [[0.45, 0.55], [0.15, 0.3]],
};
const liftTable: ReynoldsSpinCoefficientTable = { ...dragTable, values: [[0, 0.2], [0, 0.35]] };

const T_END = 1.6;

function positionAt(timeStep: number): readonly number[] {
  const settings = {
    ...settingsWith({ gravity: true, drag: { enabled: true, coefficient: dragTable }, magnus: { enabled: true, coefficient: liftTable } }, timeStep),
    maxTime: T_END, eventTimeTolerance: 1e-9,
  };
  const initial = { position: [0, 30, 0] as const, orientation: IDENTITY_QUAT, linearVelocity: [25, 3, 0] as const, angularVelocity: [0, 20, 40] as const };
  const r = simulateFlightRun(initial, ball, environment, settings);
  if (!r.ok) throw new Error(r.error.message);
  const last = r.value.samples[r.value.samples.length - 1]!;
  expect(last.time).toBeCloseTo(T_END, 12);
  return last.state.position;
}

/** 観測した収束次数（基準解は最小の刻みの 1/64）。 */
export function observedOrders(steps: readonly number[]): { readonly errors: number[]; readonly orders: number[] } {
  const reference = positionAt(steps[steps.length - 1]! / 64);
  const errors = steps.map((dt) => {
    const p = positionAt(dt);
    return Math.hypot(p[0]! - reference[0]!, p[1]! - reference[1]!, p[2]! - reference[2]!);
  });
  const orders = errors.slice(1).map((e, i) => Math.log2(errors[i]! / e));
  return { errors, orders };
}

describe('VER-F18: convergence across table grid lines (record only)', () => {
  it('converges as the time step is refined', () => {
    // 格子線をまたぐ位置がステップのどこに来るかで誤差が上下するため、隣り合う刻みでの単調な減少は求めない
    // （2026-11-22 の記録：0.01 → 0.005 s で一度増えた）。減り方の大きさにも根拠のある基準はないので、
    // 最も細かい刻みの誤差が最も粗い刻みの誤差より小さいことだけを確かめる（IV-07-C の H04）。
    const { errors } = observedOrders([0.04, 0.02, 0.01, 0.005, 0.0025]);
    expect(errors[errors.length - 1]!).toBeLessThan(errors[0]!);
  });
});
