// 軌道の表示の補助（表示専用）：接地点の位置と蹴った位置からの水平距離、再生時刻までに通過した線分の数。
import type { Trajectory } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { groundMarks, traveledSegments } from '../../src/render/trajectory-view';

// 必要な欄だけを持つ軌道（サンプル 0 は x = 0.5 m、z = −0.2 m から始まる）。
const trajectory = {
  time: new Float64Array([0, 0.1, 0.2, 0.3]),
  position: new Float64Array([0.5, 0.11, -0.2, 3, 1, -0.2, 6.5, 0.11, 3.8, 8, 0.11, 3.8]),
  events: [
    { type: 'ground-contact', time: 0.2, sampleIndex: 2 },
    { type: 'stopped', time: 0.3, sampleIndex: 3 },
  ],
} as unknown as Trajectory;

describe('trajectory view helpers', () => {
  it('marks each ground contact with its horizontal distance from the kick position', () => {
    const marks = groundMarks(trajectory);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.point).toEqual([6.5, 0, 3.8]);
    expect(marks[0]!.distance).toBeCloseTo(Math.hypot(6, 4), 12);
  });

  it('counts the segments travelled by playback time t', () => {
    expect(traveledSegments(trajectory.time, 0)).toBe(0);
    expect(traveledSegments(trajectory.time, 0.15)).toBe(1);
    expect(traveledSegments(trajectory.time, 1)).toBe(3);
  });
});
