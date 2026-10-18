// 瞬間点接触のソルバー（docs/05-physics-model.md §6.3〜6.9）。
// Newton の反発係数（法線）と Coulomb 摩擦（接線）の代数解。
import { ballInertia, inertiaWorld } from '../bodies/dynamics';
import type { RigidBodyState } from '../bodies/types';
import { mulVec, solve } from '../math/mat3';
import { add, addScaled, cross, dot, length, normalize, scale, sub, type Vec3 } from '../math/vec3';
import { fail, ok, type SimResult } from '../result';
import { contactMatrix, finiteInertia, KINEMATIC_INERTIA, type ImpactInertia } from './k-matrix';
import type { ContactParameters, FootModel, ImpactRegime, ImpactResult, ImpactSetup } from './types';

/** 接触点の速度 v + ω × r（05 §6.3）。 */
export function pointVelocity(state: RigidBodyState, arm: Vec3): Vec3 {
  return add(state.linearVelocity, cross(state.angularVelocity, arm));
}

function applyImpulse(state: RigidBodyState, body: ImpactInertia, arm: Vec3, impulse: Vec3): RigidBodyState {
  if (body.inverseMass === 0) return state; // 運動学的な物体は衝撃で変化しない（05 §6.9）
  return {
    ...state,
    linearVelocity: addScaled(state.linearVelocity, impulse, body.inverseMass),
    angularVelocity: add(state.angularVelocity, mulVec(body.inverseInertiaWorld, cross(arm, impulse))),
  };
}

function validate(params: ContactParameters): SimResult<void> {
  const { restitution: e, friction: mu, tangentialSpeedThreshold: epsT } = params;
  if (!(Number.isFinite(e) && e >= 0 && e <= 1)) return fail('invalid-parameter', `restitution must be in [0, 1] (${e})`);
  if (!(Number.isFinite(mu) && mu >= 0)) return fail('invalid-parameter', `friction must be finite and non-negative (${mu})`);
  if (!(Number.isFinite(epsT) && epsT >= 0)) return fail('invalid-parameter', `tangential speed threshold must be finite and non-negative (${epsT})`);
  return ok(undefined);
}

/**
 * 衝突直前の状態から衝突直後の状態を求める（05 §6.8）。
 * 想定内の失敗（係数の範囲外、解けない構成）は SimResult のエラーで返す（04 §6）。
 */
export function solveImpact(setup: ImpactSetup, params: ContactParameters, model: FootModel): SimResult<ImpactResult> {
  const valid = validate(params);
  if (!valid.ok) return valid;
  const n = normalize(setup.contactNormal);
  const ballArm = sub(setup.contactPoint, setup.ball.position);
  const footArm = sub(setup.contactPoint, setup.foot.position);
  const ballBody = finiteInertia(params.ball.mass, ballInertia(params.ball));
  const footBody = model === 'kinematic-wall'
    ? KINEMATIC_INERTIA
    : finiteInertia(params.foot.mass, inertiaWorld(params.foot.inertiaBody, setup.foot.orientation));

  const uBefore = sub(pointVelocity(setup.ball, ballArm), pointVelocity(setup.foot, footArm));
  const unBefore = dot(uBefore, n);
  // 1. 離反（u_n⁻ ≥ 0）：衝撃量 0、状態は変化しない。
  if (unBefore >= 0) {
    return ok({
      impulse: [0, 0, 0], regime: 'separating', ballAfter: setup.ball, footAfter: setup.foot,
      diagnostics: { relativeVelocityBefore: uBefore, relativeVelocityAfter: uBefore },
    });
  }

  const K = contactMatrix(footBody, footArm, ballBody, ballArm);
  const e = params.restitution;
  const mu = params.friction;
  // 2. 固着を仮定した解 J* = K⁻¹(−e u_n⁻ n − u⁻)。
  const stickImpulse = solve(K, sub(scale(n, -e * unBefore), uBefore));
  const jnStick = dot(stickImpulse, n);
  const jtStick = sub(stickImpulse, scale(n, jnStick));

  let impulse: Vec3;
  let regime: ImpactRegime;
  if (jnStick >= 0 && length(jtStick) <= mu * jnStick) {
    // 3. 固着。
    impulse = stickImpulse;
    regime = 'stick';
  } else if (mu === 0) {
    // 4. 滑り（摩擦なし）：J = j_n n、j_n = −(1 + e) u_n⁻ / (nᵀ K n)。滑り方向は使わない。
    const denominator = dot(n, mulVec(K, n));
    impulse = scale(n, (-(1 + e) * unBefore) / denominator);
    regime = 'slide';
  } else {
    return fail('unsupported-model', 'friction (μ > 0) is not implemented yet (T1.3-03)');
  }

  const ballAfter = applyImpulse(setup.ball, ballBody, ballArm, impulse);
  const footAfter = applyImpulse(setup.foot, footBody, footArm, scale(impulse, -1));
  const uAfter = sub(pointVelocity(ballAfter, ballArm), pointVelocity(footAfter, footArm));
  return ok({ impulse, regime, ballAfter, footAfter, diagnostics: { relativeVelocityBefore: uBefore, relativeVelocityAfter: uAfter } });
}
