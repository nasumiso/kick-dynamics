// VER-F09（回転の保存）、VER-F11（姿勢積分の精度）、VER-F13（線形の回転減衰）、
// VER-F06 のうち 05 §7.5 (c) の縮退、VER-M03 のうち長時間の積分での四元数のノルムの保持。
// c_ω・C_M・C_D・C_L はテスト用の任意の値（05 §10 の P-12〜P-14・P-22 は未決定）。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { computeForces } from '../../src/flight/forces';
import { integrateFixedSteps } from '../../src/flight/integrator';
import type { CoefficientModel, FlightForceSettings } from '../../src/flight/types';
import { fromAxisAngle, IDENTITY_QUAT, multiply, norm, normalize as normalizeQuat, rotate, type Quat } from '../../src/math/quat';
import { cross, dot, length, normalize, scale, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose, TOL_A } from '../tolerance';
import { allOff, ball, environment, settingsWith, thresholds } from './fixtures';

const ORDER_TOLERANCE = 0.5; // 仮置き（TOL-B の判定幅、06 §3）
const inertia = ball.inertiaCoefficient * ball.mass * ball.radius * ball.radius; // I_B = κ m R²

function body(velocity: Vec3, angularVelocity: Vec3, orientation: Quat = IDENTITY_QUAT): RigidBodyState {
  return { position: [0, 5, 0], orientation, linearVelocity: velocity, angularVelocity };
}

function integrate(initial: RigidBodyState, steps: number, dt: number, forces: Partial<FlightForceSettings>): RigidBodyState[] {
  const result = integrateFixedSteps(initial, steps, ball, environment, settingsWith(forces, dt));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** 四元数 q と −q を区別しない距離。 */
function rotationDistance(a: Quat, b: Quat): number {
  const minus = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
  const plus = Math.hypot(a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]);
  return Math.min(minus, plus);
}

function orders(errors: readonly number[]): number[] {
  return errors.slice(1).map((e, i) => Math.log2(errors[i]! / e));
}

const aero: Partial<FlightForceSettings> = {
  gravity: true,
  drag: { enabled: true, coefficient: { kind: 'constant', value: 0.25 } },
  magnus: { enabled: true, coefficient: { kind: 'function', evaluate: (_re, s) => 0.8 * s } },
};

describe('VER-F09 conservation of spin without spin decay', () => {
  it('keeps ω constant under gravity, drag and Magnus force', () => {
    const w0: Vec3 = [12, -40, 25];
    for (const s of integrate(body([24, 9, -5], w0), 200, 0.01, aero)) {
      expectAllClose(s.angularVelocity, w0);
    }
  });
});

describe('VER-F11 attitude integration', () => {
  const w: Vec3 = [3, -8, 17];
  const q0 = normalizeQuat([0.2, 0.1, -0.4, 0.9]);

  it('converges to q(t) = exp(½ ω̂ t) ⊗ q0 at fourth order', () => {
    const duration = 1;
    const exact = multiply(fromAxisAngle(normalize(w), length(w) * duration), q0);
    const errors = [50, 100, 200, 400].map((steps) => rotationDistance(integrate(body([0, 0, 0], w, q0), steps, duration / steps, {}).at(-1)!.orientation, exact));
    for (const order of orders(errors)) expect(Math.abs(order - 4)).toBeLessThan(ORDER_TOLERANCE);
  });

  it('rotates in the right-handed sense about the world-frame ω (ADR-0005)', () => {
    // ω ∥ +z（ワールド）：物体の +x 軸は +y の向きへ回る。物体が傾いていても、回転軸はワールドの z。
    const tilted = fromAxisAngle([1, 0, 0], 0.7);
    const states = integrate(body([0, 0, 0], [0, 0, 2], tilted), 10, 0.01, {});
    const before = rotate(tilted, [1, 0, 0]);
    const after = rotate(states.at(-1)!.orientation, [1, 0, 0]);
    expect(cross(before, after)[2]).toBeGreaterThan(0);
    // ワールドの z 軸まわりの回転なので、z 成分は変わらない。RK4 の 1 ステップは、ワールドの z 軸まわりの
    // 回転の四元数を左から掛けることの定数倍になり、正規化の後は厳密に z 軸まわりの回転になるため TOL-A で比べる。
    const zAxisBefore = rotate(tilted, [0, 0, 1]);
    expectClose(rotate(states.at(-1)!.orientation, [0, 0, 1])[2], zAxisBefore[2]);
  });

  it('keeps |q| = 1 within TOL-A over a long integration (VER-M03)', () => {
    const states = integrate(body([0, 0, 0], [60, -150, 90], q0), 20000, 0.005, {});
    for (const s of states) expectClose(norm(s.orientation), 1);
  });
});

describe('VER-F13 linear spin decay', () => {
  const c = 0.0035; // c_ω kg·m²/s（時定数 I_B / c_ω ≈ 1 s）
  const w0: Vec3 = [-20, 35, 60];

  it('matches ω(t) = ω0 exp(−c_ω t / I_B) at fourth order and keeps the direction', () => {
    const duration = 2;
    const exact = scale(w0, Math.exp((-c * duration) / inertia));
    const runs = [25, 50, 100, 200].map((steps) => integrate(body([0, 0, 0], w0), steps, duration / steps, { spinDecay: { kind: 'linear', coefficient: c } }));
    const errors = runs.map((states) => Math.hypot(...states.at(-1)!.angularVelocity.map((v, i) => v - exact[i]!)));
    for (const order of orders(errors)) expect(Math.abs(order - 4)).toBeLessThan(ORDER_TOLERANCE);
    for (const states of runs) {
      for (const s of states) {
        const sine = length(cross(s.angularVelocity, w0)) / (length(s.angularVelocity) * length(w0));
        expect(sine).toBeLessThanOrEqual(TOL_A.absolute);
        expect(dot(s.angularVelocity, w0)).toBeGreaterThan(0);
      }
    }
  });

  it('applies even when the ball does not move relative to the air', () => {
    const states = integrate(body([0, 0, 0], w0), 10, 0.01, { spinDecay: { kind: 'linear', coefficient: c } });
    expect(length(states.at(-1)!.angularVelocity)).toBeLessThan(length(w0));
  });

  it('rejects a negative or non-finite c_ω as a SimResult error', () => {
    for (const coefficient of [-1e-4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = computeForces(body([20, 0, 0], w0), ball, environment, { ...allOff, spinDecay: { kind: 'linear', coefficient } }, thresholds);
      expect(!r.ok && r.error.code).toBe('invalid-coefficient');
    }
  });
});

describe('torque-coefficient spin decay (05 §7.5 (c)) and VER-F06', () => {
  const area = Math.PI * ball.radius * ball.radius;

  function torqueOf(state: RigidBodyState, coefficient: CoefficientModel): Vec3 {
    const r = computeForces(state, ball, environment, { ...allOff, spinDecay: { kind: 'torque-coefficient', coefficient } }, thresholds);
    if (!r.ok) throw new Error(r.error.message);
    return r.value.torque;
  }

  it('gives τ = −½ ρ A R C_M |v_r|² ω̂', () => {
    const v: Vec3 = [20, 5, -3];
    const w: Vec3 = [10, -20, 30];
    const magnitude = 0.5 * environment.airDensity * area * ball.radius * 0.01 * dot(v, v);
    expectAllClose(torqueOf(body(v, w), { kind: 'constant', value: 0.01 }), scale(normalize(w), -magnitude));
  });

  it('gives zero torque without evaluating C_M when |ω| ≤ ε_ω or |v_r| ≤ ε_v', () => {
    let calls = 0;
    const recording: CoefficientModel = { kind: 'function', evaluate: () => { calls++; return Number.NaN; } };
    expect(torqueOf(body([20, 5, -3], [0, 0, 0]), recording)).toEqual([0, 0, 0]);
    expect(torqueOf(body([20, 5, -3], [0, thresholds.zeroSpin, 0]), recording)).toEqual([0, 0, 0]);
    expect(torqueOf(body([0, 0, 0], [10, -20, 30]), recording)).toEqual([0, 0, 0]);
    expect(torqueOf(body([0, 0.5 * thresholds.zeroSpeed, 0], [10, -20, 30]), recording)).toEqual([0, 0, 0]);
    expect(calls).toBe(0);
  });

  it('rejects a negative or non-finite C_M as a SimResult error', () => {
    for (const value of [-0.01, Number.NaN]) {
      const r = computeForces(body([20, 0, 0], [0, 0, 30]), ball, environment,
        { ...allOff, spinDecay: { kind: 'torque-coefficient', coefficient: { kind: 'function', evaluate: () => value } } }, thresholds);
      expect(!r.ok && r.error.code).toBe('invalid-coefficient');
    }
  });

  it('reduces |ω| monotonically while keeping its direction in flight', () => {
    const w0: Vec3 = [12, -40, 25];
    const states = integrate(body([24, 9, -5], w0), 150, 0.01, { ...aero, spinDecay: { kind: 'torque-coefficient', coefficient: { kind: 'constant', value: 0.01 } } });
    for (let k = 1; k < states.length; k++) {
      expect(length(states[k]!.angularVelocity)).toBeLessThan(length(states[k - 1]!.angularVelocity));
      const sine = length(cross(states[k]!.angularVelocity, w0)) / (length(states[k]!.angularVelocity) * length(w0));
      expect(sine).toBeLessThanOrEqual(TOL_A.absolute);
    }
  });
});
