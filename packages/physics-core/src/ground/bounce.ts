// 地面でのバウンド（docs/05-physics-model.md §8.1、§8.3）。
// 地面を無限質量で静止した剛体として、足–ボールと同じソルバー（05 §6.8）を使う：n = +ŷ、r_B = −R ŷ、地面の速度 0。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { validateBall } from '../bodies/validate';
import { solveContact, type ContactCoefficients } from '../contact/solver';
import type { ImpactResult } from '../contact/types';
import { GROUND_HEIGHT, WORLD_UP } from '../frames';
import type { GroundContactHandler } from '../flight/types';
import { IDENTITY_QUAT } from '../math/quat';
import type { Vec3 } from '../math/vec3';
import { fail, ok, type SimResult } from '../result';
import { advanceRolling, constrainToGround, isStopped, type RollingParameters } from './rolling';

/** 地面上のボールのバウンド（衝突直前の状態 → 衝突直後の状態）。係数は e_g（P-15）、μ_g（P-16）、ε_t（P-25）。 */
export function solveGroundBounce(ballState: RigidBodyState, ball: BallParams, coefficients: ContactCoefficients): SimResult<ImpactResult> {
  const contactPoint: Vec3 = [ballState.position[0], GROUND_HEIGHT, ballState.position[2]];
  const ground: RigidBodyState = { position: contactPoint, orientation: IDENTITY_QUAT, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] };
  return solveContact({ ball: ballState, foot: ground, contactPoint, contactNormal: WORLD_UP }, ball, null, coefficients);
}

/**
 * 飛翔の接地の処理（05 §7.7）としてのバウンドだけを行う（転がりへ移らない）。飛翔中の接地と、飛翔の開始時に地面へ向かう
 * 速度を持つ場合（05 §8.3）の両方に使う。地面上に残る結果（v_y⁺ ≤ 0）になると飛翔はエラーを返すため、転がりを含む
 * 通常の計算には groundHandler を使う。
 */
export function groundBounceHandler(ball: BallParams, coefficients: ContactCoefficients): GroundContactHandler {
  return (contact) => {
    const bounce = solveGroundBounce(contact.state, ball, coefficients);
    if (!bounce.ok) return bounce;
    return ok({ kind: 'continue', state: bounce.value.ballAfter });
  };
}

/** 地面の係数・閾値（05 §8、P-15〜P-17・P-19・P-25）。値は未決定で、Core は既定値を持たない。 */
export interface GroundParameters extends ContactCoefficients, RollingParameters {
  /** v_rest m/s（P-19）：衝突直前の法線速度 |u_n⁻| がこれ以下なら転がりへ移る（05 §8.1） */
  readonly restSpeed: number;
}

function validateGround(ball: BallParams, params: GroundParameters): SimResult<void> {
  const ballValid = validateBall(ball);
  if (!ballValid.ok) return ballValid;
  const { restitution: e, friction: mu, rollingResistance: muR } = params;
  if (!(Number.isFinite(e) && e >= 0 && e <= 1)) return fail('invalid-parameter', `ground restitution must be in [0, 1] (${e})`);
  const nonNegative: Array<[string, number]> = [
    ['ground friction μ_g', mu], ['rolling resistance μ_r', muR], ['tangential speed threshold ε_t', params.tangentialSpeedThreshold],
    ['rest speed v_rest', params.restSpeed], ['stop speed v_stop', params.stopSpeed], ['stop spin ω_stop', params.stopSpin],
  ];
  for (const [name, value] of nonNegative) {
    if (!(Number.isFinite(value) && value >= 0)) return fail('invalid-parameter', `${name} must be finite and non-negative (${value})`);
  }
  if (!(Number.isFinite(params.gravity) && params.gravity > 0)) return fail('invalid-parameter', `gravity must be finite and positive (${params.gravity})`);
  // 純転がりを保つのに必要な静止摩擦力 κ μ_r m g / (1 + κ) が μ_g m g を超える構成は扱わない（05 §8.2、決定 2026-10-19）。
  const kappa = ball.inertiaCoefficient;
  if ((kappa * muR) / (1 + kappa) > mu) {
    return fail('invalid-parameter', `pure rolling requires κ μ_r / (1 + κ) ≤ μ_g (κ = ${kappa}, μ_r = ${muR}, μ_g = ${mu})`);
  }
  return ok(undefined);
}

/**
 * 飛翔の接地の処理（05 §7.7、§8.1〜8.3）：衝突直前の法線速度 |u_n⁻| が v_rest を超えればバウンドとして解き、
 * v_rest 以下（または e_g = 0）なら e_g = 0 の衝突として解いてから y = R、v_y = 0 として転がりに移る。
 * e_g > 0 では条件 e_g v_rest ≥ g Δt / 2（05 §7.7）を接地のたびに飛翔の Δt で確かめ、満たさなければ invalid-parameter。
 */
export function groundHandler(ball: BallParams, params: GroundParameters): SimResult<GroundContactHandler> {
  const valid = validateGround(ball, params);
  if (!valid.ok) return valid;
  const rolling = {
    advance: (state: RigidBodyState, duration: number) => advanceRolling(state, ball, params, duration),
    isStopped: (state: RigidBodyState) => isStopped(state, params),
  };
  return ok((contact) => {
    const e = params.restitution;
    if (e > 0 && !(e * params.restSpeed >= (params.gravity * contact.timeStep) / 2)) {
      return fail('invalid-parameter', `the rest speed must satisfy e_g v_rest ≥ g Δt / 2 (e_g = ${e}, v_rest = ${params.restSpeed}, Δt = ${contact.timeStep})`);
    }
    // 地面は静止し n = ŷ、r_B = −R ŷ なので、接触点の法線速度は重心の v_y。
    const normalSpeed = -contact.state.linearVelocity[1];
    if (e > 0 && normalSpeed > params.restSpeed) {
      const bounce = solveGroundBounce(contact.state, ball, params);
      if (!bounce.ok) return bounce;
      return ok({ kind: 'continue', state: bounce.value.ballAfter });
    }
    const settle = solveGroundBounce(contact.state, ball, { ...params, restitution: 0 });
    if (!settle.ok) return settle;
    return ok({ kind: 'roll', state: constrainToGround(settle.value.ballAfter, ball.radius), rolling });
  });
}
