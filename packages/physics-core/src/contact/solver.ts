// 瞬間点接触のソルバー（docs/05-physics-model.md §6.3〜6.9）。
// Newton の反発係数（法線）と Coulomb 摩擦（接線）の代数解。
import { angularMomentum, ballInertia, inertiaWorld, kineticEnergy, linearMomentum, type MassProperties } from '../bodies/dynamics';
import type { BallParams, RigidBodyState } from '../bodies/types';
import { validateBall, validateFoot, validateMassProperties } from '../bodies/validate';
import { mulVec, solve } from '../math/mat3';
import { add, addScaled, cross, dot, isFiniteVec3, length, normalize, scale, sub, type Vec3 } from '../math/vec3';
import { fail, ok, type SimResult } from '../result';
import { contactMatrix, finiteInertia, KINEMATIC_INERTIA, type ImpactInertia } from './k-matrix';
import type { ContactParameters, FootModel, ImpactRegime, ImpactResult, ImpactSetup, ImpactWarning } from './types';

/**
 * 警告の判定に使う相対的な幅（05 §10.2 P-28、仮置き）。ΔT は ½|J|(|u⁻| + |u⁺|) に対して、
 * 滑り方向の反転は |u⁻| に対して、この比率を超えたときだけ警告する（丸め誤差で警告しないため）。
 */
export const DIAGNOSTIC_RELATIVE_TOLERANCE = 1e-9;

/** 衝突直前の状態のすべての値（位置・姿勢・速度・角速度・接触点・法線）が有限か。 */
export function isFiniteSetup(setup: ImpactSetup): boolean {
  const states = [setup.ball, setup.foot];
  return states.every((s) => isFiniteVec3(s.position) && isFiniteVec3(s.linearVelocity) && isFiniteVec3(s.angularVelocity) && s.orientation.every(Number.isFinite))
    && isFiniteVec3(setup.contactPoint) && isFiniteVec3(setup.contactNormal);
}

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

/** 反発・摩擦の係数と ε_t（足–ボールでは P-07・P-08、地面では P-15・P-16、共通の P-25）。 */
export interface ContactCoefficients {
  readonly restitution: number;
  readonly friction: number;
  readonly tangentialSpeedThreshold: number;
}

function validate(params: ContactCoefficients): SimResult<void> {
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
  if (model === 'finite-mass') {
    const footValid = validateFoot(params.foot);
    if (!footValid.ok) return footValid;
  }
  const footMassProperties: MassProperties | null = model === 'kinematic-wall'
    ? null
    : { mass: params.foot.mass, inertiaWorld: inertiaWorld(params.foot.inertiaBody, setup.foot.orientation) };
  return solveContact(setup, params.ball, footMassProperties, params);
}

/**
 * ボールと相手の物体（setup.foot。有限質量なら footMassProperties、運動学的な物体なら null）の瞬間点接触を解く。
 * 足との衝突（solveImpact）と、地面との衝突（無限質量で静止した物体、05 §8.1）で共通に使う。
 */
export function solveContact(
  setup: ImpactSetup, ballParams: BallParams, footMassProperties: MassProperties | null, params: ContactCoefficients,
): SimResult<ImpactResult> {
  const valid = validate(params);
  if (!valid.ok) return valid;
  const ballValid = validateBall(ballParams);
  if (!ballValid.ok) return ballValid;
  if (footMassProperties !== null) {
    const otherValid = validateMassProperties(footMassProperties.mass, footMassProperties.inertiaWorld);
    if (!otherValid.ok) return otherValid;
  }
  if (!isFiniteSetup(setup)) return fail('invalid-input', 'impact setup contains a non-finite value');
  if (!(length(setup.contactNormal) > 0)) return fail('invalid-input', 'contact normal has zero length');
  const n = normalize(setup.contactNormal);
  const ballArm = sub(setup.contactPoint, setup.ball.position);
  const footArm = sub(setup.contactPoint, setup.foot.position);
  const ballBody = finiteInertia(ballParams.mass, ballInertia(ballParams));
  const ballMassProperties: MassProperties = { mass: ballParams.mass, inertiaWorld: ballInertia(ballParams) };
  const footBody = footMassProperties === null ? KINEMATIC_INERTIA : finiteInertia(footMassProperties.mass, footMassProperties.inertiaWorld);
  const momenta = (ballState: RigidBodyState, footState: RigidBodyState) => footMassProperties === null ? null : {
    momentum: add(linearMomentum(ballMassProperties, ballState), linearMomentum(footMassProperties, footState)),
    angularMomentum: add(
      angularMomentum(ballMassProperties, ballState, setup.contactPoint), angularMomentum(footMassProperties, footState, setup.contactPoint),
    ),
  };
  const momentaBefore = momenta(setup.ball, setup.foot);
  const ballEnergyBefore = kineticEnergy(ballMassProperties, setup.ball);
  const uBefore = sub(pointVelocity(setup.ball, ballArm), pointVelocity(setup.foot, footArm));
  const unBefore = dot(uBefore, n);
  // 1. 離反（u_n⁻ ≥ 0）：衝撃量 0、状態は変化しない。
  if (unBefore >= 0) {
    return ok({
      impulse: [0, 0, 0], regime: 'separating', ballAfter: setup.ball, footAfter: setup.foot,
      diagnostics: {
        relativeVelocityBefore: uBefore, relativeVelocityAfter: uBefore, kineticEnergyChange: 0,
        ballKineticEnergyBefore: ballEnergyBefore, ballKineticEnergyAfter: ballEnergyBefore,
        systemMomentum: momentaBefore && { before: momentaBefore.momentum, after: momentaBefore.momentum },
        systemAngularMomentum: momentaBefore && { before: momentaBefore.angularMomentum, after: momentaBefore.angularMomentum },
        slidingDirection: null, warnings: [],
      },
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
  let slidingDirection: Vec3 | null = null;
  const warnings: ImpactWarning[] = [];
  const unsolvable = (reason: string) => fail<ImpactResult>('impact-unsolvable', reason, {
    relativeVelocityBefore: uBefore, contactMatrix: K, stickImpulse,
  });
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
    // 4. 滑り：J = j_n (n − μ t̂)、j_n = −(1 + e) u_n⁻ / (nᵀ K (n − μ t̂))。
    const utBefore = sub(uBefore, scale(n, unBefore));
    const utSpeed = length(utBefore);
    let t: Vec3;
    if (utSpeed > params.tangentialSpeedThreshold) {
      t = scale(utBefore, 1 / utSpeed);
    } else {
      // 接線速度がほぼ 0 なのに固着解が摩擦円錐を外れる（K の連成による）：−J*_t の向きを近似として使う。
      const jtLength = length(jtStick);
      if (!(jtLength > 0)) return unsolvable('sliding direction is undefined: |u_t⁻| ≤ ε_t and J*_t = 0');
      t = scale(jtStick, -1 / jtLength);
      warnings.push('tangent-direction-approximated');
    }
    const direction = addScaled(n, t, -mu);
    const denominator = dot(n, mulVec(K, direction));
    if (!(denominator > 0)) return unsolvable(`nᵀ K (n − μ t̂) = ${denominator} ≤ 0`);
    impulse = scale(direction, (-(1 + e) * unBefore) / denominator);
    regime = 'slide';
    slidingDirection = t;
  }

  const ballAfter = applyImpulse(setup.ball, ballBody, ballArm, impulse);
  const footAfter = applyImpulse(setup.foot, footBody, footArm, scale(impulse, -1));
  const uAfter = sub(pointVelocity(ballAfter, ballArm), pointVelocity(footAfter, footArm));
  const momentaAfter = momenta(ballAfter, footAfter);

  // 5. 診断：エネルギーの増加と滑り方向の反転は、結果を補正せずに警告する（05 §6.8、§6.11）。
  const kineticEnergyChange = 0.5 * dot(impulse, add(uBefore, uAfter));
  const energyScale = 0.5 * length(impulse) * (length(uBefore) + length(uAfter));
  const footTranslatesOnly = length(setup.foot.angularVelocity) === 0;
  if ((footMassProperties !== null || footTranslatesOnly) && kineticEnergyChange > DIAGNOSTIC_RELATIVE_TOLERANCE * energyScale) {
    warnings.push('energy-increase');
  }
  if (slidingDirection !== null) {
    const utAfter = sub(uAfter, scale(n, dot(uAfter, n)));
    if (dot(utAfter, slidingDirection) < -DIAGNOSTIC_RELATIVE_TOLERANCE * length(uBefore)) warnings.push('slip-reversal');
  }
  return ok({
    impulse, regime, ballAfter, footAfter,
    diagnostics: {
      relativeVelocityBefore: uBefore,
      relativeVelocityAfter: uAfter,
      kineticEnergyChange,
      ballKineticEnergyBefore: ballEnergyBefore,
      ballKineticEnergyAfter: kineticEnergy(ballMassProperties, ballAfter),
      systemMomentum: momentaBefore && momentaAfter && { before: momentaBefore.momentum, after: momentaAfter.momentum },
      systemAngularMomentum: momentaBefore && momentaAfter && { before: momentaBefore.angularMomentum, after: momentaAfter.angularMomentum },
      slidingDirection,
      warnings,
    },
  });
}
