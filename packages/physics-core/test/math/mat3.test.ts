// VER-M02：Mat3 演算（積・転置・逆行列・連立方程式・外積行列）。
import { describe, expect, it } from 'vitest';
import {
  add, determinant, diag, fromColumns, fromRows, get, IDENTITY, inverse, mul, mulVec, outer, scale, skew, solve,
  sub, transpose, type Mat3,
} from '../../src/math/mat3';
import { cross, dot, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';

const A: Mat3 = [2, -1, 0.5, 0.25, 3, -1.5, 1, 0.75, 4];
const B: Mat3 = [-1, 2, 0, 0.5, 1, 3, 2, -0.25, 1];
const v: Vec3 = [0.7, -1.3, 2.1];
const w: Vec3 = [-0.4, 0.9, 1.6];

describe('VER-M02 Mat3', () => {
  it('uses row-major element order', () => {
    const m = fromRows([1, 2, 3], [4, 5, 6], [7, 8, 9]);
    expect(get(m, 0, 2)).toBe(3);
    expect(get(m, 2, 0)).toBe(7);
    expect(fromColumns([1, 4, 7], [2, 5, 8], [3, 6, 9])).toEqual(m);
    expect(mulVec(m, [1, 0, 0])).toEqual([1, 4, 7]);
  });

  it('identity is neutral for multiplication', () => {
    expectAllClose(mul(A, IDENTITY), A);
    expectAllClose(mul(IDENTITY, A), A);
    expectAllClose(mulVec(IDENTITY, v), v);
  });

  it('multiplication is associative and consistent with mulVec', () => {
    expectAllClose(mulVec(mul(A, B), v), mulVec(A, mulVec(B, v)));
    expectAllClose(mul(mul(A, B), A), mul(A, mul(B, A)));
  });

  it('transpose reverses products and preserves bilinear forms', () => {
    expectAllClose(transpose(transpose(A)), A);
    expectAllClose(transpose(mul(A, B)), mul(transpose(B), transpose(A)));
    expectClose(dot(mulVec(A, v), w), dot(v, mulVec(transpose(A), w)));
  });

  it('add, sub and scale act element-wise', () => {
    expectAllClose(sub(add(A, B), B), A);
    expectAllClose(scale(A, 2), add(A, A));
  });

  it('determinant is multiplicative', () => {
    expectClose(determinant(IDENTITY), 1);
    expectClose(determinant(diag([2, 3, 4])), 24);
    expectClose(determinant(mul(A, B)), determinant(A) * determinant(B));
  });

  it('inverse and solve agree with the identity', () => {
    expectAllClose(mul(A, inverse(A)), IDENTITY);
    expectAllClose(mul(inverse(A), A), IDENTITY);
    const x = solve(A, v);
    expectAllClose(mulVec(A, x), v);
  });

  it('inverse rejects singular matrices', () => {
    expect(() => inverse(fromRows([1, 2, 3], [2, 4, 6], [0, 1, 1]))).toThrow(RangeError);
  });

  it('skew matrix reproduces the cross product', () => {
    expectAllClose(mulVec(skew(v), w), cross(v, w));
    expectAllClose(transpose(skew(v)), scale(skew(v), -1));
    // [a]×[a]× = a aᵀ − |a|² E
    expectAllClose(mul(skew(v), skew(v)), sub(outer(v, v), scale(IDENTITY, dot(v, v))));
  });

  it('outer product satisfies (a bᵀ) c = a (b·c)', () => {
    const c: Vec3 = [1.1, 0.2, -0.3];
    const expected = [v[0] * dot(w, c), v[1] * dot(w, c), v[2] * dot(w, c)];
    expectAllClose(mulVec(outer(v, w), c), expected);
  });
});
