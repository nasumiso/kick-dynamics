// 方向ベクトル ↔ 方位角・仰角（T1.4-05）。05 §9 の打ち出し方向・打ち出し角と同じ定義であること、往復の一致、単位長。
import type { Vec3 } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { anglesToDirection, directionToAngles } from '../../src/units/direction';

const TOL = 1e-12;
function expectAllClose(actual: readonly number[], expected: readonly number[]): void {
  actual.forEach((a, i) => expect(Math.abs(a - expected[i]!)).toBeLessThanOrEqual(TOL + TOL * Math.abs(expected[i]!)));
}

describe('direction angles', () => {
  it('uses ψ = atan2(z, x) and θ = atan2(y, √(x² + z²)) (05 §9)', () => {
    expect(directionToAngles([1, 0, 0])).toEqual({ azimuth: 0, elevation: 0 });
    expectAllClose(Object.values(directionToAngles([0, 0, 1])!), [Math.PI / 2, 0]); // +z（右）が正
    expectAllClose(Object.values(directionToAngles([-1, 0, 0])!), [Math.PI, 0]);
    expectAllClose(Object.values(directionToAngles([1, 1, 0])!), [0, Math.PI / 4]);
    expectAllClose(Object.values(directionToAngles([0, -2, 0])!), [0, -Math.PI / 2]);
  });

  it('round-trips unit vectors and returns unit vectors', () => {
    const samples: Vec3[] = [[0.3, -0.4, 0.866], [-0.9, 0.1, -0.2], [0, 1, 0], [0.5, 0.5, -0.7]];
    for (const raw of samples) {
      const n = Math.hypot(...raw);
      const v: Vec3 = [raw[0] / n, raw[1] / n, raw[2] / n];
      const back = anglesToDirection(directionToAngles(v)!);
      expectAllClose(back, v);
      expect(Math.abs(Math.hypot(...back) - 1)).toBeLessThanOrEqual(TOL);
    }
  });

  it('has no direction for the zero vector', () => {
    expect(directionToAngles([0, 0, 0])).toBeNull();
  });
});
