// VER-C15：行列 K の性質（対称・正定値、ボール部分が 05 §6.5 の閉形式と一致）。
// 足の値は 05 §10.2 の仮置き（P-04〜P-06）、ボールはテスト用の任意の値。
import { describe, expect, it } from 'vitest';
import { ballInertia, boxInertia, inertiaWorld } from '../../src/bodies/dynamics';
import { ballContactMatrix, bodyContactMatrix, contactMatrix, finiteInertia, KINEMATIC_INERTIA } from '../../src/contact/k-matrix';
import { determinant, get, mulVec, transpose, ZERO_MAT3, type Mat3 } from '../../src/math/mat3';
import { fromAxisAngle } from '../../src/math/quat';
import { add, cross, normalize, scale, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose } from '../tolerance';

const ball = { mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 };
const footMass = 1.2;
const footBody = boxInertia(footMass, [0.26, 0.1, 0.08]);
const footOrientation = fromAxisAngle(normalize([0.3, -1, 0.6]), 1.1);
const n = normalize([0.8, 0.3, -0.5]); // 足 → ボール
const rB = scale(n, -ball.radius);
const rA: Vec3 = [0.05, -0.02, 0.07]; // n と非平行（偏心）

const footInertia = finiteInertia(footMass, inertiaWorld(footBody, footOrientation));
const ballInertiaInv = finiteInertia(ball.mass, ballInertia(ball));
const K = contactMatrix(footInertia, rA, ballInertiaInv, rB);

function expectPositiveDefinite(m: Mat3): void {
  // 対称行列の Sylvester の判定法：主小行列式がすべて正。
  expect(get(m, 0, 0)).toBeGreaterThan(0);
  expect(get(m, 0, 0) * get(m, 1, 1) - get(m, 0, 1) * get(m, 1, 0)).toBeGreaterThan(0);
  expect(determinant(m)).toBeGreaterThan(0);
}

describe('VER-C15 contact matrix K', () => {
  it('is symmetric and positive definite for a finite-mass foot', () => {
    expectAllClose(K, transpose(K));
    expectPositiveDefinite(K);
  });

  it('matches the closed form of the ball part K_B = E/m + (E − n nᵀ)/(κ m)', () => {
    expectAllClose(bodyContactMatrix(ballInertiaInv, rB), ballContactMatrix(ball, n));
    // 法線方向 1/m_B、接線方向 (1 + κ)/(κ m_B)、連成なし。
    const t = normalize(cross(n, [0, 1, 0]));
    expectAllClose(mulVec(ballContactMatrix(ball, n), n), scale(n, 1 / ball.mass));
    expectAllClose(mulVec(ballContactMatrix(ball, n), t), scale(t, (1 + ball.inertiaCoefficient) / (ball.inertiaCoefficient * ball.mass)));
  });

  it('gives Δu = K J consistently with the impulse updates of 05 §6.4', () => {
    // ボールに +J、足に −J。Δu = (Δv_B + Δω_B × r_B) − (Δv_A + Δω_A × r_A)。
    const J: Vec3 = [0.7, -1.3, 2.1];
    const dvB = scale(J, ballInertiaInv.inverseMass);
    const dwB = mulVec(ballInertiaInv.inverseInertiaWorld, cross(rB, J));
    const dvA = scale(J, -footInertia.inverseMass);
    const dwA = scale(mulVec(footInertia.inverseInertiaWorld, cross(rA, J)), -1);
    const du = sub(add(dvB, cross(dwB, rB)), add(dvA, cross(dwA, rA)));
    expectAllClose(mulVec(K, J), du);
  });

  it('reduces to K_B with a kinematic (infinite-mass) foot, still symmetric and positive definite', () => {
    expect(bodyContactMatrix(KINEMATIC_INERTIA, rA)).toEqual(ZERO_MAT3.map(() => 0));
    const kinematic = contactMatrix(KINEMATIC_INERTIA, rA, ballInertiaInv, rB);
    expectAllClose(kinematic, ballContactMatrix(ball, n));
    expectPositiveDefinite(kinematic);
  });
});
