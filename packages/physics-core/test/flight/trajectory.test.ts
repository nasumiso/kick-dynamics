// T1.2-08：軌道データの出力形式（04 §6 の Trajectory）。
// 配列の長さの整合、時刻の単調増加、イベントの時刻のサンプルを含むこと。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { simulateFlightRun } from '../../src/flight/ground-events';
import { simulateFlight, stateAt, toTrajectory, type Trajectory } from '../../src/flight/trajectory';
import type { FlightSimulationSettings, GroundContactHandler } from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { ok } from '../../src/result';
import { allOff, ball, environment, thresholds } from './fixtures';

const settings: FlightSimulationSettings = {
  timeStep: 0.01,
  maxTime: 3,
  eventTimeTolerance: 1e-9, // δ_t（仮置き、06 §3）
  forces: {
    ...allOff,
    gravity: true,
    drag: { enabled: true, coefficient: { kind: 'constant', value: 0.25 } },
    magnus: { enabled: true, coefficient: { kind: 'function', evaluate: (_re, s) => 0.8 * s } },
  },
  thresholds,
};
const initial: RigidBodyState = { position: [0, ball.radius, 0], orientation: IDENTITY_QUAT, linearVelocity: [12, 6, 1], angularVelocity: [5, -20, 15] };
/** 鉛直速度だけを −0.5 倍にするテスト用の処理（バウンドの物理モデルではない）。 */
const reflect: GroundContactHandler = (c) => {
  const v = c.state.linearVelocity;
  return ok({ kind: 'continue', state: { ...c.state, linearVelocity: [v[0], -0.5 * v[1], v[2]] } });
};

function trajectory(handler?: GroundContactHandler): Trajectory {
  const r = simulateFlight(initial, ball, environment, settings, handler);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Trajectory output format', () => {
  for (const [name, handler] of [['ending at the first contact', undefined], ['with bounces', reflect]] as const) {
    describe(name, () => {
      const t = trajectory(handler);
      const n = t.time.length;

      it('uses Float64Array with consistent lengths', () => {
        for (const array of [t.time, t.position, t.linearVelocity, t.orientation, t.angularVelocity]) expect(array).toBeInstanceOf(Float64Array);
        expect(n).toBeGreaterThan(1);
        expect(t.position.length).toBe(3 * n);
        expect(t.linearVelocity.length).toBe(3 * n);
        expect(t.orientation.length).toBe(4 * n);
        expect(t.angularVelocity.length).toBe(3 * n);
      });

      it('has non-decreasing time that repeats only at ground-contact events', () => {
        const contactTimes = new Set(t.events.filter((e) => e.type === 'ground-contact').map((e) => e.time));
        expect(t.time[0]).toBe(0);
        for (let i = 1; i < n; i++) {
          expect(t.time[i]!).toBeGreaterThanOrEqual(t.time[i - 1]!);
          if (t.time[i] === t.time[i - 1]) expect(contactTimes.has(t.time[i]!)).toBe(true);
        }
      });

      it('contains a sample at the time of every event', () => {
        expect(t.events.length).toBeGreaterThan(0);
        for (const event of t.events) {
          expect(t.time[event.sampleIndex]).toBe(event.time);
          if (event.type === 'ground-contact' && event.response === 'continue') {
            expect(t.time[event.sampleIndex + 1]).toBe(event.time);
            expect(stateAt(t, event.sampleIndex + 1).position[1]).toBe(ball.radius);
          }
        }
        const last = t.events.at(-1)!;
        expect(last.sampleIndex).toBe(n - 1);
      });

      it('stores the same states as the flight run, sample by sample', () => {
        const run = simulateFlightRun(initial, ball, environment, settings, handler);
        if (!run.ok) throw new Error(run.error.message);
        const converted = toTrajectory(run.value);
        expect(run.value.samples).toHaveLength(n);
        run.value.samples.forEach((sample, i) => {
          expect(converted.time[i]).toBe(sample.time);
          expect(stateAt(converted, i)).toEqual(sample.state);
        });
      });
    });
  }

  it('ends with the first ground contact by default and with max-time when bounces continue', () => {
    expect(trajectory().events.map((e) => e.type)).toEqual(['ground-contact']);
    const bouncing = trajectory(reflect).events;
    expect(bouncing.filter((e) => e.type === 'ground-contact').length).toBeGreaterThan(1);
    expect(bouncing.at(-1)!.type).toBe('max-time');
  });
});
