// VER-M03：四元数の代数（回転の合成、回転行列との対応、正規化）。
// 長時間の積分でのノルムの保持は、姿勢の積分を実装する T1.2-06 で確かめる。
import { describe, expect, it } from 'vitest';
import { mul, mulVec, transpose, IDENTITY } from '../../src/math/mat3';
import {
  conjugate, derivative, fromAxisAngle, fromMat3, IDENTITY_QUAT, multiply, norm, normalize, rotate, toMat3, type Quat,
} from '../../src/math/quat';
import { normalize as normalizeVec, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';

const qa = fromAxisAngle(normalizeVec([1, 2, -0.5]), 0.9);
const qb = fromAxisAngle(normalizeVec([-0.3, 0.4, 1.2]), -2.1);
const v: Vec3 = [0.6, -1.4, 2.2];

describe('VER-M03 quaternion algebra', () => {
  it('stores components as [x, y, z, w]', () => {
    expect(IDENTITY_QUAT).toEqual([0, 0, 0, 1]);
    const q = fromAxisAngle([0, 0, 1], Math.PI / 2);
    expectAllClose(q, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
  });

  it('follows the Hamilton product rules i² = j² = k² = ijk = −1', () => {
    const i: Quat = [1, 0, 0, 0];
    const j: Quat = [0, 1, 0, 0];
    const k: Quat = [0, 0, 1, 0];
    const minusOne: Quat = [0, 0, 0, -1];
    expect(multiply(i, i)).toEqual(minusOne);
    expect(multiply(j, j)).toEqual(minusOne);
    expect(multiply(k, k)).toEqual(minusOne);
    expect(multiply(i, j)).toEqual(k);
    expect(multiply(j, i)).toEqual([0, 0, -1, 0]);
    expect(multiply(multiply(i, j), k)).toEqual(minusOne);
  });

  it('composes rotations as q_a ⊗ q_b = "apply q_b, then q_a"', () => {
    expectAllClose(rotate(multiply(qa, qb), v), rotate(qa, rotate(qb, v)));
  });

  it('distinguishes the order of composition (non-commutative example)', () => {
    // +x まわり 90° の後に +z まわり 90°：物体の +y は、まず +z へ、次に +z のまま。
    // +z まわりの後に +x まわり：物体の +y は、まず −x へ、次に −x のまま。
    const rx = fromAxisAngle([1, 0, 0], Math.PI / 2);
    const rz = fromAxisAngle([0, 0, 1], Math.PI / 2);
    expectAllClose(rotate(multiply(rz, rx), [0, 1, 0]), [0, 0, 1]);
    expectAllClose(rotate(multiply(rx, rz), [0, 1, 0]), [-1, 0, 0]);
    expectAllClose(multiply(rz, rx), [0.5, 0.5, 0.5, 0.5]);
  });

  it('matches the rotation matrix R(q)', () => {
    expectAllClose(mulVec(toMat3(qa), v), rotate(qa, v));
    expectAllClose(mul(toMat3(qa), toMat3(qb)), toMat3(multiply(qa, qb)));
    expectAllClose(mul(toMat3(qa), transpose(toMat3(qa))), IDENTITY);
    expectAllClose(toMat3(conjugate(qa)), transpose(toMat3(qa)));
  });

  it('q and −q represent the same rotation', () => {
    const neg: Quat = [-qa[0], -qa[1], -qa[2], -qa[3]];
    expectAllClose(rotate(neg, v), rotate(qa, v));
  });

  it('conjugate inverts a unit quaternion', () => {
    expectAllClose(multiply(qa, conjugate(qa)), IDENTITY_QUAT);
    expectAllClose(rotate(conjugate(qa), rotate(qa, v)), v);
  });

  it('normalize yields unit norm and products of unit quaternions stay unit', () => {
    const q = normalize([1, -2, 3, 0.5]);
    expectClose(norm(q), 1);
    expectClose(norm(multiply(qa, qb)), 1);
    expect(() => normalize([0, 0, 0, 0])).toThrow(RangeError);
  });

  it('derivative is ½ ω̂ ⊗ q with ω in world coordinates', () => {
    // q = 単位元、ω = (0, 0, ωz) のとき q̇ = [0, 0, ωz/2, 0]。
    expectAllClose(derivative(IDENTITY_QUAT, [0, 0, 2]), [0, 0, 1, 0]);
    // 一般の q で、定義どおりの積と一致する。
    const omega: Vec3 = [0.3, -1.1, 0.8];
    const expected = multiply([omega[0], omega[1], omega[2], 0], qa).map((c) => c / 2);
    expectAllClose(derivative(qa, omega), expected);
    // 単位四元数の微分はノルムを保つ向き（q · q̇ = 0）。
    const d = derivative(qa, omega);
    expectClose(qa[0] * d[0] + qa[1] * d[1] + qa[2] * d[2] + qa[3] * d[3], 0);
  });
});

describe('VER-M03 rotation matrix → quaternion', () => {
  it('inverts toMat3 up to the sign of q, including rotations near 180°', () => {
    const cases: Quat[] = [
      IDENTITY_QUAT, qa, qb, fromAxisAngle([1, 0, 0], Math.PI), fromAxisAngle([0, 1, 0], Math.PI - 1e-9),
      fromAxisAngle(normalizeVec([1, -1, 2]), 3.1), fromAxisAngle([0, 0, 1], -2.9),
    ];
    for (const q of cases) {
      const back = fromMat3(toMat3(q));
      expectClose(norm(back), 1);
      expectAllClose(toMat3(back), toMat3(q));
      expectAllClose(rotate(back, v), rotate(q, v));
    }
  });
});
