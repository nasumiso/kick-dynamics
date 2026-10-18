// 飛翔中にボールに働く力とトルク（docs/05-physics-model.md §7.2〜7.6）。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { gravityVector } from '../frames';
import { add, length, scale, sub, ZERO, type Vec3 } from '../math/vec3';
import { fail, ok, type SimResult } from '../result';
import type { CoefficientModel, DegeneracyThresholds, FlightEnvironment, FlightForceSettings, ForceAndTorque } from './types';

export interface AeroContext {
  /** 相対速度 v_r = v − w */
  readonly relativeVelocity: Vec3;
  readonly speed: number;
  /** Re = ρ |v_r| (2R) / η */
  readonly reynolds: number;
  /** S = R |ω| / |v_r|（|ω| と |ω_⊥| のどちらで定義するかは未決定、05 §7.6。暫定で |ω|） */
  readonly spinParameter: number;
}

/** 係数モデルを評価する。結果が有限でない、または nonNegative なのに負なら SimResult のエラー（04 §6）。 */
export function evaluateCoefficient(
  model: CoefficientModel, context: AeroContext, name: string, nonNegative: boolean,
): SimResult<number> {
  const value = model.kind === 'constant' ? model.value : model.evaluate(context.reynolds, context.spinParameter);
  if (!Number.isFinite(value)) {
    return fail('invalid-coefficient', `${name} is not finite (${value})`);
  }
  if (nonNegative && value < 0) {
    return fail('invalid-coefficient', `${name} must be non-negative (${value})`);
  }
  return ok(value);
}

/** 抗力 F_D = −½ ρ A C_D |v_r| v_r（05 §7.3）。 */
export function dragForce(
  context: AeroContext, ball: BallParams, environment: FlightEnvironment, coefficient: CoefficientModel,
): SimResult<Vec3> {
  const cd = evaluateCoefficient(coefficient, context, 'C_D', true);
  if (!cd.ok) return cd;
  const area = Math.PI * ball.radius * ball.radius;
  return ok(scale(context.relativeVelocity, -0.5 * environment.airDensity * area * cd.value * context.speed));
}

/** 状態 state のボールに働く力とトルク（ワールド座標）。 */
export function computeForces(
  state: RigidBodyState,
  ball: BallParams,
  environment: FlightEnvironment,
  forces: FlightForceSettings,
  thresholds: DegeneracyThresholds,
): SimResult<ForceAndTorque> {
  let force: Vec3 = forces.gravity ? scale(gravityVector(environment.gravity), ball.mass) : ZERO;
  const torque: Vec3 = ZERO;

  const relativeVelocity = sub(state.linearVelocity, environment.wind);
  const speed = length(relativeVelocity);
  // ゼロ速度：|v_r| ≤ ε_v のときは空力をすべて 0 とし、係数を評価しない（05 §7.3）。
  if (speed <= thresholds.zeroSpeed) {
    return ok({ force, torque });
  }
  const context: AeroContext = {
    relativeVelocity,
    speed,
    reynolds: (environment.airDensity * speed * 2 * ball.radius) / environment.airViscosity,
    spinParameter: (ball.radius * length(state.angularVelocity)) / speed,
  };

  if (forces.drag.enabled) {
    const drag = dragForce(context, ball, environment, forces.drag.coefficient);
    if (!drag.ok) return drag;
    force = add(force, drag.value);
  }
  if (forces.magnus.enabled) {
    return fail('unsupported-model', 'Magnus force is not implemented yet (T1.2-05)');
  }
  if (forces.spinDecay.kind !== 'none') {
    return fail('unsupported-model', 'spin decay is not implemented yet (T1.2-06)');
  }
  return ok({ force, torque });
}
