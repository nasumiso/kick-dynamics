// VER-F05（マグヌス力は仕事をしない）、VER-F06（空力の縮退）、VER-F07（鏡映対称性）、VER-F10（マグヌス力の符号）。
// C_L・C_D の値はテスト用の任意の値（05 §10 の P-12・P-13 は未決定）。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { computeForces } from '../../src/flight/forces';
import { integrateFixedSteps } from '../../src/flight/integrator';
import type { CoefficientModel, FlightForceSettings } from '../../src/flight/types';
import { IDENTITY_QUAT, type Quat } from '../../src/math/quat';
import { length, scale, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose } from '../tolerance';
import { allOff, ball, environment, settingsWith, thresholds } from './fixtures';

const CL = 0.2;
const ORDER_TOLERANCE = 0.5; // 仮置き（TOL-B の判定幅、06 §3）
const area = Math.PI * ball.radius * ball.radius;

function body(position: Vec3, velocity: Vec3, angularVelocity: Vec3, orientation: Quat = IDENTITY_QUAT): RigidBodyState {
  return { position, orientation, linearVelocity: velocity, angularVelocity };
}

function magnusOnly(coefficient: CoefficientModel = { kind: 'constant', value: CL }): FlightForceSettings {
  return { ...allOff, magnus: { enabled: true, coefficient } };
}

function forceOf(state: RigidBodyState, forces: FlightForceSettings): Vec3 {
  const r = computeForces(state, ball, environment, forces, thresholds);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.force;
}

describe('VER-F05 Magnus force does no work', () => {
  // ω = (0, 0, ω_z)、v_0 = (v, 0, 0)：力は常に xy 平面内で速度に垂直。ω は一定（トルクなし）なので ω ⊥ v が保たれる。
  // 厳密解：中心 (0, r, 0)、半径 r = 2m/(ρ A C_L) の等速円運動。
  const speed = 20;
  const radius = (2 * ball.mass) / (environment.airDensity * area * CL);
  const duration = 20;

  function circle(steps: number): RigidBodyState {
    const result = integrateFixedSteps(
      body([0, 0, 0], [speed, 0, 0], [0, 0, 30]), steps, ball, environment, settingsWith(magnusOnly(), duration / steps),
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.value[steps]!;
  }

  it('follows the circle of radius 2m/(ρ A C_L) at fourth order with constant speed', () => {
    const theta = (speed * duration) / radius;
    const exact: Vec3 = [radius * Math.sin(theta), radius * (1 - Math.cos(theta)), 0];
    const runs = [100, 200, 400, 800].map(circle);
    const positionErrors = runs.map((s) => length(sub(s.position, exact)));
    const speedErrors = runs.map((s) => Math.abs(length(s.linearVelocity) - speed));
    for (let i = 1; i < runs.length; i++) {
      expect(Math.abs(Math.log2(positionErrors[i - 1]! / positionErrors[i]!) - 4)).toBeLessThan(ORDER_TOLERANCE);
      // 速さの誤差は 4 次以上で減る（RK4 の回転に対する振幅誤差は 1 ステップで O(Δt⁶)）。
      expect(Math.log2(speedErrors[i - 1]! / speedErrors[i]!)).toBeGreaterThan(4 - ORDER_TOLERANCE);
    }
    for (const s of runs) expect(s.position[2]).toBe(0);
  });

  it('applies a force perpendicular to the relative velocity', () => {
    const state = body([0, 1, 0], [20, 5, -3], [4, -7, 30]);
    const f = forceOf(state, magnusOnly());
    const v = state.linearVelocity;
    expect(Math.abs(f[0] * v[0] + f[1] * v[1] + f[2] * v[2])).toBeLessThan(1e-12 * length(f) * length(v));
    expectAllClose([length(f)], [0.5 * environment.airDensity * area * CL * (20 * 20 + 5 * 5 + 3 * 3)]);
  });
});

describe('VER-F06 aerodynamic degeneracies', () => {
  function recordingCoefficient(): { model: CoefficientModel; calls: number } {
    const record = { calls: 0, model: undefined as unknown as CoefficientModel };
    record.model = { kind: 'function', evaluate: () => { record.calls++; return Number.NaN; } };
    return record;
  }

  it('gives zero Magnus force without evaluating C_L when ω = 0', () => {
    const c = recordingCoefficient();
    expect(forceOf(body([0, 1, 0], [20, 5, -3], [0, 0, 0]), magnusOnly(c.model))).toEqual([0, 0, 0]);
    expect(c.calls).toBe(0);
  });

  it('gives zero Magnus force when ω ∥ v_r, including round-off in ω × v_r', () => {
    const v: Vec3 = [20.3, 5.7, -3.1];
    for (const factor of [2, 3.7, -1.3]) {
      const c = recordingCoefficient();
      expect(forceOf(body([0, 1, 0], v, scale(v, factor)), magnusOnly(c.model))).toEqual([0, 0, 0]);
      expect(c.calls).toBe(0);
    }
  });

  it('gives zero drag and Magnus force without evaluating coefficients when |v_r| ≤ ε_v', () => {
    const drag = recordingCoefficient();
    const lift = recordingCoefficient();
    const forces: FlightForceSettings = { ...allOff, drag: { enabled: true, coefficient: drag.model }, magnus: { enabled: true, coefficient: lift.model } };
    for (const v of [[0, 0, 0], [thresholds.zeroSpeed, 0, 0], [0, -0.5 * thresholds.zeroSpeed, 0]] as const) {
      expect(forceOf(body([0, 1, 0], v, [10, -20, 30]), forces)).toEqual([0, 0, 0]);
    }
    expect(drag.calls + lift.calls).toBe(0);
  });

  it('measures the relative velocity against the wind', () => {
    // v = w のとき |v_r| = 0 なので、ボールが動いていても空気力は 0。
    const windy = { ...environment, wind: [5, 0, -2] as const };
    const r = computeForces(body([0, 1, 0], [5, 0, -2], [0, 0, 30]), ball, windy, magnusOnly(), thresholds);
    expect(r.ok && r.value.force).toEqual([0, 0, 0]);
  });

  it('rejects a non-finite C_L as a SimResult error', () => {
    for (const value of [Number.NaN, Number.NEGATIVE_INFINITY]) {
      const r = computeForces(body([0, 1, 0], [20, 0, 0], [0, 0, 30]), ball, environment, magnusOnly({ kind: 'function', evaluate: () => value }), thresholds);
      expect(!r.ok && r.error.code).toBe('invalid-coefficient');
    }
  });
});

describe('VER-F07 mirror symmetry about the xy plane', () => {
  // z → −z、角速度は擬ベクトルなので (ω_x, ω_y, ω_z) → (−ω_x, −ω_y, ω_z)。
  // 姿勢（回転）R → M R M（M = diag(1, 1, −1)）は、四元数では (q_x, q_y, q_z, q_w) → (−q_x, −q_y, q_z, q_w)。
  const mirrorVec = (v: readonly number[]): Vec3 => [v[0]!, v[1]!, -v[2]!];
  const mirrorSpin = (w: readonly number[]): Vec3 => [-w[0]!, -w[1]!, w[2]!];
  const mirrorQuat = (q: readonly number[]): Quat => [-q[0]!, -q[1]!, q[2]!, q[3]!];

  const coefficients: Array<[string, CoefficientModel]> = [
    ['constant C_L', { kind: 'constant', value: CL }],
    ['C_L proportional to S', { kind: 'function', evaluate: (_re, s) => 0.8 * s }],
  ];
  for (const [name, lift] of coefficients) {
    it(`mirrors the trajectory with gravity, drag and Magnus force (${name})`, () => {
      const forces: FlightForceSettings = {
        ...allOff, gravity: true, drag: { enabled: true, coefficient: { kind: 'constant', value: 0.25 } }, magnus: { enabled: true, coefficient: lift },
      };
      const q0: Quat = [0.1, -0.3, 0.2, Math.sqrt(1 - 0.14)];
      const original = body([0.2, 0.11, 0.7], [24, 9, -5], [12, -40, 25], q0);
      const mirrored = body(mirrorVec(original.position), mirrorVec(original.linearVelocity), mirrorSpin(original.angularVelocity), mirrorQuat(q0));
      const a = integrateFixedSteps(original, 150, ball, environment, settingsWith(forces, 0.01));
      const b = integrateFixedSteps(mirrored, 150, ball, environment, settingsWith(forces, 0.01));
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      a.value.forEach((s, k) => {
        const m = b.value[k]!;
        expectAllClose(m.position, mirrorVec(s.position));
        expectAllClose(m.linearVelocity, mirrorVec(s.linearVelocity));
        expectAllClose(m.angularVelocity, mirrorSpin(s.angularVelocity));
        expectAllClose(m.orientation, mirrorQuat(s.orientation));
      });
      // 鏡映が自明でない（横方向に曲がる）ことを確かめる。
      expect(Math.abs(a.value[150]!.position[2] - (0.7 - 5 * 1.5))).toBeGreaterThan(0.01);
    });
  }
});

describe('VER-F10 sign of the Magnus force', () => {
  it('pushes a ball flying along +x with backspin ω ∥ +z upward (+y)', () => {
    const f = forceOf(body([0, 1, 0], [25, 0, 0], [0, 0, 50]), magnusOnly());
    expect(f[0]).toBe(0);
    expect(f[1]).toBeGreaterThan(0);
    expect(f[2]).toBe(0);
  });

  it('pushes a ball flying along +x with side spin ω_y > 0 toward −z', () => {
    const f = forceOf(body([0, 1, 0], [25, 0, 0], [0, 50, 0]), magnusOnly());
    expect(f[0]).toBe(0);
    expect(f[1]).toBe(0);
    expect(f[2]).toBeLessThan(0);
  });
});
