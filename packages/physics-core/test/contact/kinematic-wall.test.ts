// T1.3-04：無限質量モード。VER-C12（無限質量への極限）、VER-C16（無限質量での並進系のエネルギー）。
//
// VER-C12 の判定方法（M1.3 で決める、06 §4.3）：足の質量と慣性テンソルを λ 倍したとき、有限質量モデルの
// 衝突直後のボールの速度・角速度と無限質量モデルの結果との差が 1/λ に比例して小さくなる（λ を 100 倍すると差が
// ほぼ 1/100：比が 100 の ±10% 以内、仮置き）。固着／滑りの境界から離れた構成で、両方の場合を確かめる。
import { describe, expect, it } from 'vitest';
import { ballInertia, kineticEnergy } from '../../src/bodies/dynamics';
import type { FootParams } from '../../src/bodies/types';
import { solveImpact } from '../../src/contact/solver';
import type { ContactParameters, ImpactResult, ImpactSetup } from '../../src/contact/types';
import { scale as scaleMat } from '../../src/math/mat3';
import { fromAxisAngle } from '../../src/math/quat';
import { length, normalize, sub } from '../../src/math/vec3';
import { expectClose } from '../tolerance';
import { ball, contactParams, foot, makeSetup } from './fixtures';

function solve(setup: ImpactSetup, params: ContactParameters, model: 'finite-mass' | 'kinematic-wall'): ImpactResult {
  const r = solveImpact(setup, params, model);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const setup = makeSetup({
  normal: normalize([0.85, 0.4, -0.2]), footArm: [0.05, -0.03, 0.04], footPointVelocity: [15, -6, 8],
  footAngularVelocity: [1, -4, 9], footOrientation: fromAxisAngle(normalize([0.2, 1, -0.4]), 0.8),
});

describe('VER-C12 limit of an infinitely heavy foot', () => {
  for (const [label, mu] of [['slide', 0.05], ['stick', 2]] as const) {
    it(`approaches the kinematic-wall result as m_A, I_A → ∞ (${label})`, () => {
      const heavy = (lambda: number): ContactParameters => {
        const scaled: FootParams = { ...foot, mass: lambda * foot.mass, inertiaBody: scaleMat(foot.inertiaBody, lambda) };
        return { ...contactParams(0.6, mu), foot: scaled };
      };
      const wall = solve(setup, contactParams(0.6, mu), 'kinematic-wall');
      expect(wall.regime).toBe(label);
      const gap = (lambda: number) => {
        const r = solve(setup, heavy(lambda), 'finite-mass');
        expect(r.regime).toBe(label);
        return Math.hypot(length(sub(r.ballAfter.linearVelocity, wall.ballAfter.linearVelocity)), length(sub(r.ballAfter.angularVelocity, wall.ballAfter.angularVelocity)));
      };
      expect(Math.abs(gap(1e2) / gap(1e4) / 100 - 1)).toBeLessThan(0.1);
    });
  }
});

describe('VER-C16 energy in the frame translating with an infinite-mass foot (ω_A = 0)', () => {
  const translating = makeSetup({ normal: normalize([0.85, 0.4, -0.2]), footArm: [0.05, -0.03, 0.04], footPointVelocity: [15, -6, 8] });
  const ballBody = { mass: ball.mass, inertiaWorld: ballInertia(ball) };
  const relativeEnergy = (r: ImpactResult['ballAfter']) =>
    kineticEnergy(ballBody, { ...r, linearVelocity: sub(r.linearVelocity, translating.foot.linearVelocity) });

  for (const [e, mu] of [[1, 0], [0.5, 0], [0.5, 0.05], [0.5, 2], [0, 0.3]] as const) {
    it(`does not increase and equals the diagnostic ΔT (e = ${e}, μ = ${mu})`, () => {
      const r = solve(translating, contactParams(e, mu), 'kinematic-wall');
      const change = relativeEnergy(r.ballAfter) - relativeEnergy(translating.ball);
      expectClose(change, r.diagnostics.kineticEnergyChange, { relative: 1e-10, absolute: 1e-10 });
      expect(r.diagnostics.kineticEnergyChange).toBeLessThanOrEqual(1e-10);
      // 地上系ではボールのエネルギーが増える（キックでは当然）が、警告しない。
      expect(r.diagnostics.ballKineticEnergyAfter).toBeGreaterThan(r.diagnostics.ballKineticEnergyBefore);
      expect(r.diagnostics.warnings).toEqual([]);
      // 足は衝突で変化しない。
      expect(r.footAfter).toEqual(translating.foot);
    });
  }
});
