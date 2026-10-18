// 地面イベントを含む飛翔の積分（docs/05-physics-model.md §7.7）。
//
// - 判定量 h = y − R。ステップの開始で h > 0、終了で h ≤ 0 なら、そのステップ内で接地したとみなす。
// - 接地時刻は二分法で求める。ステップの開始状態から部分刻み τ だけ RK4 で積分し直して h(τ) を評価し、
//   区間幅が δ_t 以下、または反復回数が ⌈log₂(Δt/δ_t)⌉ に達したら終了する。接地時刻は区間の右端（h ≤ 0 側）。
// - 接地時の状態は y だけを R に射影してから処理に渡し、射影による位置エネルギーの変化を記録する。
// - 処理の後は、残り時間 t_{k+1} − t* を 1 回積分して元の時刻の格子 t_k = k Δt に戻る。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { GROUND_HEIGHT } from '../frames';
import { fail, ok, type SimResult } from '../result';
import { rk4Step } from './integrator';
import type {
  FlightEnvironment, FlightEvent, FlightSample, FlightSimulationSettings, GroundContact, GroundContactHandler,
  GroundContactResponse,
} from './types';

export interface FlightRun {
  /** 時刻の順に並んだ状態。接地（開始時刻の地面上の処理を含む）の時刻には、処理の前（射影の前）と後の 2 つの状態を同じ時刻で含む */
  readonly samples: readonly FlightSample[];
  readonly events: readonly FlightEvent[];
}

/** 最初の接地で飛翔を終える（M1.2 の既定）。 */
export const terminateOnGroundContact: GroundContactHandler = () => ok({ kind: 'terminate' });

function heightAboveContact(state: RigidBodyState, ball: BallParams): number {
  return state.position[1] - GROUND_HEIGHT - ball.radius;
}

function validate(settings: FlightSimulationSettings): SimResult<void> {
  const positive: Array<[string, number]> = [
    ['timeStep', settings.timeStep], ['maxTime', settings.maxTime], ['eventTimeTolerance', settings.eventTimeTolerance],
  ];
  for (const [name, value] of positive) {
    if (!Number.isFinite(value) || !(value > 0)) return fail('invalid-setting', `${name} must be finite and positive (${value})`);
  }
  return ok(undefined);
}

export function simulateFlightRun(
  initial: RigidBodyState, ball: BallParams, environment: FlightEnvironment, settings: FlightSimulationSettings,
  onGroundContact: GroundContactHandler = terminateOnGroundContact,
): SimResult<FlightRun> {
  const valid = validate(settings);
  if (!valid.ok) return valid;
  const dt = settings.timeStep;
  // maxTime / Δt が丸め誤差でわずかに整数を超えても、余分な 1 ステップを足さない。
  const steps = Math.max(1, Math.ceil(maxTimeRatio(settings.maxTime, dt)));
  const maxIterations = Math.max(0, Math.ceil(Math.log2(dt / settings.eventTimeTolerance)));
  const samples: FlightSample[] = [{ time: 0, state: initial }];
  const events: FlightEvent[] = [];

  /** 接地を処理する。terminate なら null、continue なら処理後の状態を返す。 */
  function contact(time: number, raw: RigidBodyState, atStart: boolean, bisectionIterations: number): SimResult<RigidBodyState | null> {
    // 処理の前の状態（raw）は、呼び出し側で直前のサンプルとして追加済み。
    const sampleIndex = samples.length - 1;
    const projected: RigidBodyState = { ...raw, position: [raw.position[0], GROUND_HEIGHT + ball.radius, raw.position[2]] };
    const projectionEnergy = ball.mass * environment.gravity * (projected.position[1] - raw.position[1]);
    const handled = onGroundContact({ time, state: projected, atStart } satisfies GroundContact);
    if (!handled.ok) return handled;
    const response: GroundContactResponse = handled.value;
    events.push(atStart
      ? { type: 'start-on-ground', time, sampleIndex, projectionEnergy, response: response.kind }
      : { type: 'ground-contact', time, sampleIndex, bisectionIterations, projectionEnergy, response: response.kind });
    if (response.kind === 'terminate') return ok(null);
    const after = response.state;
    if (heightAboveContact(after, ball) <= 0 && after.linearVelocity[1] <= 0) {
      // 地面上で v_y ≤ 0 の状態は転がり（05 §8.2）。転がりは T1.3-08 で扱う。
      return fail('unsupported-model', 'rolling on the ground is not implemented yet (T1.3-08)');
    }
    samples.push({ time, state: after });
    return ok(after);
  }

  let state = initial;
  // 初期状態（05 §7.7）：開始時に h ≤ 0 なら開始時刻を「ステップ内の接地」としては検出しない。
  // v_y ≤ 0 なら、地面上の処理（§8.3 のバウンド、§8.2 の転がり）を開始時刻に行う。
  if (heightAboveContact(state, ball) <= 0 && state.linearVelocity[1] <= 0) {
    const handled = contact(0, state, true, 0);
    if (!handled.ok) return handled;
    if (handled.value === null) return ok({ samples, events });
    state = handled.value;
  }

  for (let k = 0; k < steps; k++) {
    const start = k * dt;
    const end = (k + 1) * dt;
    const stepped = rk4Step(state, dt, ball, environment, settings);
    if (!stepped.ok) return stepped;
    let next = stepped.value;

    if (heightAboveContact(state, ball) > 0 && heightAboveContact(next, ball) <= 0) {
      let lo = 0;
      let hi = dt;
      let hiState = next;
      let iterations = 0;
      while (hi - lo > settings.eventTimeTolerance && iterations < maxIterations) {
        const mid = 0.5 * (lo + hi);
        const trial = rk4Step(state, mid, ball, environment, settings);
        if (!trial.ok) return trial;
        if (heightAboveContact(trial.value, ball) <= 0) {
          hi = mid;
          hiState = trial.value;
        } else {
          lo = mid;
        }
        iterations++;
      }
      const time = hi === dt ? end : Math.min(start + hi, end);
      samples.push({ time, state: hiState });
      const handled = contact(time, hiState, false, iterations);
      if (!handled.ok) return handled;
      if (handled.value === null) return ok({ samples, events });
      const remaining = end - time;
      if (remaining > 0) {
        const rest = rk4Step(handled.value, remaining, ball, environment, settings);
        if (!rest.ok) return rest;
        next = rest.value;
      } else {
        // 接地がステップの終了時刻と一致：処理後の状態がそのまま時刻 t_{k+1} の状態。
        state = handled.value;
        continue;
      }
    }
    samples.push({ time: end, state: next });
    state = next;
  }
  events.push({ type: 'max-time', time: steps * dt, sampleIndex: samples.length - 1 });
  return ok({ samples, events });
}

function maxTimeRatio(maxTime: number, dt: number): number {
  const ratio = maxTime / dt;
  const nearest = Math.round(ratio);
  return Math.abs(ratio - nearest) <= 1e-9 * Math.max(1, nearest) ? nearest : ratio;
}
