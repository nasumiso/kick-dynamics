// T1.3-05：偏心衝突と衝突診断。VER-C05（運動量）、C06（角運動量）、C07（法線衝撃とボールの回転）、C08（偏心衝突）、
// C14（散逸、警告なし）、C18（エネルギー増加の検出）と、滑り方向の反転の警告（05 §6.8 の手順 5）。
// 足の姿勢と r_A は 05 §6.2 と整合させる（footPose）。C18 と滑り方向の反転の構成は、整合した構成を固定の疑似乱数で
// 探索して見つけたもの（06 §7）。
import { describe, expect, it } from 'vitest';
import { angularMomentum, linearMomentum } from '../../src/bodies/dynamics';
import { pointVelocity, solveImpact } from '../../src/contact/solver';
import type { ImpactResult, ImpactSetup } from '../../src/contact/types';
import { inverse, mulVec } from '../../src/math/mat3';
import { add, cross, dot, normalize, scale, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';
import { ballMass, contactParams, footMass, footPose, makeSetup, totalKineticEnergy } from './fixtures';

function solve(setup: ImpactSetup, e: number, mu: number, model: 'finite-mass' | 'kinematic-wall' = 'finite-mass'): ImpactResult {
  const r = solveImpact(setup, contactParams(e, mu), model);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

interface Spec { n: Vec3; sx: number; sy: number; v: Vec3; w: Vec3 }
function consistent({ n: nRaw, sx, sy, v, w }: Spec): ImpactSetup {
  const n = normalize(nRaw);
  const pose = footPose(n, sx, sy);
  return makeSetup({ normal: n, footArm: pose.arm, footPointVelocity: v, footAngularVelocity: w, footOrientation: pose.orientation });
}

const eccentric = consistent({ n: [1, 0.3, -0.2], sx: 0.09, sy: -0.03, v: [14, 3, -5], w: [3, -8, 11] });
const cases: Array<[number, number]> = [[0, 0], [0.5, 0], [1, 0], [0.5, 0.05], [0.7, 0.4], [0.9, 2]];

describe('VER-C05 / C06 conservation of momentum and angular momentum (finite mass)', () => {
  const o: Vec3 = [1.3, -0.4, 2.2]; // 任意の固定点
  for (const [e, mu] of cases) {
    it(`conserves the total momentum and the angular momentum about a fixed point (e = ${e}, μ = ${mu})`, () => {
      const r = solve(eccentric, e, mu);
      const ballBody = ballMass();
      const footBody = footMass(eccentric.foot.orientation);
      const p = (b: ImpactResult['ballAfter'], f: ImpactResult['footAfter']) => add(linearMomentum(ballBody, b), linearMomentum(footBody, f));
      const L = (b: ImpactResult['ballAfter'], f: ImpactResult['footAfter']) => add(angularMomentum(ballBody, b, o), angularMomentum(footBody, f, o));
      expectAllClose(p(r.ballAfter, r.footAfter), p(eccentric.ball, eccentric.foot));
      expectAllClose(L(r.ballAfter, r.footAfter), L(eccentric.ball, eccentric.foot));
      // 診断値（接触点まわり）も保存を示す。
      expectAllClose(r.diagnostics.systemMomentum!.after, r.diagnostics.systemMomentum!.before);
      expectAllClose(r.diagnostics.systemAngularMomentum!.after, r.diagnostics.systemAngularMomentum!.before);
    });
  }

  it('does not report system momenta for the kinematic wall', () => {
    const r = solve(eccentric, 0.5, 0.3, 'kinematic-wall');
    expect(r.diagnostics.systemMomentum).toBeNull();
    expect(r.diagnostics.systemAngularMomentum).toBeNull();
  });
});

describe('VER-C07 a normal impulse does not spin the ball', () => {
  it('leaves ω_B unchanged when μ = 0, for any contact point', () => {
    for (const n of [[1, 0.3, -0.2], [0.2, -0.5, 1], [-0.7, 0.4, 0.6]] as const) {
      const setup = consistent({ n, sx: 0.05, sy: 0.02, v: scale(normalize(n), 12) as Vec3, w: [2, -3, 4] });
      for (const model of ['finite-mass', 'kinematic-wall'] as const) {
        expectAllClose(solve(setup, 0.6, 0, model).ballAfter.angularVelocity, [0, 0, 0]);
      }
    }
  });
});

describe('VER-C08 eccentric impact', () => {
  it('changes the foot spin by −I_A⁻¹ (r_A × J)', () => {
    const r = solve(eccentric, 0.6, 0.4);
    const rA = sub(eccentric.contactPoint, eccentric.foot.position);
    const expected = sub(eccentric.foot.angularVelocity, mulVec(inverse(footMass(eccentric.foot.orientation).inertiaWorld), cross(rA, r.impulse)));
    expectAllClose(r.footAfter.angularVelocity, expected);
  });

  it('does not change the foot spin when the impulse passes through the foot centre of mass', () => {
    // s = (0, 0)、μ = 0：r_A = (L_z/2) n、J ∥ n なので r_A × J = 0。
    const centred = consistent({ n: [1, 0.3, -0.2], sx: 0, sy: 0, v: [14, 3, -5], w: [0, 0, 0] });
    const r = solve(centred, 0.6, 0);
    expectAllClose(cross(sub(centred.contactPoint, centred.foot.position), r.impulse), [0, 0, 0]);
    expectAllClose(r.footAfter.angularVelocity, [0, 0, 0]);
  });
});

describe('VER-C14 dissipation without warnings where energy cannot increase', () => {
  it('gives ΔT ≤ 0 without warnings when μ = 0 (finite mass, many contact points)', () => {
    for (const sx of [-0.12, -0.05, 0, 0.07, 0.12]) {
      for (const sy of [-0.04, 0, 0.04]) {
        const setup = consistent({ n: [1, 0.3, -0.2], sx, sy, v: [14, 3, -5], w: [3, -8, 11] });
        for (const e of [0, 0.5, 1]) {
          const r = solve(setup, e, 0);
          const dT = totalKineticEnergy(r.ballAfter, r.footAfter) - totalKineticEnergy(setup.ball, setup.foot);
          expect(dT).toBeLessThanOrEqual(1e-10);
          expectClose(r.diagnostics.kineticEnergyChange, dT, { relative: 1e-10, absolute: 1e-10 });
          expect(r.diagnostics.warnings).toEqual([]);
        }
      }
    }
  });

  it('gives ΔT ≤ 0 without warnings in the uncoupled case (kinematic wall, ω_A = 0) with friction', () => {
    const setup = consistent({ n: [1, 0.3, -0.2], sx: 0.09, sy: -0.03, v: [14, 3, -5], w: [0, 0, 0] });
    for (const [e, mu] of cases) {
      const r = solve(setup, e, mu, 'kinematic-wall');
      expect(r.diagnostics.kineticEnergyChange).toBeLessThanOrEqual(1e-10);
      expect(r.diagnostics.warnings).toEqual([]);
    }
  });
});

describe('VER-C18 detection of an energy increase', () => {
  // 連成する構成で、Newton 反発 ＋ Coulomb 摩擦の代数解が ΔT > 0 となる（05 §6.11）。
  const setup = consistent({ n: [1, 0.42, -0.35], sx: 0.04, sy: -0.04, v: [10.15, 6.85, -1.45], w: [-0.73, -9.87, -7.53] });
  const e = 0.99;
  const mu = 0.28;

  it('returns the result with an energy-increase warning and without correcting it', () => {
    const r = solveImpact(setup, contactParams(e, mu), 'finite-mass');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dT = totalKineticEnergy(r.value.ballAfter, r.value.footAfter) - totalKineticEnergy(setup.ball, setup.foot);
    expect(dT).toBeGreaterThan(0);
    expectClose(r.value.diagnostics.kineticEnergyChange, dT, { relative: 1e-10, absolute: 1e-10 });
    expect(r.value.diagnostics.warnings).toContain('energy-increase');
    // 補正していない：固着の条件と法線方向の反発条件をそのまま満たす。
    const n = normalize(setup.contactNormal);
    expect(r.value.regime).toBe('stick');
    const un = (b: ImpactResult['ballAfter'], f: ImpactResult['footAfter']) =>
      dot(sub(pointVelocity(b, sub(setup.contactPoint, setup.ball.position)), pointVelocity(f, sub(setup.contactPoint, setup.foot.position))), n);
    expectClose(un(r.value.ballAfter, r.value.footAfter), -e * un(setup.ball, setup.foot));
  });
});

describe('slip reversal warning (05 §6.8 step 5)', () => {
  it('warns when u_t⁺ · t̂ < 0 after a sliding impact', () => {
    const setup = consistent({ n: [1, 0.08, -0.13], sx: 0.04, sy: 0, v: [6.14, 9.2, -2.9], w: [9.17, -6.74, 8.14] });
    const r = solve(setup, 0.78, 0.31);
    expect(r.regime).toBe('slide');
    const n = normalize(setup.contactNormal);
    const uAfter = r.diagnostics.relativeVelocityAfter;
    expect(dot(sub(uAfter, scale(n, dot(uAfter, n))), r.diagnostics.slidingDirection!)).toBeLessThan(0);
    expect(r.diagnostics.warnings).toContain('slip-reversal');
  });
});

describe('foot orientation that is not a unit quaternion (PR #7 review)', () => {
  it('uses q / |q| for a finite non-zero quaternion (q v q⁻¹ does not depend on |q|)', () => {
    const q = eccentric.foot.orientation;
    const scaled: ImpactSetup = { ...eccentric, foot: { ...eccentric.foot, orientation: [3 * q[0], 3 * q[1], 3 * q[2], 3 * q[3]] } };
    const expected = solve(eccentric, 0.7, 0.4);
    const actual = solve(scaled, 0.7, 0.4);
    expectAllClose(actual.impulse, expected.impulse);
    expectAllClose(actual.ballAfter.angularVelocity, expected.ballAfter.angularVelocity);
  });

  it.each([
    ['zero', [0, 0, 0, 0]],
    ['overflowing norm', [Number.MAX_VALUE, Number.MAX_VALUE, 0, 0]],
  ] as const)('returns invalid-input for a %s quaternion', (_, orientation) => {
    const r = solveImpact({ ...eccentric, foot: { ...eccentric.foot, orientation: [...orientation] } }, contactParams(0.7, 0.4), 'finite-mass');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid-input');
  });
});
