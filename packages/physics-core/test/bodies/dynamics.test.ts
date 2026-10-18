// VER-M04：慣性テンソルの変換と力学量。
import { describe, expect, it } from 'vitest';
import {
  angularMomentum, ballInertia, boxInertia, inertiaWorld, kineticEnergy, linearMomentum,
} from '../../src/bodies/dynamics';
import { determinant, get, mulVec, transpose } from '../../src/math/mat3';
import { conjugate, fromAxisAngle, multiply, rotate } from '../../src/math/quat';
import { add, cross, dot, negate, normalize, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';

// テスト用の任意の値（足の質量・寸法の仮置き値は T0-08 で決める）。
const mass = 1.3;
const dimensions: Vec3 = [0.26, 0.09, 0.11];
const inertiaBody = boxInertia(mass, dimensions);
const q = fromAxisAngle(normalize([0.4, -1, 0.7]), 1.234);
const iw = inertiaWorld(inertiaBody, q);
const omega: Vec3 = [3.1, -7.4, 12.5];
const velocity: Vec3 = [18, 2.5, -1.2];
const position: Vec3 = [0.3, 0.2, -0.05];

describe('VER-M04 inertia tensor and dynamic quantities', () => {
  it('box inertia matches the uniform-density formula of 05 §5.2', () => {
    const [lx, ly, lz] = dimensions;
    expectClose(get(inertiaBody, 0, 0), (mass / 12) * (ly * ly + lz * lz));
    expectClose(get(inertiaBody, 1, 1), (mass / 12) * (lx * lx + lz * lz));
    expectClose(get(inertiaBody, 2, 2), (mass / 12) * (lx * lx + ly * ly));
    expect(get(inertiaBody, 0, 1)).toBe(0);
  });

  it('ball inertia is isotropic κ m R²', () => {
    const i = ballInertia({ mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 });
    const expected = (2 / 3) * 0.43 * 0.11 * 0.11;
    expectAllClose(i, [expected, 0, 0, 0, expected, 0, 0, 0, expected]);
  });

  it('world inertia is symmetric and positive definite', () => {
    expectAllClose(iw, transpose(iw));
    // シルベスタの判定法：首座小行列式がすべて正
    const m1 = get(iw, 0, 0);
    const m2 = get(iw, 0, 0) * get(iw, 1, 1) - get(iw, 0, 1) * get(iw, 1, 0);
    expect(m1).toBeGreaterThan(0);
    expect(m2).toBeGreaterThan(0);
    expect(determinant(iw)).toBeGreaterThan(0);
    expectClose(determinant(iw), determinant(inertiaBody));
  });

  it('world inertia acts on world vectors like the body inertia on body vectors', () => {
    // I_W ω_W = R (I_body (Rᵀ ω_W))
    const omegaBody = rotate(conjugate(q), omega);
    expectAllClose(mulVec(iw, omega), rotate(q, mulVec(inertiaBody, omegaBody)));
  });

  it('rotational kinetic energy is invariant under the change of frame', () => {
    const body = { mass, inertiaWorld: iw };
    const state = { position, linearVelocity: velocity, angularVelocity: omega };
    const omegaBody = rotate(conjugate(q), omega);
    const expected = 0.5 * mass * dot(velocity, velocity) + 0.5 * dot(omegaBody, mulVec(inertiaBody, omegaBody));
    expectClose(kineticEnergy(body, state), expected);
  });

  it('kinetic energy is invariant when body and motion are rotated together', () => {
    const r = fromAxisAngle(normalize([1, 1, 0]), -0.8);
    const before = kineticEnergy({ mass, inertiaWorld: iw }, { position, linearVelocity: velocity, angularVelocity: omega });
    // 全体を r だけ回すと、姿勢は r ⊗ q になる
    const rotatedInertia = inertiaWorld(inertiaBody, multiply(r, q));
    const after = kineticEnergy(
      { mass, inertiaWorld: rotatedInertia },
      { position: rotate(r, position), linearVelocity: rotate(r, velocity), angularVelocity: rotate(r, omega) },
    );
    expectClose(after, before);
  });

  it('linear and angular momentum follow their definitions', () => {
    const body = { mass, inertiaWorld: iw };
    const state = { position, linearVelocity: velocity, angularVelocity: omega };
    expectAllClose(linearMomentum(body, state), [mass * 18, mass * 2.5, mass * -1.2]);
    const reference: Vec3 = [0, 0, 0];
    const expected = add(cross(position, linearMomentum(body, state)), mulVec(iw, omega));
    expectAllClose(angularMomentum(body, state, reference), expected);
    // 基準点を c だけ動かすと L は −c × p だけ変わる
    const c: Vec3 = [0.1, -0.2, 0.3];
    const shifted = angularMomentum(body, state, c);
    expectAllClose(sub(shifted, angularMomentum(body, state, reference)), negate(cross(c, linearMomentum(body, state))));
  });
});
