// 衝撃量 → 接触点の相対速度変化の行列 K（docs/05-physics-model.md §6.5）。
import type { BallParams } from '../bodies/types';
import { add, inverse, mul, outer, scale, skew, sub, IDENTITY, ZERO_MAT3, type Mat3 } from '../math/mat3';
import type { Vec3 } from '../math/vec3';

/**
 * 衝突する物体の慣性（ワールド座標）。運動学的な物体（無限質量の足、地面、05 §6.9）は
 * 質量の逆数と慣性テンソルの逆行列を 0 とする。
 */
export interface ImpactInertia {
  /** 1/m（運動学的な物体は 0） */
  readonly inverseMass: number;
  /** I_W⁻¹（ワールド座標。運動学的な物体は 0） */
  readonly inverseInertiaWorld: Mat3;
}

export const KINEMATIC_INERTIA: ImpactInertia = { inverseMass: 0, inverseInertiaWorld: ZERO_MAT3 };

export function finiteInertia(mass: number, inertiaWorld: Mat3): ImpactInertia {
  return { inverseMass: 1 / mass, inverseInertiaWorld: inverse(inertiaWorld) };
}

/** 1 つの物体の寄与 K_i = (1/m_i) E − [r_i]× I_i⁻¹ [r_i]×（r_i は重心 → 接触点）。 */
export function bodyContactMatrix(body: ImpactInertia, r: Vec3): Mat3 {
  const rx = skew(r);
  return sub(scale(IDENTITY, body.inverseMass), mul(mul(rx, body.inverseInertiaWorld), rx));
}

/** ボールの寄与の閉形式 K_B = (1/m_B) E + (1/(κ m_B)) (E − n nᵀ)（05 §6.5）。 */
export function ballContactMatrix(ball: BallParams, normal: Vec3): Mat3 {
  const tangential = sub(IDENTITY, outer(normal, normal));
  return add(scale(IDENTITY, 1 / ball.mass), scale(tangential, 1 / (ball.inertiaCoefficient * ball.mass)));
}

/** K = K_A + K_B。 */
export function contactMatrix(foot: ImpactInertia, footArm: Vec3, ball: ImpactInertia, ballArm: Vec3): Mat3 {
  return add(bodyContactMatrix(foot, footArm), bodyContactMatrix(ball, ballArm));
}
