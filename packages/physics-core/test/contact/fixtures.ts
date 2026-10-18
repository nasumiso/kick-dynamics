// 接触のテストで共通に使う値と、衝突直前の状態の組み立て。
// 足は 05 §10.2 の仮置き（P-04〜P-06）、ボールはテスト用の任意の値（P-01〜P-03 は採用値が未決定）。
import { ballInertia, boxInertia, inertiaWorld, kineticEnergy, type MassProperties } from '../../src/bodies/dynamics';
import type { BallParams, FootParams, RigidBodyState } from '../../src/bodies/types';
import type { ContactParameters, ImpactSetup } from '../../src/contact/types';
import { IDENTITY_QUAT, type Quat } from '../../src/math/quat';
import { addScaled, cross, normalize as normalizeVec, sub, type Vec3 } from '../../src/math/vec3';

export const ball: BallParams = { mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 };
const dimensions: Vec3 = [0.26, 0.1, 0.08];
export const foot: FootParams = { mass: 1.2, inertiaBody: boxInertia(1.2, dimensions), shape: { kind: 'box', dimensions } };

/** P-25 ε_t の仮置きの値（05 §10.2）。 */
export const TANGENTIAL_SPEED_THRESHOLD = 1e-9;

export function contactParams(restitution: number, friction: number): ContactParameters {
  return { ball, foot, restitution, friction, tangentialSpeedThreshold: TANGENTIAL_SPEED_THRESHOLD };
}

export interface SetupSpec {
  /** 接触法線 n（足 → ボール、単位ベクトル） */
  readonly normal: Vec3;
  /** 足の重心 → 接触点 r_A（ワールド座標） */
  readonly footArm: Vec3;
  /** 接触点での足の速度 v_A^p */
  readonly footPointVelocity: Vec3;
  readonly footAngularVelocity?: Vec3;
  readonly footOrientation?: Quat;
  /** ボールの衝突直前の状態（既定は地面上で静止、05 §4） */
  readonly ballVelocity?: Vec3;
  readonly ballAngularVelocity?: Vec3;
}

/** 05 §6.2・§6.3 の関係で衝突直前の状態を組み立てる（buildImpactSetup とは独立のテスト用の実装）。 */
export function makeSetup(spec: SetupSpec): ImpactSetup {
  const ballCenter: Vec3 = [0, ball.radius, 0];
  const contactPoint = addScaled(ballCenter, spec.normal, -ball.radius); // p = x_B + R d、d = −n
  const footAngular = spec.footAngularVelocity ?? [0, 0, 0];
  const ballState: RigidBodyState = {
    position: ballCenter, orientation: IDENTITY_QUAT,
    linearVelocity: spec.ballVelocity ?? [0, 0, 0], angularVelocity: spec.ballAngularVelocity ?? [0, 0, 0],
  };
  const footState: RigidBodyState = {
    position: sub(contactPoint, spec.footArm),
    orientation: spec.footOrientation ?? IDENTITY_QUAT,
    linearVelocity: sub(spec.footPointVelocity, cross(footAngular, spec.footArm)),
    angularVelocity: footAngular,
  };
  return { ball: ballState, foot: footState, contactPoint, contactNormal: spec.normal };
}

export function ballMass(): MassProperties {
  return { mass: ball.mass, inertiaWorld: ballInertia(ball) };
}

export function footMass(orientation: Quat): MassProperties {
  return { mass: foot.mass, inertiaWorld: inertiaWorld(foot.inertiaBody, orientation) };
}

/** 足とボールの運動エネルギーの合計。 */
export function totalKineticEnergy(setupBall: RigidBodyState, setupFoot: RigidBodyState): number {
  return kineticEnergy(ballMass(), setupBall) + kineticEnergy(footMass(setupFoot.orientation), setupFoot);
}

/**
 * 05 §6.2 と整合する足の姿勢と r_A（テスト用、buildImpactSetup とは独立）：接触面 +z_b の外向き法線が n、
 * y_b は ŷ を接触平面へ射影した向き（φ = 0）、r_A = s_x x_b + s_y y_b + (L_z/2) n。n が ŷ と平行に近い場合は使わない。
 */
export function footPose(normal: Vec3, sx: number, sy: number): { orientation: Quat; arm: Vec3 } {
  const n = normal;
  const yb = normalizeVec(sub([0, 1, 0], [n[0] * n[1], n[1] * n[1], n[2] * n[1]]));
  const xb = cross(yb, n);
  const half = foot.shape.dimensions[2] / 2;
  const arm: Vec3 = [
    sx * xb[0] + sy * yb[0] + half * n[0], sx * xb[1] + sy * yb[1] + half * n[1], sx * xb[2] + sy * yb[2] + half * n[2],
  ];
  // 列が (x_b, y_b, n) の回転行列から四元数を求める（トレースが正の場合の式で足りる範囲だけで使う）。
  const m = [xb[0], yb[0], n[0], xb[1], yb[1], n[1], xb[2], yb[2], n[2]] as const;
  const trace = m[0] + m[4] + m[8];
  if (!(trace > -0.5)) throw new Error('footPose: unsupported normal for this test helper');
  const w = Math.sqrt(1 + trace) / 2;
  return { orientation: [(m[7] - m[5]) / (4 * w), (m[2] - m[6]) / (4 * w), (m[3] - m[1]) / (4 * w), w], arm };
}
