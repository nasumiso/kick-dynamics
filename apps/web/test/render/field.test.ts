// 地面の格子（表示専用）：1 m ごとの線が、x 一定・z 一定の両方の向きで、範囲の全体に 1 m の線分の並びとして引かれること。
import { describe, expect, it } from 'vitest';
import { gridLevel, gridLinePositions } from '../../src/render/field';

const extent = { xMin: -10, xMax: 110, zMin: -40, zMax: 40 };

describe('field grid', () => {
  it('classifies 10 m, 5 m and other 1 m lines', () => {
    expect([0, 10, -20, 110].map(gridLevel)).toEqual(['major', 'major', 'major', 'major']);
    expect([5, -5, 35].map(gridLevel)).toEqual(['medium', 'medium', 'medium']);
    expect([1, -1, 7, -39].map(gridLevel)).toEqual(['minor', 'minor', 'minor', 'minor']);
  });

  it('covers every metre line across the whole field with 1 m segments', () => {
    const lines = gridLinePositions(extent, 0.002);
    // 各線について、線分の長さの合計（= 範囲の長さになるはず）を数える。
    const constantX = new Map<number, number>();
    const constantZ = new Map<number, number>();
    for (const [level, positions] of Object.entries(lines)) {
      for (let i = 0; i < positions.length; i += 6) {
        const [x0, y0, z0, x1, y1, z1] = positions.slice(i, i + 6) as [number, number, number, number, number, number];
        expect([y0, y1]).toEqual([0.002, 0.002]);
        if (x0 === x1) {
          expect(z1 - z0).toBe(1);
          expect(gridLevel(x0)).toBe(level);
          constantX.set(x0, (constantX.get(x0) ?? 0) + 1);
        } else {
          expect(z0).toBe(z1);
          expect(x1 - x0).toBe(1);
          expect(gridLevel(z0)).toBe(level);
          constantZ.set(z0, (constantZ.get(z0) ?? 0) + 1);
        }
      }
    }
    expect(constantX.size).toBe(121);
    expect(constantZ.size).toBe(81);
    for (const metres of constantX.values()) expect(metres).toBe(extent.zMax - extent.zMin);
    for (const metres of constantZ.values()) expect(metres).toBe(extent.xMax - extent.xMin);
  });
});
