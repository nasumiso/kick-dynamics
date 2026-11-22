// 足の速度 v_A^p の矢印の形（表示専用、spec 003 §4）。根元が接触点に来ること、離れる向きの判定が 05 §6.2 と同じこと。
import type { Vec3 } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { ARROW_LENGTH, velocityArrowGeometry } from '../../src/render/velocity-arrow';

const center: Vec3 = [0, 0.11, 0];
const radius = 0.11;
const behind: Vec3 = [-1, 0, 0]; // ボールの真後ろの接触点（n = +x）

function close(actual: readonly number[], expected: readonly number[]): void {
  actual.forEach((x, i) => expect(Math.abs(x - expected[i]!)).toBeLessThanOrEqual(1e-12));
}

describe('foot velocity arrow', () => {
  it('starts at the contact point and points along the foot velocity when the foot approaches', () => {
    const g = velocityArrowGeometry(center, radius, behind, [20, 0, 0])!;
    expect(g.approaching).toBe(true);
    close(g.origin, [-0.11, 0.11, 0]);
    close(g.direction, [1, 0, 0]);
  });

  it('is marked separating when the foot moves away', () => {
    const g = velocityArrowGeometry(center, radius, behind, [-5, 0, 0])!;
    expect(g.approaching).toBe(false);
    close(g.origin, [-0.11, 0.11, 0]);
    close(g.direction, [-1, 0, 0]);
  });

  it('treats tangential motion (v · n = 0) as not approaching, like buildImpactSetup', () => {
    expect(velocityArrowGeometry(center, radius, behind, [0, 3, 0])!.approaching).toBe(false);
  });

  it('has a constant display length (the handle radius) and hides the arrow at zero speed', () => {
    expect(velocityArrowGeometry(center, radius, behind, [0.1, 0, 0])!.length).toBe(ARROW_LENGTH);
    expect(velocityArrowGeometry(center, radius, behind, [100, 0, 0])!.length).toBe(ARROW_LENGTH);
    expect(velocityArrowGeometry(center, radius, behind, [0, 0, 0])).toBeNull();
  });
});
