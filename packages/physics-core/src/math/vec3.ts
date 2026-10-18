// 3 次元ベクトル（readonly タプル、docs/04-architecture.md §6）。

export type Vec3 = readonly [number, number, number];

export const ZERO: Vec3 = [0, 0, 0];
export const UNIT_X: Vec3 = [1, 0, 0];
export const UNIT_Y: Vec3 = [0, 1, 0];
export const UNIT_Z: Vec3 = [0, 0, 1];

export function vec3(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function negate(a: Vec3): Vec3 {
  return [-a[0], -a[1], -a[2]];
}

/** a + b * s */
export function addScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** 右手系の外積。 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function lengthSquared(a: Vec3): number {
  return dot(a, a);
}

export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

/** 単位ベクトル。長さが 0 または有限でない場合はプログラムの誤りとして例外を投げる。 */
export function normalize(a: Vec3): Vec3 {
  const n = length(a);
  if (!(n > 0) || !Number.isFinite(n)) {
    throw new RangeError(`normalize: cannot normalize vector of length ${n}`);
  }
  return [a[0] / n, a[1] / n, a[2] / n];
}

export function isFiniteVec3(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}
