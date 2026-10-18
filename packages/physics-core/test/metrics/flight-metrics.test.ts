// VER-S03：測定値の計算（05 §9）。解析的な軌道（真空中の放物運動）に対して定義どおりの値を返す。
// 着地に関する値は接地時刻の検出（TOL-C、仮置き）を含むため、δ_t に応じた幅で比べる。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { simulateFlight, type Trajectory } from '../../src/flight/trajectory';
import type { FlightForceSettings, FlightSimulationSettings, GroundContactHandler } from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { add, cross, dot, length, scale, type Vec3 } from '../../src/math/vec3';
import { computeFlightMetrics, spinComponents, type MetricsSettings } from '../../src/metrics/flight-metrics';
import { ok } from '../../src/result';
import { expectAllClose, expectClose, TOL_A } from '../tolerance';
import { allOff, ball, environment, thresholds } from '../flight/fixtures';

const EVENT_TIME_TOLERANCE = 1e-9; // δ_t（仮置き、06 §3）
const metricsSettings: MetricsSettings = { verticalLaunchThreshold: 1e-6 }; // P-27（仮置き）
const g = environment.gravity;

function fly(v0: Vec3, w0: Vec3, forces: Partial<FlightForceSettings> = {}, timeStep = 0.01, handler?: GroundContactHandler): Trajectory {
  const settings: FlightSimulationSettings = {
    timeStep, maxTime: 6, eventTimeTolerance: EVENT_TIME_TOLERANCE, forces: { ...allOff, gravity: true, ...forces }, thresholds,
  };
  const initial: RigidBodyState = { position: [0, ball.radius, 0], orientation: IDENTITY_QUAT, linearVelocity: v0, angularVelocity: w0 };
  const r = simulateFlight(initial, ball, environment, settings, handler);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('VER-S03 metrics of a vacuum projectile', () => {
  const v0: Vec3 = [18, 9, -2.5];
  const w0: Vec3 = [5, -20, 30];
  const m = computeFlightMetrics(fly(v0, w0), metricsSettings);
  const flightTime = (2 * v0[1]) / g;
  const horizontal = Math.hypot(v0[0], v0[2]);

  it('reports the launch speed, angles and spin rate from the state just after the impact', () => {
    expectClose(m.launchSpeed, length(v0));
    expectClose(m.launchAngle, Math.atan2(9, horizontal));
    expectClose(m.launchDirection, Math.atan2(-2.5, 18));
    expect(m.launchDirection).toBeLessThan(0); // −z は左
    expectClose(m.spinRate, length(w0));
  });

  it('reports the maximum height y0 + v0y²/(2g) between samples', () => {
    expectClose(m.maxHeight, ball.radius + (v0[1] * v0[1]) / (2 * g));
    // 頂点の時刻 v0y/g = 0.9177… s は Δt = 0.01 s の格子に乗らないため、サンプルの最大値より高い。
    expect(m.maxHeight).toBeGreaterThan(ball.radius + v0[1] * 0.92 - 0.5 * g * 0.92 * 0.92);
  });

  it('reports the flight time, landing point, carry and lateral deviation', () => {
    // 接地時刻は真の値から最大 δ_t だけ遅れる（TOL-C）。位置の差は |v| δ_t 以下。
    expect(m.flightTime!).toBeGreaterThanOrEqual(flightTime - TOL_A.absolute);
    expect(m.flightTime!).toBeLessThanOrEqual(flightTime + EVENT_TIME_TOLERANCE + TOL_A.absolute);
    const positionTolerance = { relative: 0, absolute: horizontal * EVENT_TIME_TOLERANCE + 1e-11 };
    expectAllClose(m.landingPoint!, [v0[0] * flightTime, v0[2] * flightTime], positionTolerance);
    expectClose(m.carry!, horizontal * flightTime, positionTolerance);
    expectClose(m.lateralDeviation!, v0[2] * flightTime, positionTolerance);
    expect(m.totalDistance).toBeNull();
  });

  it('uses the first ground contact even when the ball bounces afterwards', () => {
    const reflect: GroundContactHandler = (c) => ok({
      kind: 'continue', state: { ...c.state, linearVelocity: [c.state.linearVelocity[0], -0.5 * c.state.linearVelocity[1], c.state.linearVelocity[2]] },
    });
    const bouncing = computeFlightMetrics(fly(v0, w0, {}, 0.01, reflect), metricsSettings);
    expect(bouncing.flightTime).toBe(m.flightTime);
    expect(bouncing.landingPoint).toEqual(m.landingPoint);
    expect(bouncing.maxHeight).toBe(m.maxHeight);
  });
});

describe('first landing after a start-on-ground bounce', () => {
  it('does not count the processing at t = 0 as the first ground contact', () => {
    // 衝突直後に v_y < 0（05 §8.3）：開始時刻に処理（ここではテスト用の鉛直反射）してから飛ぶ。
    const reflect: GroundContactHandler = (c) => ok({
      kind: 'continue', state: { ...c.state, linearVelocity: [c.state.linearVelocity[0], -c.state.linearVelocity[1], c.state.linearVelocity[2]] },
    });
    const m = computeFlightMetrics(fly([18, -9, -2.5], [0, 0, 0], {}, 0.01, reflect), metricsSettings);
    const flightTime = (2 * 9) / g;
    expect(m.flightTime!).toBeGreaterThanOrEqual(flightTime - TOL_A.absolute);
    expect(m.flightTime!).toBeLessThanOrEqual(flightTime + EVENT_TIME_TOLERANCE + TOL_A.absolute);
    // 打ち出しの値は衝突直後（処理の前）の状態から求める。
    expectClose(m.launchAngle, Math.atan2(-9, Math.hypot(18, 2.5)));
  });
});

describe('VER-S03 spin components', () => {
  it('maps (ω_x, ω_y, ω_z) to (gyro, back, side) for a launch along +x', () => {
    // e1 = x̂、e2 = x̂ × ŷ = ẑ、e3 = ẑ × x̂ = ŷ。
    expect(spinComponents([20, 0, 0], [3, -5, 7], 1e-6)).toEqual({ gyro: 3, back: 7, side: -5 });
  });

  it('gives positive back spin for the spin that lifts the ball, and positive side spin for a leftward Magnus force', () => {
    const v: Vec3 = [15, 6, 4];
    for (const [w, expectedSign] of [[[0, 0, 1], 'back'], [[0, 1, 0], 'side']] as const) {
      const c = spinComponents(v, w, 1e-6)!;
      const magnusDirection = cross(w, v);
      if (expectedSign === 'back') {
        expect(c.back).toBeGreaterThan(0);
        expect(magnusDirection[1]).toBeGreaterThan(0);
      } else {
        // 進行方向に対して左：v̂ × ŷ の逆向き（右手側が v̂ × ŷ）。
        expect(c.side).toBeGreaterThan(0);
        expect(dot(magnusDirection, cross(v, [0, 1, 0]))).toBeLessThan(0);
      }
    }
  });

  it('decomposes ω into an orthonormal basis (ω = gyro e1 + back e2 + side e3)', () => {
    const v: Vec3 = [-7, 12, 9];
    const w: Vec3 = [40, -15, 22];
    const c = spinComponents(v, w, 1e-6)!;
    const e1 = scale(v, 1 / length(v));
    const e2 = scale(cross(e1, [0, 1, 0]), 1 / length(cross(e1, [0, 1, 0])));
    const e3 = cross(e2, e1);
    expectClose(e2[1], 0);
    expectAllClose(add(add(scale(e1, c.gyro), scale(e2, c.back)), scale(e3, c.side)), w);
    expectClose(c.gyro * c.gyro + c.back * c.back + c.side * c.side, dot(w, w));
  });

  it('is undefined (null) for a vertical or zero launch velocity', () => {
    expect(spinComponents([0, 25, 0], [1, 2, 3], 1e-6)).toBeNull();
    expect(spinComponents([1e-8, -25, 0], [1, 2, 3], 1e-6)).toBeNull();
    expect(spinComponents([0, 0, 0], [1, 2, 3], 1e-6)).toBeNull();
    expect(computeFlightMetrics(fly([0, 9, 0], [0, 0, 10]), metricsSettings).spinComponents).toBeNull();
  });
});

describe('metrics: other cases', () => {
  it('leaves the landing metrics null when the ball does not land before the maximum time', () => {
    const m = computeFlightMetrics(fly([10, 2, 0], [0, 0, 0], { gravity: false }), metricsSettings);
    expect(m.flightTime).toBeNull();
    expect(m.landingPoint).toBeNull();
    expect(m.carry).toBeNull();
    expect(m.lateralDeviation).toBeNull();
  });

  it('refines the maximum height between samples consistently with the integration order (with drag)', () => {
    const forces = { drag: { enabled: true, coefficient: { kind: 'constant' as const, value: 0.25 } } };
    const coarse = computeFlightMetrics(fly([25, 11, 0], [0, 0, 0], forces, 0.02), metricsSettings).maxHeight;
    const fine = computeFlightMetrics(fly([25, 11, 0], [0, 0, 0], forces, 0.0025), metricsSettings).maxHeight;
    expect(Math.abs(coarse - fine)).toBeLessThan(1e-7);
  });
});
