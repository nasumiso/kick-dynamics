// T1.3-03：摩擦（固着／滑り）。VER-C10（摩擦の条件）、VER-C11（連続性）。
//
// VER-C11 の判定方法（M1.3 で決める、06 §4.3）：非連成で接線方向に等方的な場合（無限質量の足、ω_A = 0）に限り、
// (1) 固着／滑りの境界 μ_c の前後 μ_c(1 ± δ) の結果の差が δ に比例して小さくなること（δ を 1/100 にすると差も
// ほぼ 1/100：比が 100 の ±10% 以内、仮置き）、(2) μ → 0 で結果の μ = 0 の結果との差が μ に比例して小さくなること
// （同じ判定）、(3) 05 §6.8 の閉形式と TOL-A で一致すること、で判定する。
import { describe, expect, it } from 'vitest';
import { pointVelocity, solveImpact } from '../../src/contact/solver';
import type { FootModel, ImpactResult, ImpactSetup } from '../../src/contact/types';
import { fromAxisAngle } from '../../src/math/quat';
import { add, dot, length, normalize, scale, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose, TOL_A } from '../tolerance';
import { ball, contactParams, makeSetup } from './fixtures';

function solved(setup: ImpactSetup, e: number, mu: number, model: FootModel): ImpactResult {
  const r = solveImpact(setup, contactParams(e, mu), model);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function tangentialRelativeVelocity(setup: ImpactSetup, r: ImpactResult): Vec3 {
  const n = normalize(setup.contactNormal);
  const u = sub(
    pointVelocity(r.ballAfter, sub(setup.contactPoint, setup.ball.position)),
    pointVelocity(r.footAfter, sub(setup.contactPoint, setup.foot.position)),
  );
  return sub(u, scale(n, dot(u, n)));
}

const n = normalize([0.85, 0.4, -0.2]);
// 斜めに当たる偏心の構成（接線速度あり）。
const oblique = makeSetup({
  normal: n, footArm: [0.05, -0.03, 0.04], footPointVelocity: [15, -6, 8], footAngularVelocity: [1, -4, 9],
  footOrientation: fromAxisAngle(normalize([0.2, 1, -0.4]), 0.8),
});

describe('VER-C10 friction conditions', () => {
  for (const model of ['finite-mass', 'kinematic-wall'] as const) {
    for (const mu of [0.05, 0.3, 2]) {
      it(`keeps |J_t| ≤ μ j_n with the stick / slide conditions (${model}, μ = ${mu})`, () => {
        const r = solved(oblique, 0.6, mu, model);
        const jn = dot(r.impulse, n);
        const jt = sub(r.impulse, scale(n, jn));
        expect(jn).toBeGreaterThan(0);
        expect(length(jt)).toBeLessThanOrEqual(mu * jn * (1 + TOL_A.relative) + TOL_A.absolute);
        if (r.regime === 'stick') {
          expectAllClose(tangentialRelativeVelocity(oblique, r), [0, 0, 0]);
          expect(r.diagnostics.slidingDirection).toBeNull();
        } else {
          expect(r.regime).toBe('slide');
          const t = r.diagnostics.slidingDirection!;
          // J_t = −μ j_n t̂、t̂ = u_t⁻/|u_t⁻|。
          expectAllClose(jt, scale(t, -mu * jn));
          const ut = sub(r.diagnostics.relativeVelocityBefore, scale(n, dot(r.diagnostics.relativeVelocityBefore, n)));
          expectAllClose(t, normalize(ut));
        }
        expect(r.diagnostics.warnings).toEqual([]);
      });
    }
  }

  it('covers both regimes in the cases above', () => {
    expect(solved(oblique, 0.6, 0.05, 'finite-mass').regime).toBe('slide');
    expect(solved(oblique, 0.6, 2, 'finite-mass').regime).toBe('stick');
  });

  it('uses t̂ = −J*_t/|J*_t| with a warning when |u_t⁻| ≤ ε_t but the stick solution leaves the friction cone', () => {
    // 足の接触点の速度が法線方向だけ（u_t⁻ = 0）でも、偏心した足では K の連成で固着解に接線成分が生じる。
    const setup = makeSetup({ normal: [1, 0, 0], footArm: [0.04, 0.05, 0.03], footPointVelocity: [10, 0, 0] });
    const mu = 0.01;
    const r = solved(setup, 0.5, mu, 'finite-mass');
    expect(r.regime).toBe('slide');
    expect(r.diagnostics.warnings).toEqual(['tangent-direction-approximated']);
    const jn = dot(r.impulse, [1, 0, 0]);
    expectAllClose(sub(r.impulse, [jn, 0, 0]), scale(r.diagnostics.slidingDirection!, -mu * jn));
    // 法線方向の反発条件は満たす（VER-C09）。
    expectClose(dot(r.diagnostics.relativeVelocityAfter, [1, 0, 0]), 0.5 * 10);
  });
});

describe('VER-C11 continuity (uncoupled, tangentially isotropic case)', () => {
  // 無限質量の足、ω_A = 0：K = K_B（05 §6.8 の閉形式が厳密）。
  const e = 0.5;
  const kappa = ball.inertiaCoefficient;
  const wall = makeSetup({ normal: n, footArm: [0.05, -0.03, 0.04], footPointVelocity: [15, -6, 8] });
  const u = scale(wall.foot.linearVelocity, -1); // ボールは静止、足は並進のみ：u⁻ = −v_A
  const un = dot(u, n);
  const ut = sub(u, scale(n, un));
  const criticalMu = (length(ut) * kappa) / ((1 + e) * (1 + kappa) * Math.abs(un));
  const ballVelocity = (mu: number) => solved(wall, e, mu, 'kinematic-wall').ballAfter.linearVelocity;

  it('matches the closed form of 05 §6.8 on both sides of the stick / slide boundary', () => {
    const jn = -(1 + e) * ball.mass * un;
    for (const mu of [0.5 * criticalMu, 2 * criticalMu]) {
      const r = solved(wall, e, mu, 'kinematic-wall');
      const jt = mu >= criticalMu ? scale(ut, (-kappa * ball.mass) / (1 + kappa)) : scale(normalize(ut), -mu * jn);
      expect(r.regime).toBe(mu >= criticalMu ? 'stick' : 'slide');
      expectAllClose(r.impulse, add(scale(n, jn), jt));
    }
  });

  it('changes continuously across the boundary μ_c (difference ∝ δ)', () => {
    const jump = (delta: number) => length(sub(ballVelocity(criticalMu * (1 + delta)), ballVelocity(criticalMu * (1 - delta))));
    const ratio = jump(1e-3) / jump(1e-5);
    expect(Math.abs(ratio / 100 - 1)).toBeLessThan(0.1);
  });

  it('approaches the μ = 0 result as μ → 0 (difference ∝ μ)', () => {
    const frictionless = ballVelocity(0);
    const gap = (mu: number) => length(sub(ballVelocity(mu), frictionless));
    const ratio = gap(1e-3 * criticalMu) / gap(1e-5 * criticalMu);
    expect(Math.abs(ratio / 100 - 1)).toBeLessThan(0.1);
  });
});
