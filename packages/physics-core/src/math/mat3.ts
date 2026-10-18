// 3×3 行列（readonly タプル、行優先：要素 (i, j) は m[3 * i + j]。docs/04-architecture.md §6）。
import type { Vec3 } from './vec3';

export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const ZERO_MAT3: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export function fromRows(r0: Vec3, r1: Vec3, r2: Vec3): Mat3 {
  return [r0[0], r0[1], r0[2], r1[0], r1[1], r1[2], r2[0], r2[1], r2[2]];
}

export function fromColumns(c0: Vec3, c1: Vec3, c2: Vec3): Mat3 {
  return [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
}

export function diag(d: Vec3): Mat3 {
  return [d[0], 0, 0, 0, d[1], 0, 0, 0, d[2]];
}

export function get(m: Mat3, row: number, column: number): number {
  return m[3 * row + column]!;
}

export function add(a: Mat3, b: Mat3): Mat3 {
  return a.map((v, i) => v + b[i]!) as unknown as Mat3;
}

export function sub(a: Mat3, b: Mat3): Mat3 {
  return a.map((v, i) => v - b[i]!) as unknown as Mat3;
}

export function scale(a: Mat3, s: number): Mat3 {
  return a.map((v) => v * s) as unknown as Mat3;
}

export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[3 * i + j] = a[3 * i]! * b[j]! + a[3 * i + 1]! * b[3 + j]! + a[3 * i + 2]! * b[6 + j]!;
    }
  }
  return r as unknown as Mat3;
}

export function mulVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function determinant(m: Mat3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

/** 逆行列（余因子行列による）。行列式が 0 または有限でない場合は例外を投げる。 */
export function inverse(m: Mat3): Mat3 {
  const det = determinant(m);
  if (det === 0 || !Number.isFinite(det)) {
    throw new RangeError(`inverse: matrix is singular (determinant ${det})`);
  }
  const inv = 1 / det;
  return [
    (m[4] * m[8] - m[5] * m[7]) * inv,
    (m[2] * m[7] - m[1] * m[8]) * inv,
    (m[1] * m[5] - m[2] * m[4]) * inv,
    (m[5] * m[6] - m[3] * m[8]) * inv,
    (m[0] * m[8] - m[2] * m[6]) * inv,
    (m[2] * m[3] - m[0] * m[5]) * inv,
    (m[3] * m[7] - m[4] * m[6]) * inv,
    (m[1] * m[6] - m[0] * m[7]) * inv,
    (m[0] * m[4] - m[1] * m[3]) * inv,
  ];
}

/** 連立方程式 m x = b の解。 */
export function solve(m: Mat3, b: Vec3): Vec3 {
  return mulVec(inverse(m), b);
}

/** 外積行列 [a]×：[a]× b = a × b。 */
export function skew(a: Vec3): Mat3 {
  return [0, -a[2], a[1], a[2], 0, -a[0], -a[1], a[0], 0];
}

/** 外積（テンソル積）a bᵀ。 */
export function outer(a: Vec3, b: Vec3): Mat3 {
  return [
    a[0] * b[0], a[0] * b[1], a[0] * b[2],
    a[1] * b[0], a[1] * b[1], a[1] * b[2],
    a[2] * b[0], a[2] * b[1], a[2] * b[2],
  ];
}
