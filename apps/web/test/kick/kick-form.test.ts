// T1.4-07：キック入力の変換（AC-04：入力値が SI に変換されて Core に渡される）。
// 期待値は換算の定義（1 km/h = 1/3.6 m/s、1° = π/180 rad、1 mm = 1e-3 m、1 rpm = 2π/60 rad/s）から直接求める。
import { describe, expect, it } from 'vitest';
import { applyFormValues, toFormValues, type KickFormValues } from '../../src/kick/kick-form';
import { INITIAL_KICK_STATE, toKickInput } from '../../src/kick/kick-state';

const TOL = 1e-12;
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOL + TOL * Math.abs(expected));
}

const form: KickFormValues = {
  footSpeedKmh: 72, footAzimuthDeg: 30, footElevationDeg: 15, footRollDeg: -45,
  contactXmm: 40, contactYmm: -12, footSpinRpm: [0, 60, -30], footModel: 'kinematic-wall',
};

describe('kick input conversion to SI (AC-04)', () => {
  const state = applyFormValues(INITIAL_KICK_STATE, form);
  const input = toKickInput(state);

  it('passes SI values to Core', () => {
    const speed = 72 / 3.6; // 20 m/s
    const azimuth = Math.PI / 6;
    const elevation = Math.PI / 12;
    const expected = [Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth)].map((x) => x * speed);
    input.footContactPointVelocity.forEach((v, i) => expectClose(v, expected[i]!));
    expectClose(input.footRollAboutNormal, -Math.PI / 4);
    expectClose(input.footContactLocation[0], 0.04);
    expectClose(input.footContactLocation[1], -0.012);
    [0, 2 * Math.PI, -Math.PI].forEach((w, i) => expectClose(input.footAngularVelocity[i]!, w));
    expect(input.footModel).toBe('kinematic-wall');
    expect(input.contactDirection).toEqual(INITIAL_KICK_STATE.contactDirection);
  });

  it('round-trips the form values', () => {
    const back = toFormValues(state);
    for (const key of ['footSpeedKmh', 'footAzimuthDeg', 'footElevationDeg', 'footRollDeg', 'contactXmm', 'contactYmm'] as const) {
      expectClose(back[key], form[key]);
    }
    back.footSpinRpm.forEach((w, i) => expectClose(w, form.footSpinRpm[i]!));
  });

  it('starts from the provisional initial state: 20 m/s, 10° up, straight ahead, behind the ball', () => {
    const initial = toFormValues(INITIAL_KICK_STATE);
    expectClose(initial.footSpeedKmh, 72);
    expectClose(initial.footElevationDeg, 10);
    expect(initial.footAzimuthDeg).toBe(0);
    expect(INITIAL_KICK_STATE.contactDirection).toEqual([-1, 0, 0]);
  });
});
