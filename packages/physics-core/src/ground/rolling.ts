// 地面上の転がりと停止（docs/05-physics-model.md §8.2）。
//
// 拘束 y = R、v_y = 0 のもとで、接地の力だけを扱う（空力は転がりの間は無視する。決定、2026-10-19）。
// - 滑りを伴う転がり：接触点の速度 u = v + ω × (−R ŷ) ≠ 0 の間、大きさ μ_g m g の動摩擦力が u と逆向きに働く。
//   このとき du/dt = −μ_g g (1 + 1/κ) û で u の向きは変わらないため、u = 0 になる時刻まで閉形式で進められる。
// - 純転がり：u = 0 を保ち、重心に働く転がり抵抗 μ_r m g（水平速度と逆向き）で、並進と回転が減速度 μ_r g/(1+κ) で
//   同時に減速する。速度の向きは変わらないため、静止するまで閉形式で進められる。静止した後は水平の速度と回転が 0。
// - 鉛直軸まわりの回転 ω_y は変えない（接地の力のトルクは水平）。
// - 姿勢は、閉形式の ω(t) を使って区間ごとに RK4 で積分し、正規化する（姿勢は力学に影響しない）。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { GROUND_HEIGHT } from '../frames';
import { derivative, normalize as normalizeQuat, type Quat } from '../math/quat';
import { add, addScaled, length, scale, type Vec3 } from '../math/vec3';

/** 転がりと停止の係数・閾値（05 §8.2、P-16・P-17・P-19）。値は未決定で、Core は既定値を持たない。 */
export interface RollingParameters {
  /** g m/s² */
  readonly gravity: number;
  /** μ_g（P-16）：地面の動摩擦係数 */
  readonly friction: number;
  /** μ_r（P-17）：転がり抵抗係数 */
  readonly rollingResistance: number;
  /** v_stop m/s（P-19）：停止判定の速度の閾値 */
  readonly stopSpeed: number;
  /** ω_stop rad/s（P-19）：停止判定の角速度の閾値 */
  readonly stopSpin: number;
}

/** 接触点（−R ŷ）の速度 u = v + ω × (−R ŷ) = (v_x + R ω_z, 0, v_z − R ω_x)。 */
export function rollingContactVelocity(state: RigidBodyState, radius: number): Vec3 {
  const [vx, , vz] = state.linearVelocity;
  const [wx, , wz] = state.angularVelocity;
  return [vx + radius * wz, 0, vz - radius * wx];
}

/** 停止の判定（05 §8.2）：|v| < v_stop かつ |ω| < ω_stop。 */
export function isStopped(state: RigidBodyState, params: RollingParameters): boolean {
  return length(state.linearVelocity) < params.stopSpeed && length(state.angularVelocity) < params.stopSpin;
}

/** 区間内で一定の並進加速度 a と角加速度 α で進める。姿勢は ω(t) = ω0 + α t を使った RK4 の 1 ステップ。 */
function advanceUniform(state: RigidBodyState, acceleration: Vec3, angularAcceleration: Vec3, duration: number): RigidBodyState {
  const v0 = state.linearVelocity;
  const w0 = state.angularVelocity;
  const omegaAt = (t: number): Vec3 => addScaled(w0, angularAcceleration, t);
  const q0 = state.orientation;
  const h = duration;
  const step = (q: Quat, d: Quat, s: number): Quat => [q[0] + s * d[0], q[1] + s * d[1], q[2] + s * d[2], q[3] + s * d[3]];
  const k1 = derivative(q0, omegaAt(0));
  const k2 = derivative(step(q0, k1, h / 2), omegaAt(h / 2));
  const k3 = derivative(step(q0, k2, h / 2), omegaAt(h / 2));
  const k4 = derivative(step(q0, k3, h), omegaAt(h));
  const combine = (i: 0 | 1 | 2 | 3): number => q0[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  const q: Quat = [combine(0), combine(1), combine(2), combine(3)];
  return {
    position: add(addScaled(state.position, v0, h), scale(acceleration, 0.5 * h * h)),
    orientation: normalizeQuat(q),
    linearVelocity: addScaled(v0, acceleration, h),
    angularVelocity: omegaAt(h),
  };
}

/** 純転がりの拘束（u = 0）に合わせて水平の角速度を v から決める：ω_x = v_z / R、ω_z = −v_x / R（ω_y はそのまま）。 */
function enforceRolling(state: RigidBodyState, radius: number): RigidBodyState {
  const [vx, , vz] = state.linearVelocity;
  return { ...state, angularVelocity: [vz / radius, state.angularVelocity[1], -vx / radius] };
}

/** 拘束 y = R、v_y = 0 を課す（y の射影と v_y の除去）。 */
export function constrainToGround(state: RigidBodyState, radius: number): RigidBodyState {
  const [x, , z] = state.position;
  const [vx, , vz] = state.linearVelocity;
  return { ...state, position: [x, GROUND_HEIGHT + radius, z], linearVelocity: [vx, 0, vz] };
}

/**
 * 地面上のボールを duration だけ進める（05 §8.2）。state は拘束 y = R、v_y = 0 を満たすものとする。
 * 滑り → 純転がり → 静止の各区間を閉形式で進め、区間の切り替わりの時刻は区間内で正確に求める。
 */
export function advanceRolling(state: RigidBodyState, ball: BallParams, params: RollingParameters, duration: number): RigidBodyState {
  if (!(duration > 0)) return state;
  const radius = ball.radius;
  const kappa = ball.inertiaCoefficient;
  const g = params.gravity;
  let current = state;
  let remaining = duration;

  // 1. 滑りを伴う転がり：u の大きさは μ_g g (1 + 1/κ) で一定の割合で減る。
  const u = rollingContactVelocity(current, radius);
  const slip = length(u);
  if (slip > 0 && remaining > 0) {
    const slipDecay = params.friction * g * (1 + 1 / kappa);
    const slideTime = slipDecay > 0 ? slip / slipDecay : Infinity;
    const tau = Math.min(remaining, slideTime);
    const uHat = scale(u, 1 / slip);
    const acceleration = scale(uHat, -params.friction * g);
    // α = μ_g g (ŷ × û) / (κ R)、ŷ × û = (û_z, 0, −û_x)
    const angularAcceleration: Vec3 = scale([uHat[2], 0, -uHat[0]], (params.friction * g) / (kappa * radius));
    current = advanceUniform(current, acceleration, angularAcceleration, tau);
    remaining -= tau;
    if (tau < slideTime) return current;
    current = enforceRolling(current, radius);
  } else {
    current = enforceRolling(current, radius);
  }
  if (!(remaining > 0)) return current;

  // 2. 純転がり：減速度 μ_r g / (1 + κ)、向きは水平速度と逆。
  const v = current.linearVelocity;
  const speed = length(v);
  if (speed > 0) {
    const deceleration = (params.rollingResistance * g) / (1 + kappa);
    const rollTime = deceleration > 0 ? speed / deceleration : Infinity;
    const tau = Math.min(remaining, rollTime);
    const vHat = scale(v, 1 / speed);
    const acceleration = scale(vHat, -deceleration);
    // 純転がりの拘束から α_x = a_z / R、α_z = −a_x / R
    const angularAcceleration: Vec3 = [acceleration[2] / radius, 0, -acceleration[0] / radius];
    current = advanceUniform(current, acceleration, angularAcceleration, tau);
    remaining -= tau;
    if (tau < rollTime) return enforceRolling(current, radius);
    // 静止：水平の速度と回転を厳密に 0 にする（ω_y は残る）。
    current = { ...current, linearVelocity: [0, 0, 0], angularVelocity: [0, current.angularVelocity[1], 0] };
  }
  if (!(remaining > 0)) return current;

  // 3. 静止（ω_y だけが残りうる）：位置は変わらず、姿勢だけ ω_y ŷ で回る。
  return advanceUniform(current, [0, 0, 0], [0, 0, 0], remaining);
}
