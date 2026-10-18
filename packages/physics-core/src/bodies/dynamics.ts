// 慣性テンソルと力学量（docs/05-physics-model.md §2、§5、§6.11）。
import { diag, mul, mulVec, scale as scaleMat, transpose, IDENTITY, type Mat3 } from '../math/mat3';
import { toMat3, type Quat } from '../math/quat';
import { add, cross, dot, scale, sub, type Vec3 } from '../math/vec3';
import type { BallParams } from './types';

/** 一様密度の直方体の、中心まわりの慣性テンソル（物体座標、05 §5.2）。 */
export function boxInertia(mass: number, dimensions: Vec3): Mat3 {
  const [lx, ly, lz] = dimensions;
  const k = mass / 12;
  return diag([k * (ly * ly + lz * lz), k * (lx * lx + lz * lz), k * (lx * lx + ly * ly)]);
}

/** ボールの慣性テンソル κ m R² E（05 §5.1）。姿勢によらない。 */
export function ballInertia(ball: BallParams): Mat3 {
  return scaleMat(IDENTITY, ball.inertiaCoefficient * ball.mass * ball.radius * ball.radius);
}

/** ワールド座標での慣性テンソル I_W = R I_body Rᵀ。 */
export function inertiaWorld(inertiaBody: Mat3, orientation: Quat): Mat3 {
  const r = toMat3(orientation);
  return mul(mul(r, inertiaBody), transpose(r));
}

export interface MassProperties {
  readonly mass: number;
  /** ワールド座標での慣性テンソル */
  readonly inertiaWorld: Mat3;
}

export interface MotionState {
  readonly position: Vec3;
  readonly linearVelocity: Vec3;
  readonly angularVelocity: Vec3;
}

/** 運動量 p = m v。 */
export function linearMomentum(body: MassProperties, state: MotionState): Vec3 {
  return scale(state.linearVelocity, body.mass);
}

/** 点 reference まわりの角運動量 L = (x − reference) × m v + I_W ω。 */
export function angularMomentum(body: MassProperties, state: MotionState, reference: Vec3): Vec3 {
  const orbital = cross(sub(state.position, reference), linearMomentum(body, state));
  return add(orbital, mulVec(body.inertiaWorld, state.angularVelocity));
}

/** 運動エネルギー T = ½ m |v|² + ½ ωᵀ I_W ω。 */
export function kineticEnergy(body: MassProperties, state: MotionState): number {
  const v = state.linearVelocity;
  const w = state.angularVelocity;
  return 0.5 * body.mass * dot(v, v) + 0.5 * dot(w, mulVec(body.inertiaWorld, w));
}
