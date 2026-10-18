// T1.3-02：摩擦なしの衝撃（法線方向のみ）。VER-C01、C02、C03、C04、C09、C13。
import { describe, expect, it } from 'vitest';
import { contactMatrix, finiteInertia } from '../../src/contact/k-matrix';
import { pointVelocity, solveImpact } from '../../src/contact/solver';
import type { FootModel, ImpactResult, ImpactSetup } from '../../src/contact/types';
import { ballInertia, inertiaWorld } from '../../src/bodies/dynamics';
import { mulVec } from '../../src/math/mat3';
import { fromAxisAngle } from '../../src/math/quat';
import { dot, normalize, scale, sub } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';
import { ball, contactParams, foot, makeSetup, totalKineticEnergy } from './fixtures';

function solved(setup: ImpactSetup, e: number, mu: number, model: FootModel): ImpactResult {
  const r = solveImpact(setup, contactParams(e, mu), model);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function normalRelativeSpeed(setup: ImpactSetup, ballState = setup.ball, footState = setup.foot): number {
  const u = sub(pointVelocity(ballState, sub(setup.contactPoint, setup.ball.position)), pointVelocity(footState, sub(setup.contactPoint, setup.foot.position)));
  return dot(u, normalize(setup.contactNormal));
}

// 正面衝突（05 §6.10）：n = +x、足の重心は法線上（r_A ∥ n、z_b = n となる姿勢）、足は並進のみ。
const headOnOrientation = fromAxisAngle([0, 1, 0], Math.PI / 2); // 物体の +z → ワールドの +x
const headOn = (speed: number) => makeSetup({
  normal: [1, 0, 0], footArm: [foot.shape.dimensions[2] / 2, 0, 0], footPointVelocity: [speed, 0, 0], footOrientation: headOnOrientation,
});

// 偏心した一般の構成：r_A は n と非平行、足は回転もしている。
const eccentric = makeSetup({
  normal: normalize([0.9, 0.35, -0.25]),
  footArm: [0.06, -0.03, 0.05],
  footPointVelocity: [18, 4, -3],
  footAngularVelocity: [2, -5, 12],
  footOrientation: fromAxisAngle(normalize([0.3, -1, 0.6]), 1.1),
});

describe('VER-C01 / C02 one-dimensional head-on impact', () => {
  for (const e of [0, 0.5, 0.8, 1]) {
    it(`gives v⁺ = (1 + e) v_foot with an infinite-mass foot (e = ${e})`, () => {
      const r = solved(headOn(20), e, 0, 'kinematic-wall');
      expectAllClose(r.ballAfter.linearVelocity, [(1 + e) * 20, 0, 0]);
      expectAllClose(r.ballAfter.angularVelocity, [0, 0, 0]);
      expectAllClose(r.footAfter.linearVelocity, [20, 0, 0]);
    });

    it(`gives v⁺ = (1 + e) m_A v_foot / (m_A + m_B) with a finite-mass foot (e = ${e})`, () => {
      const r = solved(headOn(20), e, 0, 'finite-mass');
      expectAllClose(r.ballAfter.linearVelocity, [((1 + e) * foot.mass * 20) / (foot.mass + ball.mass), 0, 0]);
      expectAllClose(r.ballAfter.angularVelocity, [0, 0, 0]);
      expectAllClose(r.footAfter.angularVelocity, [0, 0, 0]);
    });
  }
});

describe('VER-C03 perfectly elastic impact', () => {
  it('conserves the total kinetic energy with e = 1, μ = 0 and a finite-mass foot', () => {
    for (const setup of [headOn(20), eccentric]) {
      const r = solved(setup, 1, 0, 'finite-mass');
      expectClose(totalKineticEnergy(r.ballAfter, r.footAfter), totalKineticEnergy(setup.ball, setup.foot));
    }
  });
});

describe('VER-C04 dissipation of an inelastic impact', () => {
  it('loses ΔT = −½ (1 − e²) (u_n⁻)² / (nᵀ K n) with μ = 0', () => {
    const n = normalize(eccentric.contactNormal);
    const K = contactMatrix(
      finiteInertia(foot.mass, inertiaWorld(foot.inertiaBody, eccentric.foot.orientation)), sub(eccentric.contactPoint, eccentric.foot.position),
      finiteInertia(ball.mass, ballInertia(ball)), sub(eccentric.contactPoint, eccentric.ball.position),
    );
    const un = normalRelativeSpeed(eccentric);
    for (const e of [0, 0.3, 0.75]) {
      const r = solved(eccentric, e, 0, 'finite-mass');
      const deltaT = totalKineticEnergy(r.ballAfter, r.footAfter) - totalKineticEnergy(eccentric.ball, eccentric.foot);
      const expected = (-0.5 * (1 - e * e) * un * un) / dot(n, mulVec(K, n));
      expectClose(deltaT, expected, { relative: 1e-10, absolute: 1e-10 });
      expect(deltaT).toBeLessThan(0);
    }
  });
});

describe('VER-C09 normal restitution', () => {
  for (const model of ['finite-mass', 'kinematic-wall'] as const) {
    it(`gives u_n⁺ = −e u_n⁻ (${model})`, () => {
      for (const e of [0, 0.4, 1]) {
        const r = solved(eccentric, e, 0, model);
        const before = normalRelativeSpeed(eccentric);
        expectClose(normalRelativeSpeed(eccentric, r.ballAfter, r.footAfter), -e * before);
        expectClose(dot(r.diagnostics.relativeVelocityAfter, normalize(eccentric.contactNormal)), -e * before);
      }
    });
  }

  it('applies only a normal impulse when μ = 0', () => {
    const r = solved(eccentric, 0.6, 0, 'finite-mass');
    const n = normalize(eccentric.contactNormal);
    expectAllClose(r.impulse, scale(n, dot(r.impulse, n)));
    expect(dot(r.impulse, n)).toBeGreaterThan(0);
  });
});

describe('VER-C13 separating contact', () => {
  for (const footPointVelocity of [[-5, 2, 0], [0, 7, -3]] as const) {
    it(`returns a zero impulse and unchanged states when u_n⁻ ≥ 0 (v_A^p = (${footPointVelocity.join(', ')}))`, () => {
      const setup = makeSetup({ normal: [1, 0, 0], footArm: [0.04, 0, 0], footPointVelocity });
      for (const model of ['finite-mass', 'kinematic-wall'] as const) {
        const r = solved(setup, 0.5, 0, model);
        expect(r.regime).toBe('separating');
        expect(r.impulse).toEqual([0, 0, 0]);
        expect(r.ballAfter).toEqual(setup.ball);
        expect(r.footAfter).toEqual(setup.foot);
      }
    });
  }
});

describe('contact parameter validation', () => {
  it('rejects e outside [0, 1], negative μ or non-finite values as SimResult errors', () => {
    for (const [e, mu] of [[-0.1, 0], [1.2, 0], [Number.NaN, 0], [0.5, -0.1], [0.5, Number.POSITIVE_INFINITY]] as const) {
      const r = solveImpact(eccentric, contactParams(e, mu), 'finite-mass');
      expect(!r.ok && r.error.code).toBe('invalid-parameter');
    }
  });
});
