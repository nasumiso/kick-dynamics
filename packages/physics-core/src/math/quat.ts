// 単位四元数（ADR-0005、docs/05-physics-model.md §2）。
// - 成分の並びは [x, y, z, w]（ベクトル部が先、スカラー部 w が最後）。
// - 積は Hamilton の定義。
// - 姿勢 q は物体座標 → ワールド座標の能動回転：v_W = q ⊗ v_B ⊗ q*。
import type { Mat3 } from './mat3';
import { cross, type Vec3 } from './vec3';

export type Quat = readonly [number, number, number, number];

export const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

/** Hamilton 積 a ⊗ b。 */
export function multiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + bw * ax + (ay * bz - az * by),
    aw * by + bw * ay + (az * bx - ax * bz),
    aw * bz + bw * az + (ax * by - ay * bx),
    aw * bw - (ax * bx + ay * by + az * bz),
  ];
}

export function conjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function norm(q: Quat): number {
  return Math.hypot(q[0], q[1], q[2], q[3]);
}

/** 単位四元数への正規化。ノルムが 0 または有限でない場合は例外を投げる。 */
export function normalize(q: Quat): Quat {
  const n = norm(q);
  if (!(n > 0) || !Number.isFinite(n)) {
    throw new RangeError(`normalize: cannot normalize quaternion of norm ${n}`);
  }
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** 単位ベクトル axis まわりに angle [rad] だけ右ねじの向きに回す回転。 */
export function fromAxisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

/** q ⊗ v ⊗ q*（q は単位四元数）。物体座標のベクトルをワールド座標へ変換する。 */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const w = q[3];
  const t = cross(u, v);
  const t2: Vec3 = [2 * t[0], 2 * t[1], 2 * t[2]];
  const ut = cross(u, t2);
  return [v[0] + w * t2[0] + ut[0], v[1] + w * t2[1] + ut[1], v[2] + w * t2[2] + ut[2]];
}

/** 単位四元数に対応する回転行列 R(q)（行優先）。R v = q ⊗ v ⊗ q*。 */
export function toMat3(q: Quat): Mat3 {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}

/** 姿勢の時間微分 q̇ = ½ ω̂ ⊗ q、ω̂ = [ωx, ωy, ωz, 0]（ω はワールド座標、05 §7.1）。 */
export function derivative(q: Quat, angularVelocity: Vec3): Quat {
  const d = multiply([angularVelocity[0], angularVelocity[1], angularVelocity[2], 0], q);
  return [0.5 * d[0], 0.5 * d[1], 0.5 * d[2], 0.5 * d[3]];
}
