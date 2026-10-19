// 地面イベントを含む飛翔の積分（docs/05-physics-model.md §7.7）。
//
// - 判定量 h = y − R。ステップの開始で h > 0、終了で h ≤ 0 なら、そのステップ内で接地したとみなす。
// - 接地時刻は二分法で求める。ステップの開始状態から部分刻み τ だけ RK4 で積分し直して h(τ) を評価し、
//   区間幅が δ_t 以下、または反復回数が ⌈log₂(Δt/δ_t)⌉ に達したら終了する。接地時刻は区間の右端（h ≤ 0 側）。
// - 接地時の状態は y だけを R に射影してから処理に渡し、射影による位置エネルギーの変化を記録する。
// - 処理の後は、残り時間 t_{k+1} − t* を 1 回積分して元の時刻の格子 t_k = k Δt に戻る。
// - 処理が転がりを返したら（05 §8.1）、以降は空力を使わずに転がりのモデルで進め、各ステップの終了時に停止を判定する（§8.2）。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { GROUND_HEIGHT } from '../frames';
import { fail, ok, type SimResult } from '../result';
import { spinTableError } from './forces';
import { rk4Step } from './integrator';
import type {
  CoefficientModel, FlightEnvironment, FlightEvent, FlightSample, FlightSimulationSettings, GroundContact, GroundContactHandler,
  GroundContactResponse, GroundRolling,
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
  // 縮退判定の閾値は正の有限値（05 §7.3〜7.5、P-21・P-23・P-24。PR #12 のレビュー）。
  const t = settings.thresholds;
  const thresholds: Array<[string, number]> = [['magnus threshold ε', t.magnus], ['zero speed threshold ε_v', t.zeroSpeed], ['zero spin threshold ε_ω', t.zeroSpin]];
  for (const [name, value] of thresholds) {
    if (!(Number.isFinite(value) && value > 0)) return fail('invalid-parameter', `${name} must be finite and positive (${value})`);
  }
  // 折れ線の表の係数は、積分の前に一度だけ確かめる（05 §7.4）。
  const { drag, magnus, spinDecay } = settings.forces;
  const models: Array<[string, CoefficientModel]> = [['C_D', drag.coefficient], ['C_L', magnus.coefficient]];
  if (spinDecay.kind === 'torque-coefficient') models.push(['C_M', spinDecay.coefficient]);
  for (const [name, model] of models) {
    const error = model.kind === 'spin-table' ? spinTableError(model) : null;
    if (error !== null) return fail('invalid-coefficient', `${name}: ${error}`);
  }
  return ok(undefined);
}

export function simulateFlightRun(
  initial: RigidBodyState, ball: BallParams, environment: FlightEnvironment, settings: FlightSimulationSettings,
  onGroundContact: GroundContactHandler = terminateOnGroundContact,
): SimResult<FlightRun> {
  const valid = validate(settings);
  if (!valid.ok) return valid;
  // 初期状態の成分がすべて有限であることを確かめる（IV-03-C2 の H01、2026-10-20 人間が判断）。
  // 積分の途中で極端な値により有限でなくなる場合は対象外（packages/physics-core/AGENTS.md）。
  const { position, orientation, linearVelocity, angularVelocity } = initial;
  if (![...position, ...orientation, ...linearVelocity, ...angularVelocity].every(Number.isFinite)) {
    return fail('invalid-input', 'the initial ball state contains a non-finite value');
  }
  const dt = settings.timeStep;
  const steps = stepsUntil(settings.maxTime, dt);
  const maxIterations = Math.max(0, Math.ceil(Math.log2(dt / settings.eventTimeTolerance)));
  const samples: FlightSample[] = [{ time: 0, state: initial }];
  const events: FlightEvent[] = [];

  /** 転がりに移った後の転がりのモデル（05 §8.2）。null の間は飛翔として積分する。 */
  const mode: { rolling: GroundRolling | null } = { rolling: null };

  /** 接地を処理する。terminate なら null、continue・roll なら処理後の状態を返す（roll なら rolling を設定する）。 */
  function contact(time: number, raw: RigidBodyState, atStart: boolean, bisectionIterations: number): SimResult<RigidBodyState | null> {
    // 処理の前の状態（raw）は、呼び出し側で直前のサンプルとして追加済み。
    const sampleIndex = samples.length - 1;
    const projected: RigidBodyState = { ...raw, position: [raw.position[0], GROUND_HEIGHT + ball.radius, raw.position[2]] };
    const projectionEnergy = ball.mass * environment.gravity * (projected.position[1] - raw.position[1]);
    const handled = onGroundContact({ time, state: projected, atStart, timeStep: dt } satisfies GroundContact);
    if (!handled.ok) return handled;
    const response: GroundContactResponse = handled.value;
    events.push(atStart
      ? { type: 'start-on-ground', time, sampleIndex, projectionEnergy, response: response.kind }
      : { type: 'ground-contact', time, sampleIndex, bisectionIterations, projectionEnergy, response: response.kind });
    if (response.kind === 'terminate') return ok(null);
    const after = response.state;
    if (response.kind === 'roll') {
      samples.push({ time, state: after });
      events.push({ type: 'roll-start', time, sampleIndex: samples.length - 1 });
      mode.rolling = response.rolling;
      return ok(after);
    }
    if (heightAboveContact(after, ball) <= 0 && after.linearVelocity[1] <= 0) {
      // 地面上で v_y ≤ 0 のまま飛翔として続けることはできない：転がりへの移行（roll）を返す処理を使う（05 §8.1）。
      return fail('unsupported-model', 'the ground contact handler continued the flight on the ground without rolling (05 §8.1)');
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
    const rolling = mode.rolling;
    if (rolling !== null) {
      state = rolling.advance(state, dt);
      samples.push({ time: end, state });
      if (rolling.isStopped(state)) return ok({ samples, events: [...events, { type: 'stop', time: end, sampleIndex: samples.length - 1 }] });
      continue;
    }
    const stepped = rk4Step(state, dt, ball, environment, settings);
    if (!stepped.ok) return stepped;
    let next = stepped.value;
    if (heightAboveContact(state, ball) <= 0 && heightAboveContact(next, ball) < 0 && next.linearVelocity[1] <= 0) {
      // 地面上（h ≤ 0）から始まったステップで、ボールが地面の下へ進んだ：処理後の滞空がステップより短い反発などで、
      // 再接地を検出できなかった（05 §7.7 の制約。開始で h > 0 という検出条件を満たさない）。黙って続けずにエラーにする。
      // 転がりへの移行（05 §8.1 の v_rest）と条件 e_g v_rest ≥ g Δt/2（§7.7）を満たす接地の処理では、重力だけの近似では起きない。
      return fail('unsupported-model', `the ball went below the ground in the step starting at t = ${start} s without a detectable ground contact (05 §7.7)`);
    }

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
      const rollingAfter = mode.rolling;
      if (rollingAfter !== null) {
        // 接地がステップの終了時刻と一致する場合は、処理後の状態（追加済みのサンプル）がそのまま時刻 t_{k+1} の状態。
        state = remaining > 0 ? rollingAfter.advance(handled.value, remaining) : handled.value;
        if (remaining > 0) samples.push({ time: end, state });
        if (rollingAfter.isStopped(state)) return ok({ samples, events: [...events, { type: 'stop', time: end, sampleIndex: samples.length - 1 }] });
        continue;
      }
      if (remaining > 0) {
        const rest = rk4Step(handled.value, remaining, ball, environment, settings);
        if (!rest.ok) return rest;
        next = rest.value;
        if (heightAboveContact(next, ball) < 0 && next.linearVelocity[1] <= 0) {
          // 処理後の残り時間のうちに再び地面を通過した（ステップより短い反発、05 §7.7）。最終ステップでも検出するため、
          // 次のステップの開始を待たずにここでも判定する。
          return fail('unsupported-model', `the ball went below the ground within the remaining ${remaining} s after a ground contact at t = ${time} s (05 §7.7)`);
        }
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

/**
 * 時刻の格子 t_k = k Δt で、最初に t_k ≥ maxTime となる k（1 以上）。
 * maxTime / Δt の丸め誤差で 1 ステップ多くならないよう、候補 k の前の格子時刻 (k − 1) Δt を実際に比べる
 * （IV-04-C の I-D01 を受けて、許容幅で整数に丸める方式から変更、2026-10-18）。
 */
function stepsUntil(maxTime: number, dt: number): number {
  let k = Math.max(1, Math.ceil(maxTime / dt));
  while (k > 1 && (k - 1) * dt >= maxTime) k--;
  while (k * dt < maxTime) k++;
  return k;
}
