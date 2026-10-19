// VER-F14：S の折れ線で与える係数（05 §7.4）。表の値はテスト用の任意の値。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { computeForces, evaluateSpinTable, spinTableError } from '../../src/flight/forces';
import { simulateFlight } from '../../src/flight/trajectory';
import type { SpinCoefficientTable } from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { length, type Vec3 } from '../../src/math/vec3';
import { expectClose } from '../tolerance';
import { allOff, ball, environment, thresholds } from './fixtures';

const table: SpinCoefficientTable = { kind: 'spin-table', points: [[0, 0], [0.25, 0.3], [1, 0.4]] };

function body(velocity: Vec3, angularVelocity: Vec3): RigidBodyState {
  return { position: [0, 1, 0], orientation: IDENTITY_QUAT, linearVelocity: velocity, angularVelocity };
}

describe('spin coefficient table', () => {
  it('returns the node values, interpolates linearly between nodes and holds the last value beyond the table', () => {
    expect(evaluateSpinTable(table, 0)).toBe(0);
    expect(evaluateSpinTable(table, 0.25)).toBe(0.3);
    expect(evaluateSpinTable(table, 1)).toBe(0.4);
    expectClose(evaluateSpinTable(table, 0.125), 0.15);
    expectClose(evaluateSpinTable(table, 0.625), 0.35);
    expect(evaluateSpinTable(table, 3)).toBe(0.4);
    expect(evaluateSpinTable({ kind: 'spin-table', points: [[0, 0.2]] }, 0.7)).toBe(0.2);
  });

  it.each<[string, SpinCoefficientTable['points']]>([
    ['no points', []],
    ['a first spin parameter other than 0', [[0.1, 0], [0.2, 0.3]]],
    ['non-increasing spin parameters', [[0, 0], [0.3, 0.3], [0.3, 0.4]]],
    ['a non-finite value', [[0, 0], [0.3, Number.NaN]]],
  ])('rejects a table with %s', (_, points) => {
    expect(spinTableError({ kind: 'spin-table', points })).not.toBeNull();
  });

  it('gives the Magnus force ½ ρ A C_L(S) |v|² with S = R|ω|/|v| (05 §7.4, §7.6)', () => {
    const v: Vec3 = [20, 0, 0];
    const w: Vec3 = [0, 0, 30]; // バックスピン、S = 0.11 · 30 / 20 = 0.165
    const r = computeForces(body(v, w), ball, environment, { ...allOff, magnus: { enabled: true, coefficient: table } }, thresholds);
    if (!r.ok) throw new Error(r.error.message);
    const s = (ball.radius * 30) / 20;
    const cl = (0.3 * s) / 0.25;
    const expected = 0.5 * environment.airDensity * Math.PI * ball.radius ** 2 * cl * 400;
    expectClose(r.value.force[1], expected);
    expectClose(length(r.value.force), expected);
  });

  it('makes the Magnus force vanish continuously as the spin goes to 0 when C_L(0) = 0', () => {
    const forceAt = (spin: number) => {
      const r = computeForces(body([20, 0, 0], [0, 0, spin]), ball, environment, { ...allOff, magnus: { enabled: true, coefficient: table } }, thresholds);
      if (!r.ok) throw new Error(r.error.message);
      return length(r.value.force);
    };
    // S < 0.25 の区間では C_L ∝ S なので、力は回転の速さに比例する。
    expectClose(forceAt(1e-3) / forceAt(1e-2), 0.1);
  });

  it('rejects an invalid table before integrating', () => {
    const result = simulateFlight(body([20, 5, 0], [0, 0, 30]), ball, environment, {
      timeStep: 0.005, maxTime: 1, eventTimeTolerance: 1e-9, thresholds,
      forces: { ...allOff, magnus: { enabled: true, coefficient: { kind: 'spin-table', points: [[0.1, 0]] } } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-coefficient');
  });

  it.each<[string, Vec3]>([
    ['an infinite', [0, 0, Number.POSITIVE_INFINITY]],
    ['a NaN', [0, 0, Number.NaN]],
  ])('rejects %s initial angular velocity as invalid-input instead of integrating NaN forces (IV-03-C2 H01)', (_, w) => {
    const result = simulateFlight(body([10, 5, 0], w), ball, environment, {
      timeStep: 0.005, maxTime: 1, eventTimeTolerance: 1e-9, thresholds,
      forces: { ...allOff, magnus: { enabled: true, coefficient: table } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-input');
  });
});
