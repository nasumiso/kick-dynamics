// T1.4-05：接触点の向き d（AC-02 の自動確認：|d| = 1）。
import type { Vec3 } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { contactDirectionFromHit } from '../../src/render/contact-picker';

describe('contact direction from a ray hit (AC-02)', () => {
  it('returns a unit vector from the ball centre towards the hit point', () => {
    const center: Vec3 = [0.4, 0.11, -0.3];
    for (const offset of [[-0.11, 0, 0], [0.05, 0.06, -0.07], [0, -0.109, 0.01], [0.3, 0.2, 0.1]] as const) {
      const hit: Vec3 = [center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]];
      const d = contactDirectionFromHit(hit, center)!;
      expect(Math.abs(Math.hypot(...d) - 1)).toBeLessThanOrEqual(1e-15);
      const n = Math.hypot(...offset);
      d.forEach((x, i) => expect(Math.abs(x - offset[i]! / n)).toBeLessThanOrEqual(1e-15));
    }
  });

  it('has no direction when the hit is at the centre', () => {
    expect(contactDirectionFromHit([1, 2, 3], [1, 2, 3])).toBeNull();
  });
});
