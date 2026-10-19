// T1.4-09：再生時刻での軌道の区間の探索。
import { describe, expect, it } from 'vitest';
import { intervalAt } from '../../src/playback/interpolate';

const times = [0, 0.1, 0.2, 0.2, 0.3];

describe('intervalAt', () => {
  it('finds the interval and the position within it', () => {
    expect(intervalAt(times, 0.05)).toEqual({ index: 0, alpha: 0.5 });
    expect(intervalAt(times, 0.1)).toEqual({ index: 1, alpha: 0 });
    expect(intervalAt(times, 0.25).index).toBe(3);
    expect(intervalAt(times, 0.25).alpha).toBeCloseTo(0.5, 12);
  });

  it('uses the later sample at a repeated time (after a ground-contact handling)', () => {
    expect(intervalAt(times, 0.2)).toEqual({ index: 3, alpha: 0 });
  });

  it('clamps times outside the trajectory', () => {
    expect(intervalAt(times, -1)).toEqual({ index: 0, alpha: 0 });
    expect(intervalAt(times, 5)).toEqual({ index: 4, alpha: 0 });
    expect(intervalAt([0], 1)).toEqual({ index: 0, alpha: 0 });
  });
});
