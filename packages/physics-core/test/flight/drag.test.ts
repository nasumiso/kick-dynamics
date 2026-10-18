// VER-F03（抗力による散逸）、VER-F04（終端速度）。
//
// 解析解（05 §7.3 の抗力で、重力と抗力だけを入れた鉛直落下、初速 0）：
//   k = ρ A C_D / (2 m)、v_t = √(g / k) = √(2 m g / (ρ A C_D))
//   v_y(t) = −v_t tanh(g t / v_t)、y(t) = y_0 − (v_t² / g) ln cosh(g t / v_t)
//
// TOL-B の判定幅は未決定（06 §3）。ここでは、観測した収束次数が RK4 の理論次数 4 から
// ±0.5 以内であることを「仮置き」の判定とする。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { integrateFixedSteps } from '../../src/flight/integrator';
import type { FlightSettings } from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { dot, type Vec3 } from '../../src/math/vec3';
import { TOL_A } from '../tolerance';
import { ball, environment, settingsWith } from './fixtures';

const CD = 0.25; // テスト用の任意の値
const ORDER_TOLERANCE = 0.5; // 仮置き（TOL-B の判定幅）
const area = Math.PI * ball.radius * ball.radius;
const terminalSpeed = Math.sqrt((2 * ball.mass * environment.gravity) / (environment.airDensity * area * CD));
const g = environment.gravity;

function dragSettings(dt: number): FlightSettings {
  return settingsWith({ gravity: true, drag: { enabled: true, coefficient: { kind: 'constant', value: CD } } }, dt);
}

function state(position: Vec3, velocity: Vec3): RigidBodyState {
  return { position, orientation: IDENTITY_QUAT, linearVelocity: velocity, angularVelocity: [0, 0, 0] };
}

function energy(s: RigidBodyState): number {
  return 0.5 * ball.mass * dot(s.linearVelocity, s.linearVelocity) + ball.mass * g * s.position[1];
}

function fall(duration: number, dt: number): RigidBodyState {
  const steps = Math.round(duration / dt);
  const result = integrateFixedSteps(state([0, 100, 0], [0, 0, 0]), steps, ball, environment, dragSettings(dt));
  if (!result.ok) throw new Error(result.error.message);
  return result.value[steps]!;
}

function exactFall(t: number): { y: number; vy: number } {
  const u = (g * t) / terminalSpeed;
  return { y: 100 - ((terminalSpeed * terminalSpeed) / g) * Math.log(Math.cosh(u)), vy: -terminalSpeed * Math.tanh(u) };
}

function observedOrder(errorCoarse: number, errorFine: number): number {
  return Math.log2(errorCoarse / errorFine);
}

describe('VER-F04 terminal velocity', () => {
  it('converges to the closed-form vertical fall at fourth order', () => {
    const duration = 4;
    const exact = exactFall(duration);
    const errors = [0.04, 0.02, 0.01].map((dt) => {
      const s = fall(duration, dt);
      return Math.hypot(s.position[1] - exact.y, s.linearVelocity[1] - exact.vy);
    });
    expect(errors[2]!).toBeLessThan(errors[1]!);
    expect(Math.abs(observedOrder(errors[0]!, errors[1]!) - 4)).toBeLessThan(ORDER_TOLERANCE);
    expect(Math.abs(observedOrder(errors[1]!, errors[2]!) - 4)).toBeLessThan(ORDER_TOLERANCE);
  });

  it('approaches v_t = √(2mg/(ρ A C_D)) after many time constants', () => {
    // 時定数 v_t / g の約 11 倍で、tanh による残差は 1e-9 未満になる。
    const s = fall(30, 0.01);
    expect(Math.abs(-s.linearVelocity[1] / terminalSpeed - 1)).toBeLessThan(1e-8);
    expect(s.linearVelocity[0]).toBe(0);
    expect(s.linearVelocity[2]).toBe(0);
  });
});

describe('VER-F03 dissipation by drag', () => {
  it('never increases mechanical energy beyond round-off in an oblique launch', () => {
    const result = integrateFixedSteps(state([0, 0.11, 0], [22, 12, -4]), 400, ball, environment, dragSettings(0.01));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const energies = result.value.map(energy);
    for (let k = 1; k < energies.length; k++) {
      const increase = energies[k]! - energies[k - 1]!;
      expect(increase).toBeLessThanOrEqual(TOL_A.absolute + TOL_A.relative * Math.abs(energies[k - 1]!));
    }
    expect(energies.at(-1)!).toBeLessThan(energies[0]!);
  });

  it('energy lost matches the work done by drag with an error that shrinks at the integration order', () => {
    // 鉛直落下では、閉形式の y(t)・v_y(t) から求めた力学的エネルギーの減少量が抗力の仕事に等しい。
    const duration = 4;
    const exact = exactFall(duration);
    const exactEnergy = 0.5 * ball.mass * exact.vy * exact.vy + ball.mass * g * exact.y;
    const errors = [0.04, 0.02, 0.01].map((dt) => Math.abs(energy(fall(duration, dt)) - exactEnergy));
    expect(Math.abs(observedOrder(errors[0]!, errors[1]!) - 4)).toBeLessThan(ORDER_TOLERANCE);
    expect(Math.abs(observedOrder(errors[1]!, errors[2]!) - 4)).toBeLessThan(ORDER_TOLERANCE);
  });
});

describe('zero relative speed (05 §7.3)', () => {
  it('applies no drag and evaluates no coefficient when |v_r| ≤ ε_v', () => {
    let evaluated = false;
    const settings = settingsWith({
      gravity: false,
      drag: { enabled: true, coefficient: { kind: 'function', evaluate: () => { evaluated = true; return 0.25; } } },
    }, 0.01);
    const result = integrateFixedSteps(state([0, 1, 0], [0, 0, 0]), 5, ball, environment, settings);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[5]!.linearVelocity).toEqual([0, 0, 0]);
    expect(evaluated).toBe(false);
  });
});
