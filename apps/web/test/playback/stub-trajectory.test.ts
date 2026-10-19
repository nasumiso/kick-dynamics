// T1.4-09：スタブの軌道が Core から得られ、真空中の放物運動として最初の接地で終わること。
import { describe, expect, it } from 'vitest';
import { STUB_INITIAL_STATE, stubTrajectory } from '../../src/playback/stub-trajectory';

describe('stub trajectory', () => {
  it('flies in a vacuum and ends at the first ground contact at t = 2 v_y / g', () => {
    const r = stubTrajectory();
    if (!r.ok) throw new Error(r.error.message);
    const t = r.value;
    const contact = t.events.find((e) => e.type === 'ground-contact');
    expect(contact).toBeDefined();
    const expected = (2 * STUB_INITIAL_STATE.linearVelocity[1]) / 9.80665;
    expect(contact!.time).toBeGreaterThanOrEqual(expected - 1e-12);
    expect(contact!.time).toBeLessThanOrEqual(expected + 1e-9 + 1e-12); // δ_t（TOL-C、仮置き）
    expect(t.time.length).toBeGreaterThan(100);
  });
});
