// T1.3-07：地面バウンド。VER-G01（鉛直バウンド）、VER-G02（斜め入射のバウンド、05 §6.8 の閉形式）、
// 衝突直後に v_y⁺ < 0 の場合の処理（05 §8.3）。e_g・μ_g はテスト用の任意の値（P-15・P-16 は未決定）。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { simulateFlight, stateAt } from '../../src/flight/trajectory';
import type { FlightSimulationSettings } from '../../src/flight/types';
import { groundBounceHandler, solveGroundBounce } from '../../src/ground/bounce';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { add, cross, length, scale, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';
import { allOff, environment, thresholds } from '../flight/fixtures';
import { ball } from '../contact/fixtures';

const EPS_T = 1e-9; // P-25（仮置き）
const coefficients = (eg: number, mug: number) => ({ restitution: eg, friction: mug, tangentialSpeedThreshold: EPS_T });

function onGround(v: Vec3, w: Vec3 = [0, 0, 0]): RigidBodyState {
  return { position: [1.5, ball.radius, -0.7], orientation: IDENTITY_QUAT, linearVelocity: v, angularVelocity: w };
}

function bounce(state: RigidBodyState, eg: number, mug: number) {
  const r = solveGroundBounce(state, ball, coefficients(eg, mug));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('VER-G01 vertical bounce', () => {
  for (const [eg, mug] of [[0.6, 0], [0.6, 0.5], [1, 2], [0.2, 0.3]] as const) {
    it(`gives v_y⁺ = −e_g v_y⁻ and leaves the horizontal velocity and spin unchanged (e_g = ${eg}, μ_g = ${mug})`, () => {
      const r = bounce(onGround([0, -7, 0]), eg, mug);
      expectAllClose(r.ballAfter.linearVelocity, [0, eg * 7, 0]);
      expectAllClose(r.ballAfter.angularVelocity, [0, 0, 0]);
      expectAllClose(r.ballAfter.position, [1.5, ball.radius, -0.7]);
    });
  }
});

describe('VER-G02 oblique bounce against the closed form of 05 §6.8', () => {
  const kappa = ball.inertiaCoefficient;
  const m = ball.mass;
  const R = ball.radius;
  // 閉形式（非連成、K = K_B）：j_n = −(1 + e) m u_n⁻、固着なら J_t = −κ m u_t⁻/(1 + κ)、滑りなら −μ j_n t̂。
  function closedForm(v: Vec3, w: Vec3, eg: number, mug: number): { v: Vec3; w: Vec3; regime: string } {
    const rB: Vec3 = [0, -R, 0];
    const u = add(v, cross(w, rB));
    const un = u[1];
    const ut: Vec3 = [u[0], 0, u[2]];
    const jn = -(1 + eg) * m * un;
    const stick = length(ut) <= mug * (1 + eg) * ((1 + kappa) / kappa) * Math.abs(un);
    const jt = stick ? scale(ut, (-kappa * m) / (1 + kappa)) : scale(ut, (-mug * jn) / length(ut));
    const J: Vec3 = [jt[0], jn, jt[2]];
    return { v: add(v, scale(J, 1 / m)), w: add(w, scale(cross(rB, J), 1 / (kappa * m * R * R))), regime: stick ? 'stick' : 'slide' };
  }

  const incidences: Array<[string, Vec3, Vec3]> = [
    ['no spin', [12, -6, 3], [0, 0, 0]],
    ['backspin', [12, -6, 3], [0, 0, 40]],
    ['topspin', [12, -6, 3], [0, 0, -60]],
    ['side spin and gyro spin', [-8, -4, 9], [15, 30, -20]],
  ];
  for (const [label, v, w] of incidences) {
    for (const [eg, mug] of [[0.6, 0.05], [0.6, 0.6], [0.8, 3]] as const) {
      it(`matches the closed form (${label}, e_g = ${eg}, μ_g = ${mug})`, () => {
        const expected = closedForm(v, w, eg, mug);
        const r = bounce(onGround(v, w), eg, mug);
        expect(r.regime).toBe(expected.regime);
        expectAllClose(r.ballAfter.linearVelocity, expected.v);
        expectAllClose(r.ballAfter.angularVelocity, expected.w);
        // 地面との衝突は非連成なので、エネルギーは増えない（05 §6.11）。
        expect(r.diagnostics.kineticEnergyChange).toBeLessThanOrEqual(1e-12);
        expect(r.diagnostics.warnings).toEqual([]);
      });
    }
  }

  it('covers both regimes', () => {
    expect(closedForm([12, -6, 3], [0, 0, 0], 0.6, 0.05).regime).toBe('slide');
    expect(closedForm([12, -6, 3], [0, 0, 0], 0.8, 3).regime).toBe('stick');
  });
});

describe('ground bounce as the flight ground-contact handler', () => {
  const settings: FlightSimulationSettings = {
    timeStep: 0.005, maxTime: 2, eventTimeTolerance: 1e-9, forces: { ...allOff, gravity: true }, thresholds,
  };

  it('bounces at the start time when the ball leaves the impact moving into the ground (05 §8.3)', () => {
    const start: RigidBodyState = { position: [0, ball.radius, 0], orientation: IDENTITY_QUAT, linearVelocity: [15, -2, 1], angularVelocity: [0, 0, 20] };
    // 反発が Δt より短くなる手前で止める（05 §7.7）：開始時の反発後 v_y = 1 m/s、0.204 s に接地。
    const r = simulateFlight(start, ball, environment, { ...settings, maxTime: 0.3 }, groundBounceHandler(ball, coefficients(0.5, 0.4)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.value;
    expect(t.events[0]).toMatchObject({ type: 'start-on-ground', time: 0, response: 'continue' });
    const after = stateAt(t, 1);
    const expected = bounce(start, 0.5, 0.4).ballAfter;
    expectAllClose(after.linearVelocity, expected.linearVelocity);
    expectAllClose(after.angularVelocity, expected.angularVelocity);
    expect(after.linearVelocity[1]).toBeCloseTo(1, 12); // v_y⁺ = −e_g v_y⁻
    // その後、飛翔中の接地もバウンドとして処理される。
    expect(t.events.filter((e) => e.type === 'ground-contact').length).toBeGreaterThan(0);
  });

  it('keeps bouncing in vacuum with the expected apex heights and stops at max-time', () => {
    const vy = 4;
    const start: RigidBodyState = { position: [0, ball.radius, 0], orientation: IDENTITY_QUAT, linearVelocity: [2, vy, 0], angularVelocity: [0, 0, 0] };
    const eg = 0.7;
    const r = simulateFlight(start, ball, environment, settings, groundBounceHandler(ball, coefficients(eg, 0)));
    if (!r.ok) throw new Error(r.error.message);
    const contacts = r.value.events.filter((e) => e.type === 'ground-contact');
    // 真空・摩擦なし：n 回目の接地の直後の鉛直速度は e_g^n v_y（時刻は二分法の打ち切り幅の分だけずれる）。
    contacts.forEach((c, i) => {
      const post = stateAt(r.value, c.sampleIndex + 1);
      expectClose(post.linearVelocity[1], eg ** (i + 1) * vy, { relative: 1e-6, absolute: 1e-6 });
      expectClose(post.linearVelocity[0], 2);
    });
    expect(contacts.length).toBeGreaterThan(2);
    expect(r.value.events.at(-1)!.type).toBe('max-time');
  });
});


describe('rebound shorter than the remaining step (PR #7 review)', () => {
  it('returns unsupported-model instead of letting the ball sink below the ground', () => {
    // 開始時に v_y = −1、e_g = 0.001：反発後の v_y = 0.001 m/s、滞空 2 v_y / g ≈ 2e-4 s < Δt = 0.005 s。
    const settings: FlightSimulationSettings = {
      timeStep: 0.005, maxTime: 1, eventTimeTolerance: 1e-9, forces: { ...allOff, gravity: true }, thresholds,
    };
    const start: RigidBodyState = { position: [0, ball.radius, 0], orientation: IDENTITY_QUAT, linearVelocity: [3, -1, 0], angularVelocity: [0, 0, 0] };
    const r = simulateFlight(start, ball, environment, settings, groundBounceHandler(ball, coefficients(0.001, 0)));
    expect(!r.ok && r.error.code).toBe('unsupported-model');
  });
});

describe('rebound shorter than the remaining time of the final step (PR #7 review)', () => {
  it('returns unsupported-model when the ball re-enters the ground after a contact in the last step', () => {
    // Δt = maxTime = 0.005 s、初期高さ 1 mm、v_y = −1、e_g = 0.001：最終（唯一の）ステップ内で接地し、反発後の残り時間で再び地面を通過する。
    const settings: FlightSimulationSettings = {
      timeStep: 0.005, maxTime: 0.005, eventTimeTolerance: 1e-9, forces: { ...allOff, gravity: true }, thresholds,
    };
    const start: RigidBodyState = { position: [0, ball.radius + 0.001, 0], orientation: IDENTITY_QUAT, linearVelocity: [0, -1, 0], angularVelocity: [0, 0, 0] };
    const r = simulateFlight(start, ball, environment, settings, groundBounceHandler(ball, coefficients(0.001, 0)));
    expect(!r.ok && r.error.code).toBe('unsupported-model');
  });
});
