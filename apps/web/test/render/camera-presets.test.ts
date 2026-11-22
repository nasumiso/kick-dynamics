// 足の後ろから見る視点（表示専用、spec 003 §4）。
import { describe, expect, it } from 'vitest';
import { BEHIND_VIEW, behindView } from '../../src/render/camera-presets';

describe('behind view', () => {
  it('places the camera behind the ball along the horizontal foot direction and orbits around the ball', () => {
    const { position, target } = behindView([0, 0.11, 0], 0);
    expect(position).toEqual([-BEHIND_VIEW.distance, 0.11 + BEHIND_VIEW.height, 0]);
    expect(target).toEqual([0, 0.11, 0]); // 回転の中心はボール
  });

  it('turns with the azimuth (ψ = 90° looks toward +z)', () => {
    const { position, target } = behindView([1, 0.11, 2], Math.PI / 2);
    expect(position[0]).toBeCloseTo(1, 12);
    expect(position[2]).toBeCloseTo(2 - BEHIND_VIEW.distance, 12);
    expect(target).toEqual([1, 0.11, 2]);
  });
});
