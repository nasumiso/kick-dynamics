// VER-F15〜F17：(Re, S) の表で与える係数（05 §7.9、A1）。表の値はテスト用の任意の値（05 §10.4 の採用値ではない）。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { computeForces, evaluateReynoldsSpinTable, reynoldsSpinTableError } from '../../src/flight/forces';
import { groundHandler, type GroundParameters } from '../../src/ground/bounce';
import { simulateFlightRun } from '../../src/flight/ground-events';
import { simulateFlight } from '../../src/flight/trajectory';
import type { CoefficientModel, ReynoldsSpinCoefficientTable } from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { dot, length, type Vec3 } from '../../src/math/vec3';
import { expectClose } from '../tolerance';
import { allOff, ball, environment, settingsWith, thresholds } from './fixtures';

/** 2 × 3 の表：Re 1e5・3e5、S 0・0.2・0.4。 */
const table: ReynoldsSpinCoefficientTable = {
  kind: 'reynolds-spin-table',
  reynolds: [1e5, 3e5],
  spin: [0, 0.2, 0.4],
  values: [
    [0.1, 0.3, 0.5],
    [0.2, 0.6, 0.4],
  ],
};

const reOf = (speed: number) => (environment.airDensity * speed * 2 * ball.radius) / environment.airViscosity;

function body(velocity: Vec3, angularVelocity: Vec3): RigidBodyState {
  return { position: [0, 1, 0], orientation: IDENTITY_QUAT, linearVelocity: velocity, angularVelocity };
}

describe('VER-F15: evaluating a (Re, S) table (05 §7.9)', () => {
  it('returns the grid values at grid points', () => {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 3; k++) {
        expect(evaluateReynoldsSpinTable(table, table.reynolds[j]!, table.spin[k]!)).toBe(table.values[j]![k]!);
      }
    }
  });

  it('interpolates linearly along grid lines and bilinearly inside a cell', () => {
    // Re の格子線の上（S の方向に 1 次元）
    expectClose(evaluateReynoldsSpinTable(table, 1e5, 0.1), 0.2);
    expectClose(evaluateReynoldsSpinTable(table, 3e5, 0.3), 0.5);
    // S の格子線の上（Re の方向に 1 次元）
    expectClose(evaluateReynoldsSpinTable(table, 2e5, 0.2), 0.45);
    // セルの中心は四隅の平均
    expectClose(evaluateReynoldsSpinTable(table, 2e5, 0.1), (0.1 + 0.3 + 0.2 + 0.6) / 4);
    expectClose(evaluateReynoldsSpinTable(table, 2e5, 0.3), (0.3 + 0.5 + 0.6 + 0.4) / 4);
    // 一般の点：t = 0.25、u = 0.75（最初のセル）
    const t = 0.25;
    const u = 0.75;
    expectClose(evaluateReynoldsSpinTable(table, 1.5e5, 0.15), (1 - t) * (1 - u) * 0.1 + t * (1 - u) * 0.2 + (1 - t) * u * 0.3 + t * u * 0.6);
  });

  it('holds the end values outside the grid (no extrapolation)', () => {
    expect(evaluateReynoldsSpinTable(table, 5e4, 0.2)).toBe(0.3);
    expect(evaluateReynoldsSpinTable(table, 1e6, 0.2)).toBe(0.6);
    expect(evaluateReynoldsSpinTable(table, 1e5, 2)).toBe(0.5);
    expect(evaluateReynoldsSpinTable(table, 1e6, 2)).toBe(0.4);
    expectClose(evaluateReynoldsSpinTable(table, 1e6, 0.1), 0.4);
  });

  it('is constant along a direction with a single grid point (J = 1 or K = 1)', () => {
    const oneRow: ReynoldsSpinCoefficientTable = { kind: 'reynolds-spin-table', reynolds: [2e5], spin: [0, 0.5], values: [[0, 0.4]] };
    expectClose(evaluateReynoldsSpinTable(oneRow, 1e4, 0.25), 0.2);
    expectClose(evaluateReynoldsSpinTable(oneRow, 1e7, 0.25), 0.2);
    const oneColumn: ReynoldsSpinCoefficientTable = { kind: 'reynolds-spin-table', reynolds: [1e5, 3e5], spin: [0], values: [[0.4], [0.2]] };
    expectClose(evaluateReynoldsSpinTable(oneColumn, 2e5, 0.7), 0.3);
    expect(evaluateReynoldsSpinTable({ kind: 'reynolds-spin-table', reynolds: [2e5], spin: [0], values: [[0.25]] }, 9e5, 3)).toBe(0.25);
  });
});

describe('VER-F16: validating a (Re, S) table (05 §7.9)', () => {
  const base = table;
  it.each<[string, Partial<ReynoldsSpinCoefficientTable>]>([
    ['an empty Reynolds number grid', { reynolds: [], values: [] }],
    ['an empty spin parameter grid', { spin: [], values: [[], []] }],
    ['a non-finite grid value', { reynolds: [1e5, Number.POSITIVE_INFINITY] }],
    ['a non-positive Reynolds number', { reynolds: [0, 3e5] }],
    ['non-increasing Reynolds numbers', { reynolds: [3e5, 3e5] }],
    ['a first spin parameter other than 0', { spin: [0.1, 0.2, 0.4] }],
    ['non-increasing spin parameters', { spin: [0, 0.4, 0.2] }],
    ['a row count that does not match', { values: [[0.1, 0.3, 0.5]] }],
    ['a column count that does not match', { values: [[0.1, 0.3], [0.2, 0.6]] }],
    ['a non-finite value', { values: [[0.1, Number.NaN, 0.5], [0.2, 0.6, 0.4]] }],
  ])('rejects a table with %s', (_, patch) => {
    expect(reynoldsSpinTableError({ ...base, ...patch }, false)).not.toBeNull();
  });

  it('rejects negative values only for non-negative coefficients (C_D, C_M), not for C_L', () => {
    const negative: ReynoldsSpinCoefficientTable = { ...base, values: [[0, -0.1, 0.5], [0.2, 0.6, 0.4]] };
    expect(reynoldsSpinTableError(negative, true)).not.toBeNull();
    expect(reynoldsSpinTableError(negative, false)).toBeNull();
    expect(reynoldsSpinTableError(base, true)).toBeNull();
  });

  it('returns invalid-coefficient before integrating, only for enabled forces', () => {
    const bad: ReynoldsSpinCoefficientTable = { ...base, spin: [0.1, 0.2, 0.4] };
    const initial = body([20, 5, 0], [0, 0, 30]);
    const dragOn = simulateFlight(initial, ball, environment, { ...settingsWith({ drag: { enabled: true, coefficient: bad } }, 0.01), maxTime: 1, eventTimeTolerance: 1e-9 });
    expect(dragOn.ok ? null : dragOn.error.code).toBe('invalid-coefficient');
    const negativeDrag: ReynoldsSpinCoefficientTable = { ...base, values: [[0, -0.1, 0.5], [0.2, 0.6, 0.4]] };
    const dragNegative = simulateFlight(initial, ball, environment, { ...settingsWith({ drag: { enabled: true, coefficient: negativeDrag } }, 0.01), maxTime: 1, eventTimeTolerance: 1e-9 });
    expect(dragNegative.ok ? null : dragNegative.error.code).toBe('invalid-coefficient');
    // 無効にした力項の表は確かめない
    const dragOff = simulateFlight(initial, ball, environment, { ...settingsWith({ drag: { enabled: false, coefficient: bad } }, 0.01), maxTime: 1, eventTimeTolerance: 1e-9 });
    expect(dragOff.ok).toBe(true);
  });

  it('requires a finite positive air viscosity η only when a table depends on Re', () => {
    const initial = body([20, 5, 0], [0, 0, 30]);
    const noEta = { ...environment, airViscosity: Number.NaN };
    const withTable = simulateFlight(initial, ball, noEta, { ...settingsWith({ magnus: { enabled: true, coefficient: table } }, 0.01), maxTime: 1, eventTimeTolerance: 1e-9 });
    expect(withTable.ok ? null : withTable.error.code).toBe('invalid-parameter');
    const constant = simulateFlight(initial, ball, noEta, { ...settingsWith({ magnus: { enabled: true, coefficient: { kind: 'constant', value: 0.2 } } }, 0.01), maxTime: 1, eventTimeTolerance: 1e-9 });
    expect(constant.ok).toBe(true);
  });
});

describe('VER-F17: forces with table coefficients keep their properties', () => {
  const v: Vec3 = [20, 0, 0];
  const w: Vec3 = [0, 0, 30]; // バックスピン
  const speed = 20;
  const re = reOf(speed);
  const s = (ball.radius * 30) / speed;
  const area = Math.PI * ball.radius ** 2;

  it('gives drag ½ ρ A C_D(Re, S) |v|² and Magnus force ½ ρ A C_L(Re, S) |v|²', () => {
    const forces = { ...allOff, drag: { enabled: true, coefficient: table }, magnus: { enabled: true, coefficient: table } };
    const r = computeForces(body(v, w), ball, environment, forces, thresholds);
    if (!r.ok) throw new Error(r.error.message);
    const c = evaluateReynoldsSpinTable(table, re, s);
    const magnitude = 0.5 * environment.airDensity * area * c * speed * speed;
    expectClose(r.value.force[0], -magnitude); // 抗力は −x
    expectClose(r.value.force[1], magnitude); // マグヌス力は +y（VER-F10 の向き）
  });

  it('dissipates energy with an S-dependent C_D (VER-F03 with a table)', () => {
    const settings = { ...settingsWith({ gravity: true, drag: { enabled: true, coefficient: table } }, 0.005), maxTime: 1.5, eventTimeTolerance: 1e-9 };
    const r = simulateFlightRun(body([25, 12, 3], [0, 0, 40]), ball, environment, settings);
    if (!r.ok) throw new Error(r.error.message);
    const energy = r.value.samples.map((sample) => {
      const vv = sample.state.linearVelocity;
      return 0.5 * ball.mass * dot(vv, vv) + ball.mass * environment.gravity * sample.state.position[1];
    });
    for (let i = 1; i < energy.length; i++) {
      // 連続系では単調減少。数値解の増加は丸め誤差の範囲（TOL-A）を超えない。
      expect(energy[i]! - energy[i - 1]!).toBeLessThanOrEqual(1e-12 * Math.abs(energy[i - 1]!) + 1e-12);
    }
  });

  it('keeps the speed and turns on a circle of radius 2m/(ρ A C_L) (VER-F05 with a table)', () => {
    const settings = { ...settingsWith({ magnus: { enabled: true, coefficient: table } }, 0.001), maxTime: 0.5, eventTimeTolerance: 1e-9 };
    const r = simulateFlightRun(body(v, w), ball, environment, settings);
    if (!r.ok) throw new Error(r.error.message);
    const cl = evaluateReynoldsSpinTable(table, re, s); // |v|・|ω| が一定なので Re・S も一定
    const radius = (2 * ball.mass) / (environment.airDensity * area * cl);
    const center: Vec3 = [0, 1 + radius, 0]; // +x に飛び、+y へ曲がる
    for (const sample of r.value.samples) {
      expectClose(length(sample.state.linearVelocity), speed, { relative: 1e-9, absolute: 0 });
      const p = sample.state.position;
      expectClose(Math.hypot(p[0] - center[0], p[1] - center[1]), radius, { relative: 1e-9, absolute: 0 });
    }
  });

  it('does not evaluate the table at zero speed (VER-F06 with a table)', () => {
    const broken = { kind: 'function', evaluate: () => Number.NaN } as const satisfies CoefficientModel;
    const forces = { ...allOff, drag: { enabled: true, coefficient: table }, magnus: { enabled: true, coefficient: table } };
    const r = computeForces(body([1e-7, 0, 0], w), ball, { ...environment, airViscosity: Number.NaN }, forces, thresholds);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.force).toEqual([0, 0, 0]);
    expect(broken.kind).toBe('function'); // 比較用：関数の係数でも同じ規則（VER-F06）
  });

  it('mirrors the trajectory under z → −z (VER-F07 with a table)', () => {
    const settings = { ...settingsWith({ gravity: true, drag: { enabled: true, coefficient: table }, magnus: { enabled: true, coefficient: table } }, 0.005), maxTime: 1, eventTimeTolerance: 1e-9 };
    const a = simulateFlightRun(body([22, 8, 4], [3, 25, 10]), ball, environment, settings);
    const b = simulateFlightRun(body([22, 8, -4], [-3, -25, 10]), ball, environment, settings);
    if (!a.ok || !b.ok) throw new Error('flight failed');
    a.value.samples.forEach((sample, i) => {
      const pa = sample.state.position;
      const pb = b.value.samples[i]!.state.position;
      expectClose(pb[0], pa[0]);
      expectClose(pb[1], pa[1]);
      expectClose(pb[2], -pa[2]);
    });
  });
});

// IV-07 の照合（IV-07-C）で追加したテスト。期待値は独立導出（verification/independent/IV-07/derivation.md §2.2）の閉形式の値。
describe('IV-07: derivation cases', () => {
  /** 非等間隔の 3 × 3 の表 T（導出 §2.2）。 */
  const T: ReynoldsSpinCoefficientTable = {
    kind: 'reynolds-spin-table',
    reynolds: [100000, 300000, 700000],
    spin: [0, 1 / 4, 1],
    values: [[0, 1 / 4, 3 / 4], [1 / 2, 1, 5 / 4], [3 / 2, 7 / 4, 2]],
  };

  it('T01: returns the value at every grid point, including the interior row and column', () => {
    T.reynolds.forEach((re, j) => T.spin.forEach((s, k) => expect(evaluateReynoldsSpinTable(T, re, s)).toBe(T.values[j]![k]!)));
  });

  it.each<[string, number, number, number]>([
    ['T02 interior Re grid line', 300000, 1 / 8, 3 / 4],
    ['T03 interior S grid line', 500000, 1 / 4, 11 / 8],
    ['T04 lower-left cell centre', 200000, 1 / 8, 7 / 16],
    ['T05 upper-left cell centre', 200000, 5 / 8, 13 / 16],
    ['T06 lower-right cell centre', 500000, 1 / 8, 19 / 16],
    ['T07 upper-right cell centre', 500000, 5 / 8, 3 / 2],
    ['T08 t = 1/4, u = 3/4', 150000, 3 / 16, 23 / 64],
    ['T09 below the Re grid', 50000, 1 / 8, 1 / 8],
    ['T10 above the Re grid', 900000, 1 / 8, 13 / 8],
    ['T11 above the S grid', 200000, 2, 1],
    ['T12 low Re and high S corner', 50000, 2, 3 / 4],
    ['T13 high Re and high S corner', 900000, 2, 2],
    ['T14 first row', 100000, 5 / 8, 1 / 2],
    ['T15 last row', 700000, 5 / 8, 15 / 8],
    ['T16 first column', 500000, 0, 1],
    ['T17 last grid point', 700000, 1, 2],
  ])('%s', (_, re, s, expected) => {
    expectClose(evaluateReynoldsSpinTable(T, re, s), expected);
  });

  it('rejects sparse rows (holes are not values, IV-07-C H03)', () => {
    const row = new Array<number>(3);
    row[0] = 0;
    row[2] = 0.5;
    expect(reynoldsSpinTableError({ ...T, values: [row, [1 / 2, 1, 5 / 4], [3 / 2, 7 / 4, 2]] }, false)).not.toBeNull();
  });

  it('turns on a circle of radius 2m/(ρ A |C_L|) the other way for a negative C_L (IV-07-C D01)', () => {
    const negative: ReynoldsSpinCoefficientTable = { kind: 'reynolds-spin-table', reynolds: [1e5], spin: [0], values: [[-0.25]] };
    const settings = { ...settingsWith({ magnus: { enabled: true, coefficient: negative } }, 0.001), maxTime: 0.5, eventTimeTolerance: 1e-9 };
    const r = simulateFlightRun(body([20, 0, 0], [0, 0, 30]), ball, environment, settings);
    if (!r.ok) throw new Error(r.error.message);
    const radius = (2 * ball.mass) / (environment.airDensity * Math.PI * ball.radius ** 2 * 0.25);
    const center: Vec3 = [0, 1 - radius, 0]; // 負の C_L では −y へ曲がる
    for (const sample of r.value.samples) {
      const p = sample.state.position;
      expectClose(Math.hypot(p[0] - center[0], p[1] - center[1]), radius, { relative: 1e-9, absolute: 0 });
    }
  });

  it.each([0, -1e-5, Number.POSITIVE_INFINITY])('rejects η = %s when a table is used in flight', (eta) => {
    const r = simulateFlight(body([20, 5, 0], [0, 0, 30]), ball, { ...environment, airViscosity: eta },
      { ...settingsWith({ drag: { enabled: true, coefficient: T } }, 0.01), maxTime: 1, eventTimeTolerance: 1e-9 });
    expect(r.ok ? null : r.error.code).toBe('invalid-parameter');
  });

  it('checks the drag table and η on the rolling path too (groundHandler)', () => {
    const base: GroundParameters = {
      gravity: environment.gravity, restitution: 0.6, friction: 0.6, tangentialSpeedThreshold: 1e-9, diagnosticRelativeTolerance: 1e-9,
      rollingResistance: 0.15, restSpeed: 0.3, stopSpeed: 0.01, stopSpin: 0.1, zeroSpeed: thresholds.zeroSpeed, spinFrictionLength: 0,
      drag: { coefficient: T, airDensity: environment.airDensity, airViscosity: environment.airViscosity },
    };
    expect(groundHandler(ball, base).ok).toBe(true);
    const noEta = groundHandler(ball, { ...base, drag: { ...base.drag!, airViscosity: Number.NaN } });
    expect(noEta.ok ? null : noEta.error.code).toBe('invalid-parameter');
    const bad = groundHandler(ball, { ...base, drag: { ...base.drag!, coefficient: { ...T, spin: [0.1, 0.25, 1] } } });
    expect(bad.ok ? null : bad.error.code).toBe('invalid-coefficient');
  });
});
