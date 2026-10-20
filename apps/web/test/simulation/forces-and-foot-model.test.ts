// T1.5-05：足モデルの切り替え（AC-10）と力項の ON/OFF（AC-11）。
// AC-11 の期待値は真空中の放物運動の解析解（接地時刻 2 v_y⁺ / g、キャリー |v_h⁺| · 2 v_y⁺ / g）。
import type { SimulationSettings } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { INITIAL_KICK_STATE, type KickState } from '../../src/kick/kick-state';
import { DEFAULT_PARAMETER_SET } from '../../src/params/default-parameter-set';
import { degToRad } from '../../src/units/units';
import { DEFAULT_SIMULATION_SETTINGS, runKick } from '../../src/simulation/run-kick';

const kick: KickState = { ...INITIAL_KICK_STATE, contactDirection: [-0.94, -0.34, 0], footElevation: degToRad(30) }; // 下から蹴り上げる
const allOff: SimulationSettings = {
  ...DEFAULT_SIMULATION_SETTINGS, forces: { gravity: true, drag: false, magnus: false, spinDecay: 'none' }, ground: 'stop-at-first-contact',
};
const g = DEFAULT_PARAMETER_SET.gravity.value!;

function run(state: KickState, settings: SimulationSettings) {
  const outcome = runKick(state, DEFAULT_PARAMETER_SET, settings);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.result;
}

describe('AC-11 force terms on and off', () => {
  it('matches the vacuum parabola when drag, Magnus force and spin decay are all off', () => {
    const { impact, metrics, trajectory } = run(kick, allOff);
    const [vx, vy, vz] = impact.ballAfter.linearVelocity;
    expect(vy).toBeGreaterThan(0);
    const flightTime = (2 * vy) / g;
    const contact = trajectory.events.find((e) => e.type === 'ground-contact')!;
    expect(contact.time).toBeGreaterThanOrEqual(flightTime - 1e-12);
    expect(contact.time).toBeLessThanOrEqual(flightTime + 1e-9 + 1e-12); // δ_t（TOL-C、仮置き）
    expect(Math.abs(metrics.carry! - Math.hypot(vx, vz) * flightTime)).toBeLessThanOrEqual(Math.hypot(vx, vz) * 1e-9 + 1e-9);
    expect(Math.abs(metrics.maxHeight - (impact.ballAfter.position[1] + (vy * vy) / (2 * g)))).toBeLessThanOrEqual(1e-9);
  });

  it('changes the trajectory when only drag or only the Magnus force is on', () => {
    const vacuum = run(kick, allOff).metrics.carry!;
    const drag = run(kick, { ...allOff, forces: { ...allOff.forces, drag: true } }).metrics.carry!;
    const magnus = run(kick, { ...allOff, forces: { ...allOff.forces, magnus: true } }).metrics.carry!;
    expect(drag).toBeLessThan(vacuum); // 抗力は減速させる
    expect(magnus).not.toBe(vacuum);
  });

  it('refuses spin decay models whose coefficients are undetermined (P-14, P-22)', () => {
    const outcome = runKick(kick, DEFAULT_PARAMETER_SET, { ...allOff, forces: { ...allOff.forces, spinDecay: 'linear' } });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('invalid-parameter');
  });
});

describe('AC-10 foot model switch', () => {
  it('runs with both foot models, and the infinite-mass foot gives the faster ball', () => {
    const finite = run(kick, DEFAULT_SIMULATION_SETTINGS);
    const wall = run({ ...kick, footModel: 'kinematic-wall' }, DEFAULT_SIMULATION_SETTINGS);
    expect(finite.input.footModel).toBe('finite-mass');
    expect(wall.input.footModel).toBe('kinematic-wall');
    // 同じ足の速度でも、無限質量の足は衝突で減速しないため、ボールの初速が大きい（05 §6、VER-C12 の傾向）。
    expect(wall.metrics.launchSpeed).toBeGreaterThan(finite.metrics.launchSpeed);
  });
});
