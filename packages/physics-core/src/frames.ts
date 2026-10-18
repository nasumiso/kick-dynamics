// ワールド座標系の規約（ADR-0005、docs/05-physics-model.md §2）。
// 右手系、+y が鉛直上向き、+x が基準の蹴り出し方向、+z = x̂ × ŷ。地面は y = 0。
import type { Vec3 } from './math/vec3';

export const WORLD_UP: Vec3 = [0, 1, 0];
export const WORLD_FORWARD: Vec3 = [1, 0, 0];
export const WORLD_RIGHT: Vec3 = [0, 0, 1];
export const GROUND_HEIGHT = 0;

/** 重力加速度ベクトル g = (0, −g, 0)（05 §7.2）。 */
export function gravityVector(g: number): Vec3 {
  return [0, -g, 0];
}
