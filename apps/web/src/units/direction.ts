// 方向ベクトル ↔ 方位角・仰角（表示用、spec §4）。05 §9 の打ち出し方向・打ち出し角と同じ定義（暫定、T1.4-05）：
// 方位角 ψ = atan2(z, x)（+x から +z へ向かう向きが正、+z は右）、仰角 θ = atan2(y, √(x² + z²))（上が正）。
import type { Vec3 } from '@kick-dynamics/physics-core';

export interface DirectionAngles {
  /** 方位角 ψ rad（−π < ψ ≤ π） */
  readonly azimuth: number;
  /** 仰角 θ rad（−π/2 ≤ θ ≤ π/2） */
  readonly elevation: number;
}

/** 長さが 0 のベクトルは向きを持たないため null。 */
export function directionToAngles(v: Vec3): DirectionAngles | null {
  const horizontal = Math.hypot(v[0], v[2]);
  if (!(horizontal > 0) && v[1] === 0) return null;
  return { azimuth: Math.atan2(v[2], v[0]), elevation: Math.atan2(v[1], horizontal) };
}

/** 方位角・仰角 → 単位ベクトル (cos θ cos ψ, sin θ, cos θ sin ψ)。 */
export function anglesToDirection({ azimuth, elevation }: DirectionAngles): Vec3 {
  const c = Math.cos(elevation);
  return [c * Math.cos(azimuth), Math.sin(elevation), c * Math.sin(azimuth)];
}
