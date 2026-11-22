// 回転ギズモのドラッグ量の計算（spec 003 §4、AC-U04 の自動部分）。
import { describe, expect, it } from 'vitest';
import { ringDragAngle, tipDragAngles } from '../../src/render/direction-handles';

describe('rotation gizmo drag', () => {
  it('turns a ring by the mouse motion along its screen tangent, one radius = 1 rad', () => {
    expect(ringDragAngle([85, 0], [1, 0], 85)).toBeCloseTo(1, 12);
    expect(ringDragAngle([0, 85], [1, 0], 85)).toBeCloseTo(0, 12); // 接線に垂直な動きは回さない
    expect(ringDragAngle([-30, 40], [0.6, 0.8], 50)).toBeCloseTo((-18 + 32) / 50, 12);
  });

  it('moves the tip with the mouse when the screen derivatives are well conditioned', () => {
    // ψ は右へ 100 px/rad、θ は上（画面の −y）へ 100 px/rad
    const [dPsi, dTheta] = tipDragAngles([10, -20], [100, 0], [0, -100], 0);
    expect(dPsi).toBeCloseTo(0.1, 12);
    expect(dTheta).toBeCloseTo(0.2, 12);
  });

  it('stays bounded when the tip points at the camera (degenerate derivatives)', () => {
    const [dPsi, dTheta] = tipDragAngles([10, 10], [0.01, 0], [0, 0.01]);
    expect(Math.abs(dPsi)).toBeLessThan(1e-3);
    expect(Math.abs(dTheta)).toBeLessThan(1e-3);
  });
});
