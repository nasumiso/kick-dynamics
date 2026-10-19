// T1.5-02：キックの実行（AC-05、AC-06 の自動確認できる部分）。
import { stateAt } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { INITIAL_KICK_STATE, toKickInput } from '../../src/kick/kick-state';
import { LAB_SIMULATION_SETTINGS, runKick } from '../../src/kick/run-kick';

describe('runKick', () => {
  it('computes the trajectory of the initial kick, starting at the impact with the ball moving away from the foot', () => {
    const run = runKick(toKickInput(INITIAL_KICK_STATE));
    if (!run.ok) throw new Error(run.message);
    const { trajectory, impact } = run.result;
    expect(trajectory.time[0]).toBe(0);
    expect(stateAt(trajectory, 0)).toEqual(impact.ballAfter);
    expect(trajectory.events.length).toBeGreaterThan(0);
  });

  it('does not run and gives the reason when the foot moves away from the ball (AC-05)', () => {
    const run = runKick(toKickInput({ ...INITIAL_KICK_STATE, footAzimuth: Math.PI }));
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.message).toContain('離れる向き');
  });

  it('names the undetermined parameters when a setting needs them', () => {
    const run = runKick(toKickInput(INITIAL_KICK_STATE), {
      ...LAB_SIMULATION_SETTINGS, forces: { ...LAB_SIMULATION_SETTINGS.forces, spinDecay: 'linear' },
    });
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.message).toContain('P-14');
  });
});
