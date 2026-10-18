// 地面でのバウンド（docs/05-physics-model.md §8.1、§8.3）。
// 地面を無限質量で静止した剛体として、足–ボールと同じソルバー（05 §6.8）を使う：n = +ŷ、r_B = −R ŷ、地面の速度 0。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { solveContact, type ContactCoefficients } from '../contact/solver';
import type { ImpactResult } from '../contact/types';
import { GROUND_HEIGHT, WORLD_UP } from '../frames';
import type { GroundContactHandler } from '../flight/types';
import { IDENTITY_QUAT } from '../math/quat';
import type { Vec3 } from '../math/vec3';
import { ok, type SimResult } from '../result';

/** 地面上のボールのバウンド（衝突直前の状態 → 衝突直後の状態）。係数は e_g（P-15）、μ_g（P-16）、ε_t（P-25）。 */
export function solveGroundBounce(ballState: RigidBodyState, ball: BallParams, coefficients: ContactCoefficients): SimResult<ImpactResult> {
  const contactPoint: Vec3 = [ballState.position[0], GROUND_HEIGHT, ballState.position[2]];
  const ground: RigidBodyState = { position: contactPoint, orientation: IDENTITY_QUAT, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] };
  return solveContact({ ball: ballState, foot: ground, contactPoint, contactNormal: WORLD_UP }, ball, null, coefficients);
}

/**
 * 飛翔の接地の処理（05 §7.7）としてのバウンド。飛翔中の接地と、飛翔の開始時に地面へ向かう速度を持つ場合（05 §8.3）の
 * 両方に使う。転がりへの移行（|u_n⁻| ≤ v_rest、05 §8.1）は T1.3-08 で扱い、ここでは常にバウンドとして解く。
 */
export function groundBounceHandler(ball: BallParams, coefficients: ContactCoefficients): GroundContactHandler {
  return (contact) => {
    const bounce = solveGroundBounce(contact.state, ball, coefficients);
    if (!bounce.ok) return bounce;
    return ok({ kind: 'continue', state: bounce.value.ballAfter });
  };
}
