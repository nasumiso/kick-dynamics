// 物性値の検証（PR #7 のレビュー）：範囲外の値は逆行列の計算で例外を投げる前に invalid-parameter を返す。
import { describe, expect, it } from 'vitest';
import { boxInertia } from '../../src/bodies/dynamics';
import { isSymmetricPositiveDefinite } from '../../src/bodies/validate';
import { buildImpactSetup } from '../../src/contact/setup';
import { solveContact, solveImpact } from '../../src/contact/solver';
import { solveGroundBounce } from '../../src/ground/bounce';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { ball, contactParams, foot, makeSetup } from '../contact/fixtures';

const setup = makeSetup({ normal: [1, 0, 0], footArm: [0.04, 0.01, 0], footPointVelocity: [10, 1, 0] });
const kick = {
  contactDirection: [-1, 0, 0] as const, footRollAboutNormal: 0, footContactLocation: [0.02, 0] as const,
  footContactPointVelocity: [10, 0, 0] as const, footAngularVelocity: [0, 0, 0] as const, footModel: 'finite-mass' as const,
};
const badBalls = [{ ...ball, radius: 0 }, { ...ball, mass: -1 }, { ...ball, inertiaCoefficient: Number.NaN }];
const badFeet = [
  { ...foot, mass: 0 },
  { ...foot, inertiaBody: [0, 0, 0, 0, 0, 0, 0, 0, 0] as const },
  { ...foot, inertiaBody: [1, 0.5, 0, 0, 1, 0, 0, 0, 1] as const }, // 非対称
  { ...foot, inertiaBody: [1, 0, 0, 0, -1, 0, 0, 0, 1] as const }, // 正定値でない
  { ...foot, shape: { kind: 'box' as const, dimensions: [0.26, 0, 0.08] as const } },
];

describe('validation of physical parameters', () => {
  it('rejects invalid ball parameters in solveImpact, solveGroundBounce and buildImpactSetup', () => {
    for (const b of badBalls) {
      const impact = solveImpact(setup, { ...contactParams(0.5, 0.3), ball: b }, 'kinematic-wall');
      expect(!impact.ok && impact.error.code).toBe('invalid-parameter');
      const ground = solveGroundBounce(
        { position: [0, 0.11, 0], orientation: IDENTITY_QUAT, linearVelocity: [1, -3, 0], angularVelocity: [0, 0, 0] }, b,
        { restitution: 0.5, friction: 0.3, tangentialSpeedThreshold: 1e-9 },
      );
      expect(!ground.ok && ground.error.code).toBe('invalid-parameter');
      const built = buildImpactSetup(kick, { ball: b, foot, rollReferenceThreshold: 1e-6 });
      expect(!built.ok && built.error.code).toBe('invalid-parameter');
    }
  });

  it('rejects invalid foot parameters for the finite-mass foot and in buildImpactSetup', () => {
    for (const f of badFeet) {
      const impact = solveImpact(setup, { ...contactParams(0.5, 0.3), foot: f }, 'finite-mass');
      expect(!impact.ok && impact.error.code).toBe('invalid-parameter');
      const built = buildImpactSetup(kick, { ball, foot: f, rollReferenceThreshold: 1e-6 });
      expect(!built.ok && built.error.code).toBe('invalid-parameter');
    }
  });

  it('does not use the foot mass properties for the kinematic wall', () => {
    expect(solveImpact(setup, { ...contactParams(0.5, 0.3), foot: { ...foot, mass: 0 } }, 'kinematic-wall').ok).toBe(true);
  });

  it('accepts the box inertia of 05 §5.2 as symmetric positive definite', () => {
    expect(isSymmetricPositiveDefinite(boxInertia(1.2, [0.26, 0.1, 0.08]))).toBe(true);
  });
});

describe('validation of extreme but finite parameters (PR #7 review)', () => {
  it('rejects inertia tensors whose determinant or inverse overflows', () => {
    expect(isSymmetricPositiveDefinite([1e200, 0, 0, 0, 1e200, 0, 0, 0, 1e200])).toBe(false); // det = ∞
    expect(isSymmetricPositiveDefinite([1e-110, 0, 0, 0, 1e-110, 0, 0, 0, 1e-110])).toBe(false); // det = 0（アンダーフロー）
    expect(isSymmetricPositiveDefinite([1e-200, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(true);
    expect(isSymmetricPositiveDefinite([1e-310, 0, 0, 0, 1e5, 0, 0, 0, 1e5])).toBe(false); // 逆行列が ∞
    const huge = { ...foot, inertiaBody: [1e200, 0, 0, 0, 1e200, 0, 0, 0, 1e200] as const };
    const r = solveImpact(setup, { ...contactParams(0.5, 0.3), foot: huge }, 'finite-mass');
    expect(!r.ok && r.error.code).toBe('invalid-parameter');
  });

  it('rejects a ball whose moment of inertia overflows', () => {
    const r = solveImpact(setup, { ...contactParams(0.5, 0.3), ball: { ...ball, mass: 1e300, radius: 1e10 } }, 'kinematic-wall');
    expect(!r.ok && r.error.code).toBe('invalid-parameter');
  });
});

describe('solveContact input validation (PR #7 review)', () => {
  const coefficients = { restitution: 0.5, friction: 0.3, tangentialSpeedThreshold: 1e-9 };

  it('rejects invalid mass properties of a finite-mass counterpart', () => {
    for (const [mass, inertiaWorld] of [[0, foot.inertiaBody], [1.2, [0, 0, 0, 0, 0, 0, 0, 0, 0]]] as const) {
      const r = solveContact(setup, ball, { mass, inertiaWorld }, coefficients);
      expect(!r.ok && r.error.code).toBe('invalid-parameter');
    }
  });

  it('rejects a zero-length contact normal as invalid-input', () => {
    const r = solveContact({ ...setup, contactNormal: [0, 0, 0] }, ball, null, coefficients);
    expect(!r.ok && r.error.code).toBe('invalid-input');
  });
});
