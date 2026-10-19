// T1.5-01：simulateKick パイプライン。VER-S01（決定性）、VER-S02（段階間の受け渡し）と、入口の検証（05 §10.3）。
// 未決定のパラメータには、テスト用の任意の値を与える（Core の既定値でも 05 §10.2 の採用値でもない）。
import { describe, expect, it } from 'vitest';
import { boxInertia } from '../../src/bodies/dynamics';
import { buildImpactSetup } from '../../src/contact/setup';
import { solveImpact } from '../../src/contact/solver';
import type { KickInput } from '../../src/contact/types';
import { stateAt, type Trajectory } from '../../src/flight/trajectory';
import type { Vec3 } from '../../src/math/vec3';
import type { ParameterEntry, ParameterId, ParameterSet } from '../../src/params/parameter-set';
import { ACCEPTED_RANGES } from '../../src/pipeline/ranges';
import { simulateKick, type SimulationSettings } from '../../src/pipeline/simulate-kick';

function entry<T>(id: ParameterId, value: T | null): ParameterEntry<T> {
  return { id, symbol: id, unit: '—', value, confidence: value === null ? 'undetermined' : 'provisional', source: 'テスト用の任意の値' };
}

const FOOT_DIMENSIONS: Vec3 = [0.26, 0.1, 0.08];

const parameters: ParameterSet = {
  ballMass: entry('P-01', 0.43),
  ballRadius: entry('P-02', 0.11),
  ballInertiaCoefficient: entry('P-03', 2 / 3),
  footMass: entry('P-04', 1.2),
  footInertiaBody: entry('P-05', boxInertia(1.2, FOOT_DIMENSIONS)),
  footDimensions: entry('P-06', FOOT_DIMENSIONS),
  restitution: entry('P-07', 0.5),
  friction: entry('P-08', 0.5),
  gravity: entry('P-09', 9.80665),
  airDensity: entry('P-10', 1.225),
  airViscosity: entry<number>('P-11', null),
  dragCoefficient: entry('P-12', 0.25),
  liftCoefficient: entry('P-13', 0.2),
  spinDecayLinear: entry('P-14', 1e-4),
  groundRestitution: entry('P-15', 0.6),
  groundFriction: entry('P-16', 0.6),
  rollingResistance: entry('P-17', 0.02),
  timeStep: entry('P-18', 0.005),
  restThresholds: entry('P-19', { rest: 0.2, stopSpeed: 0.05, stopSpin: 0.5 }),
  wind: entry<Vec3>('P-20', [0, 0, 0]),
  magnusThreshold: entry('P-21', 1e-9),
  torqueCoefficient: entry('P-22', 0.01),
  zeroSpeedThreshold: entry('P-23', 1e-6),
  zeroSpinThreshold: entry('P-24', 1e-6),
  tangentialSpeedThreshold: entry('P-25', 1e-9),
  rollReferenceThreshold: entry('P-26', 1e-6),
  verticalLaunchThreshold: entry('P-27', 1e-6),
  diagnosticRelativeTolerance: entry('P-28', 1e-9),
};

/** ボールの後ろ下から、前方やや上へ蹴る入力。 */
const input: KickInput = {
  contactDirection: [-1, -0.3, 0.1],
  footRollAboutNormal: -Math.PI / 2,
  footContactLocation: [0.02, 0.01],
  footContactPointVelocity: [20, 4, -1],
  footAngularVelocity: [0, 0, 5],
  footModel: 'finite-mass',
};

const EVENT_TIME_TOLERANCE = 1e-9; // δ_t（仮置き、06 §3 の TOL-C）

const settings: SimulationSettings = {
  maxTime: 10,
  eventTimeTolerance: EVENT_TIME_TOLERANCE,
  forces: { gravity: true, drag: true, magnus: true, spinDecay: 'linear' },
  ground: 'bounce-and-roll',
};

function withValue<K extends keyof ParameterSet>(key: K, value: ParameterSet[K]['value']): ParameterSet {
  return { ...parameters, [key]: { ...parameters[key], value } };
}

function run(i: KickInput = input, p: ParameterSet = parameters, s: SimulationSettings = settings) {
  const result = simulateKick(i, p, s);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function expectSameArray(a: Float64Array, b: Float64Array): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) expect.fail(`element ${i} differs: ${a[i]} vs ${b[i]}`);
  }
}

function expectSameTrajectory(a: Trajectory, b: Trajectory): void {
  expectSameArray(a.time, b.time);
  expectSameArray(a.position, b.position);
  expectSameArray(a.linearVelocity, b.linearVelocity);
  expectSameArray(a.orientation, b.orientation);
  expectSameArray(a.angularVelocity, b.angularVelocity);
  expect(a.events).toEqual(b.events);
}

describe('simulateKick', () => {
  it('VER-S01: returns bit-identical results for the same input in the same environment', () => {
    for (const ground of ['stop-at-first-contact', 'bounce-and-roll'] as const) {
      const a = run(input, parameters, { ...settings, ground });
      const b = run(input, parameters, { ...settings, ground });
      expectSameTrajectory(a.trajectory, b.trajectory);
      expect(a.impact).toEqual(b.impact);
      expect(a.metrics).toEqual(b.metrics);
      expect(a.warnings).toEqual(b.warnings);
    }
  });

  it('VER-S02: the first trajectory sample is exactly the ballAfter of the stage API solveImpact', () => {
    const result = run();
    const setup = buildImpactSetup(input, {
      ball: { mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 },
      foot: { mass: 1.2, inertiaBody: boxInertia(1.2, FOOT_DIMENSIONS), shape: { kind: 'box', dimensions: FOOT_DIMENSIONS } },
      rollReferenceThreshold: 1e-6,
    });
    if (!setup.ok) throw new Error(setup.error.message);
    const impact = solveImpact(setup.value, {
      ball: { mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 },
      foot: { mass: 1.2, inertiaBody: boxInertia(1.2, FOOT_DIMENSIONS), shape: { kind: 'box', dimensions: FOOT_DIMENSIONS } },
      restitution: 0.5, friction: 0.5, tangentialSpeedThreshold: 1e-9, diagnosticRelativeTolerance: 1e-9,
    }, 'finite-mass');
    if (!impact.ok) throw new Error(impact.error.message);
    expect(result.impact).toEqual(impact.value);
    expect(result.trajectory.time[0]).toBe(0);
    expect(stateAt(result.trajectory, 0)).toEqual(result.impact.ballAfter);
    // 測定値の打ち出しの値も ballAfter から求まる。
    const v = result.impact.ballAfter.linearVelocity;
    expect(result.metrics.launchSpeed).toBe(Math.hypot(...v));
  });

  it('keeps the input, parameter set (with metadata) and settings in the result', () => {
    const result = run();
    expect(result.input).toBe(input);
    expect(result.parameters).toBe(parameters);
    expect(result.settings).toBe(settings);
    expect(result.modelVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('lands at t = 2 v_y⁺ / g in vacuum when only gravity is on (TOL-C)', () => {
    const vacuum: SimulationSettings = {
      ...settings, forces: { gravity: true, drag: false, magnus: false, spinDecay: 'none' }, ground: 'stop-at-first-contact',
    };
    const result = run(input, parameters, vacuum);
    const vy = result.impact.ballAfter.linearVelocity[1];
    expect(vy).toBeGreaterThan(0);
    const expected = (2 * vy) / 9.80665;
    const landing = result.metrics.flightTime!;
    expect(landing).toBeGreaterThanOrEqual(expected - 1e-12);
    expect(landing).toBeLessThanOrEqual(expected + EVENT_TIME_TOLERANCE + 1e-12);
    expect(result.trajectory.events.at(-1)?.type).toBe('ground-contact');
  });

  it('bounces, rolls and stops with the ground model', () => {
    // 鉛直軸まわりの回転 ω_y は転がりで減衰しない（05 §8.2）ため、停止を確かめるには x–y 平面内のキックを使う。
    const planar: KickInput = {
      ...input, contactDirection: [-1, -0.3, 0], footContactLocation: [0, 0], footContactPointVelocity: [20, 4, 0], footAngularVelocity: [0, 0, 0],
    };
    const result = run(planar, parameters, { ...settings, maxTime: 120 });
    const types = result.trajectory.events.map((e) => e.type);
    expect(types).toContain('ground-contact');
    expect(types).toContain('roll-start');
    expect(types.at(-1)).toBe('stop');
    expect(result.metrics.totalDistance).not.toBeNull();
  });

  it('passes the impact warnings through without correcting the result', () => {
    const result = run();
    expect(result.warnings).toEqual(result.impact.diagnostics.warnings.map((code) => ({ stage: 'impact', code })));
  });

  describe('undetermined parameters', () => {
    it('lists every undetermined parameter that the run would use', () => {
      const p = { ...withValue('restitution', null), dragCoefficient: { ...parameters.dragCoefficient, value: null } };
      const result = simulateKick(input, p, settings);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('invalid-parameter');
      expect(result.error.details?.['missing']).toEqual(['P-07', 'P-12']);
    });

    it('does not require the values of disabled force terms or of the ground model when stopping at the first contact', () => {
      const p: ParameterSet = {
        ...parameters,
        airDensity: { ...parameters.airDensity, value: null },
        dragCoefficient: { ...parameters.dragCoefficient, value: null },
        liftCoefficient: { ...parameters.liftCoefficient, value: null },
        spinDecayLinear: { ...parameters.spinDecayLinear, value: null },
        torqueCoefficient: { ...parameters.torqueCoefficient, value: null },
        groundRestitution: { ...parameters.groundRestitution, value: null },
        groundFriction: { ...parameters.groundFriction, value: null },
        rollingResistance: { ...parameters.rollingResistance, value: null },
        restThresholds: { ...parameters.restThresholds, value: null },
        magnusThreshold: { ...parameters.magnusThreshold, value: null },
        zeroSpeedThreshold: { ...parameters.zeroSpeedThreshold, value: null },
        zeroSpinThreshold: { ...parameters.zeroSpinThreshold, value: null },
      };
      const s: SimulationSettings = {
        ...settings, forces: { gravity: true, drag: false, magnus: false, spinDecay: 'none' }, ground: 'stop-at-first-contact',
      };
      expect(simulateKick(input, p, s).ok).toBe(true);
    });

    it('requires each degeneracy threshold only with its force term (PR #12 review)', () => {
      const cases: Array<[keyof ParameterSet, SimulationSettings['forces'], ParameterId]> = [
        ['magnusThreshold', { gravity: true, drag: false, magnus: true, spinDecay: 'none' }, 'P-21'],
        ['zeroSpeedThreshold', { gravity: true, drag: true, magnus: false, spinDecay: 'none' }, 'P-23'],
        ['zeroSpinThreshold', { gravity: true, drag: false, magnus: false, spinDecay: 'torque-coefficient' }, 'P-24'],
      ];
      for (const [key, forces, id] of cases) {
        const result = simulateKick(input, withValue(key, null), { ...settings, forces });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.details?.['missing']).toEqual([id]);
      }
    });

    it('treats an undetermined P-27 as undefined spin components instead of an error', () => {
      const result = simulateKick(input, withValue('verticalLaunchThreshold', null), settings);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.metrics.spinComponents).toBeNull();
      expect(result.value.metrics.launchSpeed).toBeGreaterThan(0);
    });

    it('requires P-28 and passes it to the impact diagnostics', () => {
      const missing = simulateKick(input, withValue('diagnosticRelativeTolerance', null), settings);
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.error.details?.['missing']).toEqual(['P-28']);
      const invalid = simulateKick(input, withValue('diagnosticRelativeTolerance', Number.NaN), settings);
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) expect(invalid.error.code).toBe('invalid-parameter');
    });

    it.each<[keyof ParameterSet, number]>([
      ['magnusThreshold', Number.NaN], ['zeroSpeedThreshold', -1e-6], ['zeroSpinThreshold', Number.POSITIVE_INFINITY],
      ['verticalLaunchThreshold', Number.NaN],
    ])('rejects %s = %s as invalid-parameter (PR #12 review)', (key, value) => {
      const s: SimulationSettings = { ...settings, forces: { ...settings.forces, spinDecay: 'torque-coefficient' } };
      const result = simulateKick(input, withValue(key, value), s);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-parameter');
    });

    it('does not require the foot mass and inertia for the kinematic wall (PR #12 review)', () => {
      const p: ParameterSet = {
        ...parameters,
        footMass: { ...parameters.footMass, value: null },
        footInertiaBody: { ...parameters.footInertiaBody, value: null },
      };
      const wall = simulateKick({ ...input, footModel: 'kinematic-wall' }, p, settings);
      if (!wall.ok) throw new Error(wall.error.message);
      // 足の質量・慣性を使わないので、値があってもなくても結果は同じ。
      const withMass = simulateKick({ ...input, footModel: 'kinematic-wall' }, parameters, settings);
      if (!withMass.ok) throw new Error(withMass.error.message);
      expect(wall.value.impact).toEqual(withMass.value.impact);
      const finite = simulateKick(input, p, settings);
      expect(finite.ok).toBe(false);
      if (!finite.ok) expect(finite.error.details?.['missing']).toEqual(['P-04', 'P-05']);
    });

    it('requires the ground parameters for bounce-and-roll', () => {
      const result = simulateKick(input, withValue('restThresholds', null), settings);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.details?.['missing']).toEqual(['P-19']);
    });
  });

  describe('accepted ranges (05 §10.3, provisional)', () => {
    const r = ACCEPTED_RANGES;

    it('accepts values on the closed boundaries', () => {
      const speed = r.footContactPointSpeed.max;
      const atMax: KickInput = { ...input, footContactPointVelocity: [speed, 0, 0], contactDirection: [-1, 0, 0] };
      expect(simulateKick(atMax, parameters, settings).ok).toBe(true);
      expect(simulateKick(input, withValue('ballInertiaCoefficient', 1), settings).ok).toBe(true);
      expect(simulateKick(input, withValue('restitution', 1), settings).ok).toBe(true);
    });

    it.each<[string, KickInput]>([
      ['foot contact point speed', { ...input, footContactPointVelocity: [60.001, 0, 0], contactDirection: [-1, 0, 0] }],
      ['foot angular speed', { ...input, footAngularVelocity: [0, 0, 200.001] }],
    ])('rejects a %s above the range as invalid-input', (_, i) => {
      const result = simulateKick(i, parameters, settings);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-input');
    });

    it.each<[string, ParameterSet]>([
      ['κ above 1', withValue('ballInertiaCoefficient', 1.01)],
      ['ball mass below 0.1 kg', withValue('ballMass', 0.09)],
      ['ball radius above 0.3 m', withValue('ballRadius', 0.31)],
      ['foot mass above 50 kg', withValue('footMass', 51)],
      ['foot dimension below 0.01 m', withValue('footDimensions', [0.26, 0.009, 0.08])],
      ['friction above 2', withValue('friction', 2.1)],
      ['C_D above 2', withValue('dragCoefficient', 2.1)],
      ['C_L below −2', withValue('liftCoefficient', -2.1)],
      ['c_ω above 1', withValue('spinDecayLinear', 1.1)],
      ['μ_r above 1', withValue('rollingResistance', 1.1)],
      ['air density above 2', withValue('airDensity', 2.1)],
      ['gravity below 1', withValue('gravity', 0.9)],
      ['wind above 50 m/s', withValue('wind', [40, 0, 40])],
      ['Δt above 0.05 s', withValue('timeStep', 0.051)],
      ['a non-finite value', withValue('restitution', Number.NaN)],
    ])('rejects %s as invalid-parameter', (_, p) => {
      const result = simulateKick(input, p, settings);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-parameter');
    });

    it('accepts a C_L table of S and checks every coefficient value in it', () => {
      const lift = (points: [number, number][]) => withValue('liftCoefficient', { kind: 'spin-table', points });
      expect(simulateKick(input, lift([[0, 0], [0.25, 0.3], [1, 0.3]]), settings).ok).toBe(true);
      const result = simulateKick(input, lift([[0, 0], [0.25, 2.1]]), settings);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-parameter');
    });

    it.each<[string, [number, number][]]>([
      ['a NaN coefficient', [[0, Number.NaN]]],
      ['an infinite coefficient', [[0, 0], [0.25, Number.POSITIVE_INFINITY]]],
      ['a first spin parameter other than 0', [[0.1, 0]]],
    ])('rejects a C_L table with %s as invalid-coefficient (05 §7.4, IV-03-C2 D01)', (_, points) => {
      const result = simulateKick(input, withValue('liftCoefficient', { kind: 'spin-table', points }), settings);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-coefficient');
    });

    it('checks C_M only when the torque coefficient model is selected', () => {
      const p = withValue('torqueCoefficient', 1.1);
      expect(simulateKick(input, p, settings).ok).toBe(true);
      const result = simulateKick(input, p, { ...settings, forces: { ...settings.forces, spinDecay: 'torque-coefficient' } });
      expect(result.ok).toBe(false);
    });

    it.each<[string, SimulationSettings, ParameterSet]>([
      ['maxTime above 120 s', { ...settings, maxTime: 121 }, parameters],
      ['maxTime of 0', { ...settings, maxTime: 0 }, parameters],
      ['more than 1e6 steps', { ...settings, maxTime: 100 }, withValue('timeStep', 9e-5)],
    ])('rejects %s as invalid-setting', (_, s, p) => {
      const result = simulateKick(input, p, s);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-setting');
    });
  });

  it('returns the errors of the stages as they are (separating input)', () => {
    const result = simulateKick({ ...input, footContactPointVelocity: [-5, 0, 0] }, parameters, settings);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('separating-input');
  });
});
