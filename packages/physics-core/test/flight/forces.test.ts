// T1.2-01：力モデルのインタフェース（各力項の ON/OFF、定数／関数の係数、04 §6 の係数の契約）。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { computeForces } from '../../src/flight/forces';
import type { FlightEnvironment, FlightForceSettings, DegeneracyThresholds } from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { expectAllClose } from '../tolerance';

// テスト用の任意の値（05 §10 の値は未決定のものを含む）。
const ball = { mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 };
const environment: FlightEnvironment = { gravity: 9.80665, airDensity: 1.225, airViscosity: 1.8e-5, wind: [0, 0, 0] };
const thresholds: DegeneracyThresholds = { magnus: 1e-9, zeroSpeed: 1e-9, zeroSpin: 1e-9 };
const off: FlightForceSettings = {
  gravity: false,
  drag: { enabled: false, coefficient: { kind: 'constant', value: 0.25 } },
  magnus: { enabled: false, coefficient: { kind: 'constant', value: 0.2 } },
  spinDecay: { kind: 'none' },
};
const state: RigidBodyState = {
  position: [0, 1, 0], orientation: IDENTITY_QUAT, linearVelocity: [20, 5, -3], angularVelocity: [0, 0, 10],
};

describe('flight force model interface', () => {
  it('returns zero force and torque when every term is off', () => {
    const r = computeForces(state, ball, environment, off, thresholds);
    expect(r.ok && r.value).toEqual({ force: [0, 0, 0], torque: [0, 0, 0] });
  });

  it('switches gravity on and off independently', () => {
    const r = computeForces(state, ball, environment, { ...off, gravity: true }, thresholds);
    expect(r.ok).toBe(true);
    if (r.ok) expectAllClose(r.value.force, [0, -ball.mass * environment.gravity, 0]);
  });

  it('accepts a function coefficient evaluated with (Re, S)', () => {
    const calls: Array<[number, number]> = [];
    const drag = { enabled: true, coefficient: { kind: 'function' as const, evaluate: (re: number, s: number) => {
      calls.push([re, s]);
      return 0.25;
    } } };
    const constant = computeForces(state, ball, environment, { ...off, drag: { enabled: true, coefficient: { kind: 'constant', value: 0.25 } } }, thresholds);
    const fromFunction = computeForces(state, ball, environment, { ...off, drag }, thresholds);
    expect(constant.ok && fromFunction.ok).toBe(true);
    if (constant.ok && fromFunction.ok) expectAllClose(fromFunction.value.force, constant.value.force);
    const speed = Math.hypot(20, 5, -3);
    expect(calls).toHaveLength(1);
    expectAllClose(calls[0]!, [(1.225 * speed * 0.22) / 1.8e-5, (0.11 * 10) / speed]);
  });

  it('rejects non-finite or negative drag coefficients as SimResult errors', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -0.1]) {
      const r = computeForces(state, ball, environment, { ...off, drag: { enabled: true, coefficient: { kind: 'function', evaluate: () => value } } }, thresholds);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('invalid-coefficient');
    }
  });

  it('does not skip linear spin decay for a ball with zero relative speed', () => {
    // 線形の回転減衰（05 §7.5 (b)）は |v_r| によらず働くため、ゼロ速度でも無視してはいけない。
    const spinning = { ...state, linearVelocity: [0, 0, 0] as const, angularVelocity: [0, 0, 30] as const };
    const decay = computeForces(spinning, ball, environment, { ...off, spinDecay: { kind: 'linear', coefficient: 1e-4 } }, thresholds);
    expect(decay.ok).toBe(true);
    if (decay.ok) expectAllClose(decay.value.torque, [0, 0, -30 * 1e-4]);
  });
});
