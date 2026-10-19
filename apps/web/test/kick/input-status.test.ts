// T1.4-07：入力の妥当性の表示（Core の buildImpactSetup の結果の分類）。
import { describe, expect, it } from 'vitest';
import { inputStatus } from '../../src/kick/input-status';
import { INITIAL_KICK_STATE, toKickInput } from '../../src/kick/kick-state';
import { WORKING_GEOMETRY } from '../../src/params/working-values';

describe('kick input status', () => {
  it('accepts the initial input (foot moving +x into the back of the ball)', () => {
    expect(inputStatus(toKickInput(INITIAL_KICK_STATE), WORKING_GEOMETRY).ok).toBe(true);
  });

  it('reports a foot moving away from the ball', () => {
    const status = inputStatus(toKickInput({ ...INITIAL_KICK_STATE, footAzimuth: Math.PI }), WORKING_GEOMETRY);
    expect(status.ok).toBe(false);
    expect(status.message).toContain('離れる');
  });

  it('reports a zero speed as not approaching', () => {
    expect(inputStatus(toKickInput({ ...INITIAL_KICK_STATE, footSpeed: 0 }), WORKING_GEOMETRY).ok).toBe(false);
  });
});
