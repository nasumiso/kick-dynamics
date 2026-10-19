// T1.3-08：転がりと停止（05 §8.1・§8.2）。VER-G03（純転がりの拘束）、G04（停止判定）、G05（転がり抵抗）、
// G06（転がりへの移行）と、総距離（05 §9）。係数・閾値はテスト用の任意の値（P-15〜P-17・P-19 は未決定）。
// 期待値は実装の式ではなく、接触点まわりの角運動量の保存、仕事とエネルギーの関係、05 §6.8 のソルバー（e_g = 0）から求める。
import { describe, expect, it } from 'vitest';
import { ballInertia, kineticEnergy } from '../../src/bodies/dynamics';
import type { BallParams, RigidBodyState } from '../../src/bodies/types';
import { pointVelocity } from '../../src/contact/solver';
import { simulateFlight, stateAt, type Trajectory } from '../../src/flight/trajectory';
import type { FlightSimulationSettings, GroundContactHandler } from '../../src/flight/types';
import { groundHandler, solveGroundBounce, type GroundParameters } from '../../src/ground/bounce';
import { advanceRolling } from '../../src/ground/rolling';
import { computeFlightMetrics } from '../../src/metrics/flight-metrics';
import { IDENTITY_QUAT, norm as quatNorm } from '../../src/math/quat';
import { add, cross, dot, length, scale, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';
import { allOff, ball, environment, thresholds } from '../flight/fixtures';

const g = environment.gravity;
const R = ball.radius;
const m = ball.mass;
const kappa = ball.inertiaCoefficient;
const DOWN: Vec3 = [0, -R, 0];
const UP: Vec3 = [0, 1, 0];

const params: GroundParameters = {
  gravity: g, restitution: 0.6, friction: 0.4, tangentialSpeedThreshold: 1e-9, // ε_t は P-25 の仮置き
  rollingResistance: 0.05, restSpeed: 0.3, stopSpeed: 0.01, stopSpin: 0.1,
};
const dt = 0.005;
const settings: FlightSimulationSettings = {
  timeStep: dt, maxTime: 60, eventTimeTolerance: 1e-9, forces: { ...allOff, gravity: true }, thresholds,
};

function handler(p: GroundParameters = params): GroundContactHandler {
  const h = groundHandler(ball, p);
  if (!h.ok) throw new Error(h.error.message);
  return h.value;
}

function run(start: RigidBodyState, p: GroundParameters = params, s: FlightSimulationSettings = settings): Trajectory {
  const r = simulateFlight(start, ball, environment, s, handler(p));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function onGround(v: Vec3, w: Vec3, position: Vec3 = [1, R, -2]): RigidBodyState {
  return { position, orientation: IDENTITY_QUAT, linearVelocity: v, angularVelocity: w };
}

/** 純転がりの角速度：u = v + ω × (−R ŷ) = 0 となる水平成分 (ŷ × v)/R に、鉛直成分 ω_y を加える。 */
function rollingSpin(v: Vec3, wy = 0): Vec3 {
  return add(scale(cross(UP, v), 1 / R), [0, wy, 0]);
}

/** 接触点 P = x_B − R ŷ まわりの角運動量 L_P = I ω + m (x_B − P) × v。 */
function angularMomentumAboutContact(s: RigidBodyState): Vec3 {
  const inertia = kappa * m * R * R;
  return add(scale(s.angularVelocity, inertia), scale(cross([0, R, 0], s.linearVelocity), m));
}

function totalKineticEnergy(s: RigidBodyState): number {
  return kineticEnergy({ mass: m, inertiaWorld: ballInertia(ball) }, s);
}

/** 状態を Δt 刻みで n 回進めた列（先頭は初期状態）。 */
function rollSteps(start: RigidBodyState, p: GroundParameters, n: number): RigidBodyState[] {
  const states = [start];
  for (let i = 0; i < n; i++) states.push(advanceRolling(states[i]!, ball, p, dt));
  return states;
}

describe('VER-G03 pure rolling keeps the contact point at rest', () => {
  for (const wy of [0, 5]) {
    it(`keeps u = 0, y = R and v_y = 0 while rolling (ω_y = ${wy})`, () => {
      const v: Vec3 = [3, 0, -1.2];
      for (const s of rollSteps(onGround(v, rollingSpin(v, wy)), params, 600)) {
        expectAllClose(pointVelocity(s, DOWN), [0, 0, 0]);
        expect(s.position[1]).toBe(R);
        expect(s.linearVelocity[1]).toBe(0);
        expectClose(s.angularVelocity[1], wy); // ω_y は変わらない
        expectClose(quatNorm(s.orientation), 1);
      }
    });
  }

  it('reaches pure rolling after sliding, and keeps it afterwards', () => {
    const states = rollSteps(onGround([5, 0, 1], [2, -3, -10]), params, 400);
    const slipping = states.findIndex((s) => length(pointVelocity(s, DOWN)) <= 1e-12);
    expect(slipping).toBeGreaterThan(0);
    for (const s of states.slice(slipping)) expectAllClose(pointVelocity(s, DOWN), [0, 0, 0]);
  });
});

describe('sliding on the ground (05 §8.2)', () => {
  // 動摩擦力は接触点に働き、重力と垂直抗力は接触点まわりのトルクを持たないため、滑りの間 L_P は保存する。
  // μ_r = 0 なら純転がりでも水平の力が働かないため、全区間で保存する。
  const frictionOnly: GroundParameters = { ...params, rollingResistance: 0 };

  it('conserves the angular momentum about the contact point while sliding', () => {
    const start = onGround([5, 0, 1], [2, -3, -10]);
    const before = angularMomentumAboutContact(start);
    for (const s of rollSteps(start, frictionOnly, 400)) expectAllClose(angularMomentumAboutContact(s), before);
  });

  it('ends a non-spinning slide at v = v₀ / (1 + κ), in the direction of v₀', () => {
    const v0: Vec3 = [6, 0, -2];
    const states = rollSteps(onGround(v0, [0, 0, 0]), frictionOnly, 400);
    expectAllClose(states.at(-1)!.linearVelocity, scale(v0, 1 / (1 + kappa)));
  });

  it('dissipates energy only by friction: ΔT = −μ_g m g × (slip distance)', () => {
    // 接触点の速度の向きは一定で、大きさは時間に比例して減る（du/dt = −μ_g g (1 + 1/κ) û）。滑った距離は |u₀|² / (2 μ_g g (1 + 1/κ))。
    const start = onGround([5, 0, 1], [2, -3, -10]);
    const u0 = length(pointVelocity(start, DOWN));
    const end = rollSteps(start, frictionOnly, 400).at(-1)!;
    const slipDistance = (u0 * u0) / (2 * params.friction * g * (1 + 1 / kappa));
    expectClose(totalKineticEnergy(end) - totalKineticEnergy(start), -params.friction * m * g * slipDistance);
  });

  it('leaves a sliding state unchanged for a zero duration', () => {
    const start = onGround([5, 0, 1], [2, -3, -10]);
    expect(advanceRolling(start, ball, params, 0)).toBe(start);
  });

  it('keeps sliding without force when μ_g = 0', () => {
    const start = onGround([5, 0, 1], [2, -3, -10]);
    const end = advanceRolling(start, ball, { ...params, friction: 0, rollingResistance: 0 }, 1);
    expectAllClose(end.linearVelocity, start.linearVelocity);
    expectAllClose(end.angularVelocity, start.angularVelocity);
    expectAllClose(end.position, add(start.position, start.linearVelocity));
  });
});

describe('VER-G05 rolling resistance', () => {
  const v0: Vec3 = [3, 0, -1.2];
  const speed0 = length(v0);
  const start = onGround(v0, rollingSpin(v0));
  const states = rollSteps(start, params, 300);
  const deceleration = (params.rollingResistance * g) / (1 + kappa);

  it('decelerates at μ_r g / (1 + κ) in a fixed direction', () => {
    states.forEach((s, i) => {
      expectAllClose(s.linearVelocity, scale(v0, (speed0 - deceleration * i * dt) / speed0));
    });
  });

  it('satisfies the work–energy balance: ΔT = −μ_r m g × (distance), static friction does no work', () => {
    for (const s of states) {
      const distance = length(sub(s.position, start.position));
      expectClose(totalKineticEnergy(s) - totalKineticEnergy(start), -params.rollingResistance * m * g * distance);
    }
  });

  it('comes to rest at distance v₀² / (2a) and stays there', () => {
    const rest = advanceRolling(start, ball, params, speed0 / deceleration + 1);
    expectAllClose(rest.linearVelocity, [0, 0, 0]);
    expectAllClose(rest.angularVelocity, [0, 0, 0]);
    expectAllClose(rest.position, add(start.position, scale(v0, speed0 / (2 * deceleration))));
  });
});

describe('VER-G04 stop detection', () => {
  const v0: Vec3 = [2, 0, 0];
  const deceleration = (params.rollingResistance * g) / (1 + kappa);
  // 純転がりでは |ω| = |v| / R なので、停止条件は |v| < min(v_stop, R ω_stop)。
  const threshold = Math.min(params.stopSpeed, R * params.stopSpin);
  const exact = (length(v0) - threshold) / (deceleration * dt);
  const expectedStep = Math.floor(exact) + 1;

  it('stops at the end of the first step that satisfies the stop condition', () => {
    expect(exact - Math.floor(exact)).toBeGreaterThan(1e-3); // 境界から離れた構成であることの確認
    const t = run(onGround(v0, rollingSpin(v0)));
    expect(t.events.map((e) => e.type)).toEqual(['start-on-ground', 'roll-start', 'stop']);
    expect(t.events[0]).toMatchObject({ response: 'roll' });
    const stop = t.events[2]!;
    expect(stop.time).toBe(expectedStep * dt);
    expect(stop.sampleIndex).toBe(t.time.length - 1);
    // 1 ステップ前は停止条件を満たさない
    const before = stateAt(t, stop.sampleIndex - 1);
    expect(length(before.linearVelocity) >= params.stopSpeed || length(before.angularVelocity) >= params.stopSpin).toBe(true);
  });

  it('reports the total distance to the stop position (05 §9)', () => {
    const t = run(onGround(v0, rollingSpin(v0)));
    const time = expectedStep * dt;
    const metrics = computeFlightMetrics(t, { verticalLaunchThreshold: 1e-6 });
    expectClose(metrics.totalDistance!, length(v0) * time - 0.5 * deceleration * time * time);
    expect(metrics.carry).toBeNull(); // 開始時刻の地面上の処理は最初の接地に含めない
  });

  for (const [name, start, p] of [
    ['ω_y ≠ 0', onGround(v0, rollingSpin(v0, 3)), params],
    ['μ_r = 0', onGround(v0, rollingSpin(v0)), { ...params, rollingResistance: 0 }],
  ] as const) {
    it(`ends with max-time when the ball cannot stop (${name})`, () => {
      const t = run(start, p, { ...settings, maxTime: 10 });
      expect(t.events.map((e) => e.type)).toEqual(['start-on-ground', 'roll-start', 'max-time']);
      expect(t.events[2]!.time).toBe(2000 * dt);
      expect(computeFlightMetrics(t, { verticalLaunchThreshold: 1e-6 }).totalDistance).toBeNull();
    });
  }
});

describe('VER-G06 transition to rolling', () => {
  // 高さ h₀ から落とすと、接地時の法線速度は √(2 g h₀)。
  function drop(impactSpeed: number, v: Vec3, w: Vec3): RigidBodyState {
    const h0 = (impactSpeed * impactSpeed) / (2 * g);
    return { position: [0, R + h0, 0], orientation: IDENTITY_QUAT, linearVelocity: v, angularVelocity: w };
  }

  it('solves an e_g = 0 impact (with the tangential impulse) and then sets y = R, v_y = 0 when |u_n⁻| ≤ v_rest', () => {
    const t = run(drop(0.2, [1.5, 0, 0.4], [3, 1, 8]), params, { ...settings, maxTime: 0.5 });
    const contact = t.events[0]!;
    expect(contact).toMatchObject({ type: 'ground-contact', response: 'roll' });
    expect(t.events[1]).toEqual({ type: 'roll-start', time: contact.time, sampleIndex: contact.sampleIndex + 1 });
    const raw = stateAt(t, contact.sampleIndex);
    const projected: RigidBodyState = { ...raw, position: [raw.position[0], R, raw.position[2]] };
    const settle = solveGroundBounce(projected, ball, { ...params, restitution: 0 });
    if (!settle.ok) throw new Error(settle.error.message);
    expect(settle.value.regime).toBe('slide'); // 接線方向の衝撃を含む
    const after = stateAt(t, contact.sampleIndex + 1);
    expectAllClose(after.angularVelocity, settle.value.ballAfter.angularVelocity);
    expectAllClose([after.linearVelocity[0], after.linearVelocity[2]], [settle.value.ballAfter.linearVelocity[0], settle.value.ballAfter.linearVelocity[2]]);
    expect(after.position[1]).toBe(R);
    expect(after.linearVelocity[1]).toBe(0);
    // その後は地面上を転がる
    for (let i = contact.sampleIndex + 1; i < t.time.length; i++) expect(stateAt(t, i).position[1]).toBe(R);
  });

  it('bounces when |u_n⁻| > v_rest', () => {
    const t = run(drop(0.5, [1.5, 0, 0.4], [3, 1, 8]), params, { ...settings, maxTime: 0.2 });
    expect(t.events[0]).toMatchObject({ type: 'ground-contact', response: 'continue' });
  });

  it('always rolls when e_g = 0', () => {
    const t = run(drop(5, [1.5, 0, 0.4], [3, 1, 8]), { ...params, restitution: 0 }, { ...settings, maxTime: 1.5 });
    expect(t.events.slice(0, 2).map((e) => e.type)).toEqual(['ground-contact', 'roll-start']);
  });

  it('rolls from the start time when the ball starts on the ground with v_y = 0 (05 §7.7)', () => {
    const t = run(onGround([2, 0, 0], [0, 0, 0]), params, { ...settings, maxTime: 0.1 });
    expect(t.events.slice(0, 2)).toEqual([
      { type: 'start-on-ground', time: 0, sampleIndex: 0, projectionEnergy: 0, response: 'roll' },
      { type: 'roll-start', time: 0, sampleIndex: 1 },
    ]);
  });
});

describe('a kick that flies, bounces, rolls and stops', () => {
  it('ends with a stop event after several bounces, keeping unit quaternions and the ground constraint', () => {
    const drag = { enabled: true, coefficient: { kind: 'constant', value: 0.25 } } as const;
    const t = run(
      { position: [0, R, 0], orientation: IDENTITY_QUAT, linearVelocity: [18, 7, 1], angularVelocity: [0, 0, -20] },
      params, { ...settings, forces: { ...allOff, gravity: true, drag } },
    );
    const types = t.events.map((e) => e.type);
    expect(types.at(-1)).toBe('stop');
    expect(types.filter((e) => e === 'ground-contact').length).toBeGreaterThan(2);
    const rollStart = t.events.find((e) => e.type === 'roll-start')!;
    for (let i = 0; i < t.time.length; i++) {
      expectClose(quatNorm(stateAt(t, i).orientation), 1);
      if (i >= rollStart.sampleIndex) expect(stateAt(t, i).position[1]).toBe(R);
    }
    const metrics = computeFlightMetrics(t, { verticalLaunchThreshold: 1e-6 });
    expect(metrics.totalDistance!).toBeGreaterThan(metrics.carry!);
  });
});

describe('ground parameter validation', () => {
  it('rejects μ_r that pure rolling cannot sustain: κ μ_r / (1 + κ) > μ_g (05 §8.2)', () => {
    const limit = (params.friction * (1 + kappa)) / kappa;
    expect(groundHandler(ball, { ...params, rollingResistance: limit * 1.001 }).ok).toBe(false);
    expect(groundHandler(ball, { ...params, rollingResistance: limit * 0.999 }).ok).toBe(true);
  });

  it.each([
    ['restitution', { restitution: 1.1 }], ['friction', { friction: -0.1 }], ['rolling resistance', { rollingResistance: Number.NaN }],
    ['rest speed', { restSpeed: -1 }], ['stop speed', { stopSpeed: Infinity }], ['zero stop speed', { stopSpeed: 0 }], ['stop spin', { stopSpin: -1 }], ['zero stop spin', { stopSpin: 0 }], ['gravity', { gravity: 0 }],
  ] as const)('rejects an invalid %s', (_, patch) => {
    const r = groundHandler(ball, { ...params, ...patch });
    expect(!r.ok && r.error.code).toBe('invalid-parameter');
  });

  it('rejects e_g v_rest < g Δt / 2 at a ground contact (05 §7.7)', () => {
    const tooSmall = { ...params, restSpeed: (0.99 * g * dt) / (2 * params.restitution) };
    const r = simulateFlight(onGround([1, -1, 0], [0, 0, 0], [0, R + 0.5, 0]), ball, environment, settings, handler(tooSmall));
    expect(!r.ok && r.error.code).toBe('invalid-parameter');
  });

  it('checks the velocity direction used for u_n⁻: n = ŷ, so u_n⁻ = v_y', () => {
    const s = onGround([1, -0.2, 0.5], [4, -2, 7]);
    expectClose(dot(pointVelocity(s, DOWN), UP), s.linearVelocity[1]);
  });
});

// IV-05-C2（verification/independent/IV-05/comparison-rolling.md）で Codex が独立に求めた期待値。照合の時点では実装を
// 実行できず静的な照合だけだったため、ここで実行して確かめる（IV-05-R2）。値はすべて二進で正確に表せる合成値。
describe('IV-05-C2 independent cases', () => {
  it('settles with an e_g = 0 impact, not an e_g = 1/2 one, at |u_n⁻| = v_rest (fractional example)', () => {
    const unit: BallParams = { mass: 1, radius: 1, inertiaCoefficient: 2 / 5 };
    const p: GroundParameters = {
      gravity: 10, restitution: 1 / 2, friction: 1 / 5, tangentialSpeedThreshold: 1e-9,
      rollingResistance: 0, restSpeed: 1, stopSpeed: 0.01, stopSpin: 0.01,
    };
    const h = groundHandler(unit, p);
    if (!h.ok) throw new Error(h.error.message);
    const state: RigidBodyState = { position: [0, 1, 0], orientation: IDENTITY_QUAT, linearVelocity: [1, -1, 0], angularVelocity: [0, 7, 0] };
    const r = h.value({ time: 0, state, atStart: false, timeStep: 1 / 10 }); // e_g v_rest = g Δt / 2（等号）
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.kind).toBe('roll');
    if (r.value.kind !== 'roll') return;
    expectAllClose(r.value.state.linearVelocity, [4 / 5, 0, 0]);
    expectAllClose(r.value.state.angularVelocity, [0, 7, -1 / 2]);
  });

  describe('stop events on the time grid (m = R = κ = 1, g = 8, μ_g = μ_r = 1/4, Δt = 1/4, deceleration 1)', () => {
    const unit: BallParams = { mass: 1, radius: 1, inertiaCoefficient: 1 };
    const p: GroundParameters = {
      gravity: 8, restitution: 1 / 2, friction: 1 / 4, tangentialSpeedThreshold: 1e-9,
      rollingResistance: 1 / 4, restSpeed: 2, stopSpeed: 1 / 2, stopSpin: 1,
    };
    const gridSettings: FlightSimulationSettings = {
      timeStep: 1 / 4, maxTime: 5, eventTimeTolerance: 1e-9, forces: { ...allOff, gravity: true }, thresholds,
    };
    function simulate(start: RigidBodyState, overrides: Partial<GroundParameters> = {}): Trajectory {
      const h = groundHandler(unit, { ...p, ...overrides });
      if (!h.ok) throw new Error(h.error.message);
      const r = simulateFlight(start, unit, { ...environment, gravity: 8 }, gridSettings, h.value);
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    }
    const state = (y: number, vx: number): RigidBodyState => ({
      position: [0, y, 0], orientation: IDENTITY_QUAT, linearVelocity: [vx, 0, 0], angularVelocity: [0, 0, -vx],
    });

    it('does not stop on the strict boundary |v| = v_stop, but at the next grid time (3/4 s)', () => {
      const t = simulate(state(1, 1));
      expect(t.events.map((e) => e.type)).toEqual(['start-on-ground', 'roll-start', 'stop']);
      expect(t.events[2]!.time).toBe(3 / 4);
    });

    it('stops at the end of the step after a mid-step transition to rolling (contact at 1/8 s, stop at 1/4 s, 15/128 m)', () => {
      const t = simulate(state(1 + 1 / 16, 1 / 2), { stopSpeed: 2 / 5 });
      expect(t.events.map((e) => e.type)).toEqual(['ground-contact', 'roll-start', 'stop']);
      expectClose(t.events[0]!.time, 1 / 8, { relative: 0, absolute: 1e-9 }); // 二分法の打ち切り幅 δ_t（TOL-C）
      expect(t.events[2]!.time).toBe(1 / 4);
      expectClose(computeFlightMetrics(t, { verticalLaunchThreshold: 1e-6 }).totalDistance!, 15 / 128, { relative: 1e-12, absolute: 1e-8 });
    });

    it('checks the stop at the next step when the contact falls on a grid time (contact at 1/4 s, stop at 1/2 s, 7/32 m)', () => {
      const t = simulate(state(1 + 1 / 4, 1 / 2), { stopSpeed: 2 / 5 });
      expect(t.events.map((e) => e.type)).toEqual(['ground-contact', 'roll-start', 'stop']);
      expect(t.events[0]!.time).toBe(1 / 4);
      expect(t.events[2]!.time).toBe(1 / 2);
      expectClose(computeFlightMetrics(t, { verticalLaunchThreshold: 1e-6 }).totalDistance!, 7 / 32);
    });

    it('can stop with a non-zero ω_y below ω_stop, and cannot with |ω_y| = ω_stop', () => {
      const spinning = (wy: number): RigidBodyState => ({ ...state(1, 1), angularVelocity: [0, wy, -1] });
      expect(simulate(spinning(1 / 2)).events.at(-1)!.type).toBe('stop');
      expect(simulate(spinning(1)).events.at(-1)!.type).toBe('max-time');
    });
  });
});
