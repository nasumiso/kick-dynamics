// VER-F08（接地時刻の検出）、VER-F12（接地イベントの境界条件）。05 §7.7。
//
// TOL-C（仮置き、06 §3）：接地時刻は二分法の区間の右端なので、真の接地時刻 t_true に対して
// t_true ≤ t* ≤ t_true + δ_t となるはず。丸め誤差の余裕として TOL-A の絶対誤差（1e-12 s）を両側に加える。
// δ_t = 1e-9 s は 05 §10.2 の仮置きの値。
import { describe, expect, it } from 'vitest';
import type { BallParams, RigidBodyState } from '../../src/bodies/types';
import { simulateFlightRun, type FlightRun } from '../../src/flight/ground-events';
import type {
  FlightEnvironment, FlightSimulationSettings, GroundContact, GroundContactHandler,
} from '../../src/flight/types';
import { IDENTITY_QUAT } from '../../src/math/quat';
import type { Vec3 } from '../../src/math/vec3';
import { ok } from '../../src/result';
import { expectClose, TOL_A } from '../tolerance';
import { allOff, ball, environment, thresholds } from './fixtures';

const EVENT_TIME_TOLERANCE = 1e-9; // δ_t（仮置き）
const g = environment.gravity;

function settings(timeStep: number, maxTime: number, eventTimeTolerance = EVENT_TIME_TOLERANCE): FlightSimulationSettings {
  return { timeStep, maxTime, eventTimeTolerance, forces: { ...allOff, gravity: true }, thresholds };
}

function body(position: Vec3, velocity: Vec3): RigidBodyState {
  return { position, orientation: IDENTITY_QUAT, linearVelocity: velocity, angularVelocity: [0, 0, 0] };
}

function run(initial: RigidBodyState, s: FlightSimulationSettings, handler?: GroundContactHandler, b: BallParams = ball, env: FlightEnvironment = environment): FlightRun {
  const result = simulateFlightRun(initial, b, env, s, handler);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function groundContacts(r: FlightRun) {
  return r.events.filter((e) => e.type === 'ground-contact');
}

function expectEventTime(actual: number, exact: number, tolerance = EVENT_TIME_TOLERANCE): void {
  expect(actual).toBeGreaterThanOrEqual(exact - TOL_A.absolute);
  expect(actual).toBeLessThanOrEqual(exact + tolerance + TOL_A.absolute);
}

/** 鉛直速度だけを −e 倍にするテスト用の処理（バウンドの物理モデルではない。05 §8.1 は T1.3-07）。 */
function reflect(e: number, contacts: GroundContact[] = []): GroundContactHandler {
  return (contact) => {
    contacts.push(contact);
    const v = contact.state.linearVelocity;
    return ok({ kind: 'continue', state: { ...contact.state, linearVelocity: [v[0], -e * v[1], v[2]] } });
  };
}

describe('VER-F08 ground contact time', () => {
  it('detects the landing of a vacuum projectile launched from the ground', () => {
    const v0: Vec3 = [18, 9, -2.5];
    const r = run(body([0, ball.radius, 0], v0), settings(0.005, 5));
    const [event] = groundContacts(r);
    const exact = (2 * v0[1]) / g;
    expectEventTime(event!.time, exact);
    const landing = r.samples.at(-1)!;
    expect(landing.time).toBe(event!.time);
    // 着地点：真の位置との差は、時刻の差による |v_h| δ_t 以下。
    expect(Math.abs(landing.state.position[0] - v0[0] * exact)).toBeLessThanOrEqual(Math.abs(v0[0]) * EVENT_TIME_TOLERANCE + 1e-11);
    expect(Math.abs(landing.state.position[2] - v0[2] * exact)).toBeLessThanOrEqual(Math.abs(v0[2]) * EVENT_TIME_TOLERANCE + 1e-11);
    expect(r.events.map((e) => e.type)).toEqual(['ground-contact']);
  });

  it('detects the landing of a projectile thrown from a height', () => {
    const y0 = 3;
    const vy = 2;
    const r = run(body([0, y0, 0], [10, vy, 0]), settings(0.01, 5));
    const exact = (vy + Math.sqrt(vy * vy + 2 * g * (y0 - ball.radius))) / g;
    expectEventTime(groundContacts(r)[0]!.time, exact);
  });
});

describe('VER-F12 ground event boundary conditions', () => {
  // ステップの終了でちょうど h = 0 になる構成：g = 8、R = 0.125、y_0 = R、v_y = 4、Δt = 0.125 はすべて 2 進で
  // 厳密に表せ、真空中の RK4 は 2 次多項式を厳密に再現するため、t = 1 で h が厳密に 0 になる。
  const dyadicBall: BallParams = { mass: 0.5, radius: 0.125, inertiaCoefficient: 0.5 };
  const dyadicEnvironment: FlightEnvironment = { ...environment, gravity: 8 };

  it('detects h = 0 exactly at the end of a step at that end time', () => {
    const r = run(body([0, 0.125, 0], [1, 4, 0]), settings(0.125, 3), undefined, dyadicBall, dyadicEnvironment);
    const [event] = groundContacts(r);
    expect(event!.time).toBe(1);
    expect(r.samples.at(-1)!.state.position[1]).toBe(0.125);
    expect(event!.type === 'ground-contact' && event!.projectionEnergy).toBe(0);
  });

  it('does not treat the start time as a ground contact when h ≤ 0 and v_y > 0', () => {
    const r = run(body([0, ball.radius, 0], [10, 5, 0]), settings(0.01, 3));
    const contacts = groundContacts(r);
    expect(contacts).toHaveLength(1);
    expectEventTime(contacts[0]!.time, (2 * 5) / g);
  });

  it('processes h ≤ 0 with v_y ≤ 0 at the start time without recording a ground-contact event (05 §7.7, §8.3)', () => {
    for (const vy of [-2, 0]) {
      const contacts: GroundContact[] = [];
      const r = run(body([0, ball.radius, 0], [10, vy, 0]), settings(0.01, 3), (c) => { contacts.push(c); return ok({ kind: 'terminate' }); });
      expect(contacts).toHaveLength(1);
      expect(contacts[0]!.time).toBe(0);
      expect(contacts[0]!.atStart).toBe(true);
      expect(r.events).toEqual([{ type: 'start-on-ground', time: 0, sampleIndex: 0, projectionEnergy: 0, response: 'terminate' }]);
      expect(groundContacts(r)).toHaveLength(0);
    }
  });

  it('detects each bounce once and returns to the time grid t_k = k Δt', () => {
    const e = 0.5;
    const vy = 8;
    const dt = 0.01;
    const contacts: GroundContact[] = [];
    const r = run(body([0, ball.radius, 0], [3, vy, 0]), settings(dt, 2.5), reflect(e, contacts));
    // 真空中の跳ね返り：接地の間隔は 2 v_n / g、v_n = e^n v_y。
    let exact = 0;
    const expected: number[] = [];
    // maxTime = 2.5 s までに 2 回（1.63 s、2.45 s）。3 回目は 2.86 s。
    for (let n = 0; exact + (2 * vy * e ** n) / g <= 2.5; n++) {
      exact += (2 * vy * e ** n) / g;
      expected.push(exact);
    }
    expect(contacts).toHaveLength(expected.length);
    contacts.forEach((c, n) => {
      // 各接地で最大 δ_t 遅れ、それが後の接地時刻にも積み重なる。
      expectEventTime(c.time, expected[n]!, (n + 1) * EVENT_TIME_TOLERANCE * 2);
      expect(c.atStart).toBe(false);
    });
    expect(groundContacts(r)).toHaveLength(expected.length);
    expect(expected).toHaveLength(2);
    expect(r.events.at(-1)).toEqual({ type: 'max-time', time: 250 * dt, sampleIndex: r.samples.length - 1 });
    // 時刻の格子：接地の時刻を除いたサンプルの時刻は k Δt（k = 0…250）と完全に一致する。
    const contactTimes = new Set(contacts.map((c) => c.time));
    const gridTimes = r.samples.map((s) => s.time).filter((t) => !contactTimes.has(t));
    expect(gridTimes).toEqual(Array.from({ length: 251 }, (_, k) => k * dt));
    // 接地の時刻には、処理の前と後の 2 つのサンプルがある。
    for (const t of contactTimes) expect(r.samples.filter((s) => s.time === t)).toHaveLength(2);
  });

  it('stops the bisection at ⌈log₂(Δt/δ_t)⌉ iterations even if the interval cannot shrink to δ_t', () => {
    const dt = 0.01;
    const tiny = 1e-30; // 浮動小数点の分解能より小さい打ち切り幅：区間幅の条件は満たせない
    const r = run(body([0, ball.radius, 0], [10, 5, 0]), settings(dt, 3, tiny));
    const [event] = groundContacts(r);
    expect(event!.type === 'ground-contact' && event!.bisectionIterations).toBe(Math.ceil(Math.log2(dt / tiny)));
    expectEventTime(event!.time, (2 * 5) / g, 0);
  });

  it('projects y onto R before the contact is processed and records the energy change', () => {
    const contacts: GroundContact[] = [];
    const r = run(body([0, ball.radius, 0], [10, 7, 0]), settings(0.01, 2), reflect(0.6, contacts));
    const [event] = groundContacts(r);
    const pre = r.samples.find((s) => s.time === event!.time)!;
    expect(pre.state.position[1]).toBeLessThanOrEqual(ball.radius);
    expect(contacts[0]!.state.position[1]).toBe(ball.radius);
    expect(contacts[0]!.state.position[0]).toBe(pre.state.position[0]);
    expect(contacts[0]!.state.linearVelocity).toEqual(pre.state.linearVelocity);
    if (event?.type !== 'ground-contact') throw new Error('unexpected event');
    expectClose(event.projectionEnergy, ball.mass * g * (ball.radius - pre.state.position[1]));
    expect(event.projectionEnergy).toBeGreaterThanOrEqual(0);
    expect(event.projectionEnergy).toBeLessThanOrEqual(ball.mass * g * 7 * EVENT_TIME_TOLERANCE * (1 + 1e-6));
  });
});

describe('ground events: other cases', () => {
  it('ends with a max-time event when the ball never reaches the ground', () => {
    const r = simulateFlightRun(body([0, 1, 0], [5, 0, 0]), ball, environment, { ...settings(0.01, 0.5), forces: allOff });
    expect(r.ok && r.value.events).toEqual([{ type: 'max-time', time: 0.5, sampleIndex: 50 }]);
    expect(r.ok && r.value.samples).toHaveLength(51);
  });

  it('reports rolling (v_y ≤ 0 on the ground after processing) as not yet supported', () => {
    const r = simulateFlightRun(body([0, ball.radius, 0], [10, 5, 0]), ball, environment, settings(0.01, 3), reflect(0));
    expect(!r.ok && r.error.code).toBe('unsupported-model');
  });

  it('rejects non-positive or non-finite settings', () => {
    for (const s of [settings(0, 1), settings(0.01, Number.NaN), settings(0.01, 1, -1), settings(Number.POSITIVE_INFINITY, 1)]) {
      const r = simulateFlightRun(body([0, 1, 0], [0, 0, 0]), ball, environment, s);
      expect(!r.ok && r.error.code).toBe('invalid-setting');
    }
  });
});
