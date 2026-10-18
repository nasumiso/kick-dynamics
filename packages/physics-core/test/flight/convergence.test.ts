// VER-F02：時間刻みの収束（抗力 ON、重力 ON、3 次元の斜方投射）。
//
// 3 次元の一般的な条件では閉形式の解がないため、非常に細かい刻み（評価する最小の刻みの 1/64）の解を
// 基準とする。1 次元の閉形式の解との比較は VER-F04（drag.test.ts）で行う。
// 軌道の途中で閾値（ε_v）による切り替えや地面イベントが起きないこと（|v_r| > ε_v、y > R）を
// テストの中で確かめる（06 §4.2 の前提）。
//
// 刻みは 0.04〜0.005 s とする。これより細かい刻みでは誤差が丸め誤差（位置で約 1e-13 m）に近づき、
// 観測した次数が理論次数から外れる（T1.2-04 の計測、06 §4.2 の記録）。
// TOL-B の判定幅は仮置き（理論次数 4 から ±0.5、06 §3）。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { integrateFixedSteps } from '../../src/flight/integrator';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { length, sub, type Vec3 } from '../../src/math/vec3';
import { ball, environment, settingsWith, thresholds } from './fixtures';

const CD = 0.25; // テスト用の任意の値
const ORDER_TOLERANCE = 0.5; // 仮置き（TOL-B の判定幅）
const DURATION = 1.6;

function run(v0: Vec3, steps: number): RigidBodyState[] {
  const initial: RigidBodyState = { position: [0, ball.radius, 0], orientation: IDENTITY_QUAT, linearVelocity: v0, angularVelocity: [0, 0, 0] };
  const settings = settingsWith({ gravity: true, drag: { enabled: true, coefficient: { kind: 'constant', value: CD } } }, DURATION / steps);
  const result = integrateFixedSteps(initial, steps, ball, environment, settings);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('VER-F02 time-step convergence', () => {
  for (const v0 of [[25, 10, -3], [33, 12, 0]] as const) {
    it(`converges at fourth order for the launch v0 = (${v0.join(', ')}) m/s`, () => {
      const reference = run(v0, 320 * 64);
      // 前提：閾値による切り替えも地面との交差も起きない（開始時刻は y = R）。
      for (const s of reference.slice(1)) {
        expect(length(s.linearVelocity)).toBeGreaterThan(thresholds.zeroSpeed);
        expect(s.position[1]).toBeGreaterThan(ball.radius);
      }
      const end = reference.at(-1)!;
      const errors = [40, 80, 160, 320].map((steps) => {
        const s = run(v0, steps).at(-1)!;
        return Math.hypot(length(sub(s.position, end.position)), length(sub(s.linearVelocity, end.linearVelocity)));
      });
      for (let i = 1; i < errors.length; i++) {
        const order = Math.log2(errors[i - 1]! / errors[i]!);
        expect(Math.abs(order - 4)).toBeLessThan(ORDER_TOLERANCE);
      }
    });
  }
});
