// キック入力から物理的に整合した衝突直前の状態を組み立てる（docs/05-physics-model.md §6.2）。
import type { RigidBodyState } from '../bodies/types';
import { fromColumns } from '../math/mat3';
import { fromMat3, IDENTITY_QUAT } from '../math/quat';
import { add, addScaled, cross, dot, isFiniteVec3, length, normalize, scale, sub, UNIT_X, UNIT_Y, type Vec3 } from '../math/vec3';
import { fail, ok, type SimResult } from '../result';
import type { ImpactGeometryParameters, ImpactSetup, KickInput } from './types';

/** v を接触平面（n に垂直な平面）へ射影したベクトル v − (v·n) n。 */
function projectOntoPlane(v: Vec3, n: Vec3): Vec3 {
  return addScaled(v, n, -dot(v, n));
}

/**
 * 長さが 0 でない有限のベクトルの向き（単位ベクトル）。成分の最大絶対値で先に割ってから正規化するため、
 * 成分が倍精度の最大値付近（ノルムが桁あふれする）や非正規化数（ノルムが丸められる）でも正しい向きを返す
 * （IV-02-C の I02-D01 を受けて変更、2026-10-18）。
 */
function unitDirection(v: Vec3): Vec3 {
  const largest = Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  // 1/largest を掛けると、非正規化数では逆数が桁あふれするため、各成分を割る。
  return normalize([v[0] / largest, v[1] / largest, v[2] / largest]);
}

/**
 * 足の物体座標の軸（ワールド座標）。z_b = n、φ = 0 で y_b は ŷ の射影の向き（射影の長さが ε_φ 以下なら x̂ の射影）、
 * φ は n まわりの右ねじの向き、x_b = y_b × z_b（05 §6.2）。
 */
export function footAxes(n: Vec3, roll: number, referenceThreshold: number): { x: Vec3; y: Vec3; z: Vec3 } {
  const projectedUp = projectOntoPlane(UNIT_Y, n);
  const reference = length(projectedUp) > referenceThreshold ? projectedUp : projectOntoPlane(UNIT_X, n);
  const y0 = normalize(reference);
  const y = add(scale(y0, Math.cos(roll)), scale(cross(n, y0), Math.sin(roll)));
  return { x: cross(y, n), y, z: n };
}

/**
 * 05 §6.2 の入力の検証を行い、衝突直前の状態を返す。ボールは地面上で静止（05 §4）。
 * 入力の誤り（有限でない値、d の長さ 0、接触面の外、離反方向の速度）は SimResult のエラー。
 */
export function buildImpactSetup(input: KickInput, params: ImpactGeometryParameters): SimResult<ImpactSetup> {
  // ε_φ は 0 ≤ ε_φ < 1 に限る：単位法線では |ŷ の射影|² = 1 − n_y²、|x̂ の射影|² = 1 − n_x² なので、
  // ŷ の射影が ε_φ 以下のとき x̂ の射影の長さは √(1 − ε_φ²) 以上で 0 にならない。範囲外では零ベクトルを正規化しうる。
  const epsPhi = params.rollReferenceThreshold;
  if (!(Number.isFinite(epsPhi) && epsPhi >= 0 && epsPhi < 1)) {
    return fail('invalid-parameter', `roll reference threshold ε_φ must satisfy 0 ≤ ε_φ < 1 (${epsPhi})`);
  }
  const [sx, sy] = input.footContactLocation;
  const finite = isFiniteVec3(input.contactDirection) && Number.isFinite(input.footRollAboutNormal) && Number.isFinite(sx) && Number.isFinite(sy)
    && isFiniteVec3(input.footContactPointVelocity) && isFiniteVec3(input.footAngularVelocity);
  if (!finite) return fail('invalid-input', 'kick input contains a non-finite value');
  if (!(length(input.contactDirection) > 0)) return fail('invalid-input', 'contact direction d has zero length');
  const [lx, ly, lz] = params.foot.shape.dimensions;
  if (Math.abs(sx) >= lx / 2 || Math.abs(sy) >= ly / 2) {
    return fail('invalid-input', `contact location (${sx}, ${sy}) is outside the contact face (|s_x| < ${lx / 2}, |s_y| < ${ly / 2})`);
  }

  const d = unitDirection(input.contactDirection);
  const n = scale(d, -1);
  const ballCenter: Vec3 = [0, params.ball.radius, 0];
  const contactPoint = addScaled(ballCenter, d, params.ball.radius);
  // ボールは静止しているので u⁻ = −v_A^p、u_n⁻ < 0 ⇔ v_A^p · n > 0。
  const approach = dot(input.footContactPointVelocity, n);
  if (!(approach > 0)) return fail('separating-input', `foot contact point velocity is not approaching the ball (v_A^p · n = ${approach})`);

  const axes = footAxes(n, input.footRollAboutNormal, params.rollReferenceThreshold);
  const orientation = fromMat3(fromColumns(axes.x, axes.y, axes.z));
  const footArm = add(add(scale(axes.x, sx), scale(axes.y, sy)), scale(axes.z, lz / 2)); // r_A = R (s_x, s_y, L_z/2)
  const ball: RigidBodyState = { position: ballCenter, orientation: IDENTITY_QUAT, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] };
  const foot: RigidBodyState = {
    position: sub(contactPoint, footArm),
    orientation,
    linearVelocity: sub(input.footContactPointVelocity, cross(input.footAngularVelocity, footArm)),
    angularVelocity: input.footAngularVelocity,
  };
  return ok({ ball, foot, contactPoint, contactNormal: n });
}
