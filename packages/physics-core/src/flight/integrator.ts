// 固定刻みの古典的 4 次ルンゲ＝クッタ法（docs/05-physics-model.md §7.1、§7.7）。
// 状態 (x, v, q, ω) を同時に積分し、各ステップの後に四元数を正規化する。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { derivative as quatDerivative, normalize as normalizeQuat, type Quat } from '../math/quat';
import { scale, type Vec3 } from '../math/vec3';
import { ok, type SimResult } from '../result';
import { computeForces } from './forces';
import type { FlightEnvironment, FlightSettings } from './types';

interface StateDerivative {
  readonly position: Vec3;
  readonly linearVelocity: Vec3;
  readonly orientation: Quat;
  readonly angularVelocity: Vec3;
}

function evaluate(
  state: RigidBodyState, ball: BallParams, environment: FlightEnvironment, settings: FlightSettings,
): SimResult<StateDerivative> {
  const loads = computeForces(state, ball, environment, settings.forces, settings.thresholds);
  if (!loads.ok) return loads;
  // 球は等方的なので I = κ m R² E、ω̇ = τ / (κ m R²)（05 §5.1）。
  const inertia = ball.inertiaCoefficient * ball.mass * ball.radius * ball.radius;
  return ok({
    position: state.linearVelocity,
    linearVelocity: scale(loads.value.force, 1 / ball.mass),
    orientation: quatDerivative(state.orientation, state.angularVelocity),
    angularVelocity: scale(loads.value.torque, 1 / inertia),
  });
}

function addVec(a: Vec3, b: Vec3, s: number): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

function addQuat(a: Quat, b: Quat, s: number): Quat {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s, a[3] + b[3] * s];
}

/** state + d * s（四元数は正規化しない：ステージ内の中間状態）。 */
function advance(state: RigidBodyState, d: StateDerivative, s: number): RigidBodyState {
  return {
    position: addVec(state.position, d.position, s),
    linearVelocity: addVec(state.linearVelocity, d.linearVelocity, s),
    orientation: addQuat(state.orientation, d.orientation, s),
    angularVelocity: addVec(state.angularVelocity, d.angularVelocity, s),
  };
}

function combine4<T extends readonly number[]>(k1: T, k2: T, k3: T, k4: T): T {
  return k1.map((v, i) => (v + 2 * k2[i]! + 2 * k3[i]! + k4[i]!) / 6) as unknown as T;
}

/** 刻み dt の RK4 を 1 ステップ進める。 */
export function rk4Step(
  state: RigidBodyState, dt: number, ball: BallParams, environment: FlightEnvironment, settings: FlightSettings,
): SimResult<RigidBodyState> {
  const k1 = evaluate(state, ball, environment, settings);
  if (!k1.ok) return k1;
  const k2 = evaluate(advance(state, k1.value, dt / 2), ball, environment, settings);
  if (!k2.ok) return k2;
  const k3 = evaluate(advance(state, k2.value, dt / 2), ball, environment, settings);
  if (!k3.ok) return k3;
  const k4 = evaluate(advance(state, k3.value, dt), ball, environment, settings);
  if (!k4.ok) return k4;
  const slope: StateDerivative = {
    position: combine4(k1.value.position, k2.value.position, k3.value.position, k4.value.position),
    linearVelocity: combine4(k1.value.linearVelocity, k2.value.linearVelocity, k3.value.linearVelocity, k4.value.linearVelocity),
    orientation: combine4(k1.value.orientation, k2.value.orientation, k3.value.orientation, k4.value.orientation),
    angularVelocity: combine4(k1.value.angularVelocity, k2.value.angularVelocity, k3.value.angularVelocity, k4.value.angularVelocity),
  };
  const next = advance(state, slope, dt);
  return ok({ ...next, orientation: normalizeQuat(next.orientation) });
}

/**
 * 初期状態から settings.timeStep の刻みで steps 回積分し、時刻 k Δt（k = 0…steps）の状態を返す。
 * 地面イベントは扱わない（T1.2-07）。
 */
export function integrateFixedSteps(
  initial: RigidBodyState, steps: number, ball: BallParams, environment: FlightEnvironment, settings: FlightSettings,
): SimResult<RigidBodyState[]> {
  const states: RigidBodyState[] = [initial];
  let current = initial;
  for (let k = 0; k < steps; k++) {
    const next = rk4Step(current, settings.timeStep, ball, environment, settings);
    if (!next.ok) return next;
    current = next.value;
    states.push(current);
  }
  return ok(states);
}
