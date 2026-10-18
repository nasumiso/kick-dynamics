// VER-F01：真空中の放物運動（抗力・マグヌス・回転減衰 OFF）。
// RK4 は 2 次多項式の解を丸め誤差の範囲で再現するため、TOL-A で比較する。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { integrateFixedSteps } from '../../src/flight/integrator';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { addScaled, type Vec3 } from '../../src/math/vec3';
import { expectAllClose } from '../tolerance';
import { ball, environment, settingsWith } from './fixtures';

describe('VER-F01 vacuum projectile', () => {
  it('matches x0 + v0 t + ½ g t² at every step', () => {
    const x0: Vec3 = [0, 0.11, 0];
    const v0: Vec3 = [18, 9, -2.5];
    const initial: RigidBodyState = { position: x0, orientation: IDENTITY_QUAT, linearVelocity: v0, angularVelocity: [0, 0, 0] };
    const dt = 0.01;
    const steps = 200;
    const result = integrateFixedSteps(initial, steps, ball, environment, settingsWith({ gravity: true }, dt));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const g: Vec3 = [0, -environment.gravity, 0];
    result.value.forEach((state, k) => {
      const t = k * dt;
      expectAllClose(state.position, addScaled(addScaled(x0, v0, t), g, 0.5 * t * t));
      expectAllClose(state.linearVelocity, addScaled(v0, g, t));
    });
  });

  it('keeps the motion unchanged when gravity is also off', () => {
    const initial: RigidBodyState = { position: [1, 2, 3], orientation: IDENTITY_QUAT, linearVelocity: [4, -5, 6], angularVelocity: [0, 0, 0] };
    const result = integrateFixedSteps(initial, 10, ball, environment, settingsWith({}, 0.1));
    expect(result.ok).toBe(true);
    if (result.ok) expectAllClose(result.value[10]!.position, addScaled([1, 2, 3], [4, -5, 6], 1));
  });
});
