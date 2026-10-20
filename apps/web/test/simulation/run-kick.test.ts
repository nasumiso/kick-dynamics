// T1.5-02：UI と Core の結線。AC-05（離れる向きでは実行せず理由を示す）と、既定の入力・パラメータで
// 衝突 → 飛翔 → バウンド → 転がりまで計算できること（AC-06 の計算側）。
import { describe, expect, it } from 'vitest';
import { INITIAL_KICK_STATE } from '../../src/kick/kick-state';
import { DEFAULT_PARAMETER_SET } from '../../src/params/default-parameter-set';
import { DEFAULT_SIMULATION_SETTINGS, runKick } from '../../src/simulation/run-kick';

describe('running a kick from the UI state', () => {
  it('does not run when the foot moves away from the ball, and gives the reason (AC-05)', () => {
    const outcome = runKick({ ...INITIAL_KICK_STATE, footAzimuth: Math.PI }, DEFAULT_PARAMETER_SET);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('separating-input');
    expect(outcome.reason).toContain('離れる');
  });

  it('runs the initial input with the default parameters and bounces on the ground (AC-06)', () => {
    const outcome = runKick(INITIAL_KICK_STATE, DEFAULT_PARAMETER_SET);
    if (!outcome.ok) throw new Error(outcome.reason);
    const { trajectory, impact, metrics } = outcome.result;
    expect(impact.ballAfter.linearVelocity[0]).toBeGreaterThan(0); // +x へ飛ぶ
    const types = trajectory.events.map((e) => e.type);
    expect(types.filter((t) => t === 'ground-contact').length).toBeGreaterThan(1); // バウンド
    expect(types).toContain('roll-start');
    expect(['stop', 'max-time']).toContain(types.at(-1));
    expect(metrics.carry).not.toBeNull();
    // 時刻 0 は衝突の瞬間で、サンプル 0 は衝突直後のボール（ボールは y = R から始まる）。
    expect(trajectory.time[0]).toBe(0);
    expect(trajectory.position[1]).toBe(DEFAULT_PARAMETER_SET.ballRadius.value);
  });

  it('passes the settings through to Core unchanged', () => {
    const outcome = runKick(INITIAL_KICK_STATE, DEFAULT_PARAMETER_SET);
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.result.settings).toBe(DEFAULT_SIMULATION_SETTINGS);
    expect(outcome.result.parameters).toBe(DEFAULT_PARAMETER_SET);
  });
});
