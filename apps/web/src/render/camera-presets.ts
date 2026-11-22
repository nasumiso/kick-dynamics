// カメラの視点の既定（表示専用、spec 003 §4）。物理の計算には使わない。
import type { Vec3 } from '@kick-dynamics/physics-core';

/** 足の後ろから見る視点の配置 m（表示の値）：ボールの後ろの水平距離と、ボールの中心より上の高さ。 */
export const BEHIND_VIEW = { distance: 1.4, height: 0.5 } as const;

export interface CameraPlacement {
  readonly position: Vec3;
  /** 注視点（OrbitControls の回転の中心）。ボールの中心にする */
  readonly target: Vec3;
}

/**
 * 足の移動方向の水平成分 h = (cos ψ, 0, sin ψ) の真後ろから、ボールの飛ぶ向きを見る視点（ゴルフゲームのショットの視点）。
 * カメラはボールの中心から −h へ distance、上へ height。注視点（カメラの回転の中心）はボールの中心のまま。
 */
export function behindView(ballCenter: Vec3, azimuth: number, view = BEHIND_VIEW): CameraPlacement {
  const h: Vec3 = [Math.cos(azimuth), 0, Math.sin(azimuth)];
  return {
    position: [ballCenter[0] - view.distance * h[0], ballCenter[1] + view.height, ballCenter[2] - view.distance * h[2]],
    target: [ballCenter[0], ballCenter[1], ballCenter[2]],
  };
}
