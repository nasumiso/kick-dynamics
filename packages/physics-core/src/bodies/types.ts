// 剛体の状態と物性（docs/04-architecture.md §6、docs/05-physics-model.md §5）。
import type { Mat3 } from '../math/mat3';
import type { Quat } from '../math/quat';
import type { Vec3 } from '../math/vec3';

export interface RigidBodyState {
  /** 重心位置 m（ワールド座標） */
  readonly position: Vec3;
  /** 物体座標 → ワールド座標の回転（ADR-0005） */
  readonly orientation: Quat;
  /** 重心速度 m/s（ワールド座標） */
  readonly linearVelocity: Vec3;
  /** 角速度 rad/s（ワールド座標） */
  readonly angularVelocity: Vec3;
}

/** ボール（剛体球、05 §5.1）。慣性テンソルは κ m R² E。 */
export interface BallParams {
  /** m_B kg */
  readonly mass: number;
  /** R m */
  readonly radius: number;
  /** κ（無次元） */
  readonly inertiaCoefficient: number;
}

/** 足の形状。Phase 1 は一様密度の直方体で、接触面は +z_b 面（05 §5.2）。 */
export interface BoxFootShape {
  readonly kind: 'box';
  /** [L_x, L_y, L_z] m */
  readonly dimensions: Vec3;
}

export type FootShape = BoxFootShape;

/** 足（有限質量の 3D 剛体、05 §5.2）。 */
export interface FootParams {
  /** m_A kg */
  readonly mass: number;
  /** 物体座標での慣性テンソル kg·m² */
  readonly inertiaBody: Mat3;
  readonly shape: FootShape;
}
