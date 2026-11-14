// 地面上の転がりと停止（docs/05-physics-model.md §8.2、2026-11-14 に改定）。
//
// 拘束 y = R、v_y = 0 のもとで、水平方向に次の力を扱う（マグヌス力・回転減衰は転がりの間は無視する）。
// - 接触点の摩擦：滑りの間は大きさ μ_g m g の動摩擦（接触点の速度 u = v + ω × (−R ŷ) と逆向き）、純転がりの間は拘束を保つ静止摩擦。
// - 重心に働く外力 F_e：転がり抵抗 μ_r m g（水平速度と逆向き）と空気抗力（§7.3。抗力 ON のとき）。|v| ≤ ε_v では 0。
// 状態（静止・純転がり・滑り）の切り替えはステップごとに判定し、時刻は求めない（切り替えのステップは 1 次精度）。
// 切り替えのないステップは RK4 で進める。
// - 鉛直軸まわりの回転 ω_y は変えない（摩擦のトルクは水平で、外力は重心に働く）。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { evaluateCoefficient, type AeroContext } from '../flight/forces';
import type { CoefficientModel } from '../flight/types';
import { GROUND_HEIGHT } from '../frames';
import { derivative, normalize as normalizeQuat, type Quat } from '../math/quat';
import { add, addScaled, length, scale, sub, type Vec3 } from '../math/vec3';
import { ok, type SimResult } from '../result';

/** 転がりの間の空気抗力（05 §8.2、§7.3）。Phase 1 は無風（P-20）なので、相対速度は v。 */
export interface RollingDrag {
  readonly coefficient: CoefficientModel;
  /** ρ kg/m³ */
  readonly airDensity: number;
  /** η Pa·s（係数を関数で与える場合の Re の計算にだけ使う） */
  readonly airViscosity: number;
}

/** 転がりと停止の係数・閾値（05 §8.2、P-16・P-17・P-19・P-23）。値は未決定で、Core は既定値を持たない。 */
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
  /** ε_v m/s（P-23）：これ以下の速さでは転がり抵抗と抗力を 0 とし、純転がりなら静止とする */
  readonly zeroSpeed: number;
  /** 抗力 OFF なら null */
  readonly drag: RollingDrag | null;
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

/** ŷ × a = (a_z, 0, −a_x)（水平の a に対して）。 */
function upCross(a: Vec3): Vec3 {
  return [a[2], 0, -a[0]];
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
 * 純転がりとみなす接触点の速さの上限（|v| + R|ω_h| に対する比）。拘束を課した後の u は丸め誤差の分だけ 0 からずれるため、
 * そのずれ（機械イプシロンの数倍）を吸収する数値上の判定で、物理的な意味はない。
 */
const ROLLING_RELATIVE_SLIP = 64 * Number.EPSILON;

type Mode = 'rest' | 'rolling' | 'sliding';

function modeOf(state: RigidBodyState, radius: number): Mode {
  const [vx, , vz] = state.linearVelocity;
  const [wx, , wz] = state.angularVelocity;
  if (vx === 0 && vz === 0 && wx === 0 && wz === 0) return 'rest';
  const scaleOfSpeeds = Math.hypot(vx, vz) + radius * Math.hypot(wx, wz);
  return length(rollingContactVelocity(state, radius)) <= ROLLING_RELATIVE_SLIP * scaleOfSpeeds ? 'rolling' : 'sliding';
}

/** 重心に働く外力（転がり抵抗と抗力）を質量で割った加速度 F_e / m（05 §8.2）。|v| ≤ ε_v では 0 で、係数を評価しない。 */
function externalAcceleration(state: RigidBodyState, ball: BallParams, params: RollingParameters): SimResult<Vec3> {
  const v = state.linearVelocity;
  const speed = length(v);
  if (speed <= params.zeroSpeed) return ok([0, 0, 0]);
  let acceleration = scale(v, -(params.rollingResistance * params.gravity) / speed);
  const drag = params.drag;
  if (drag !== null) {
    const context: AeroContext = {
      relativeVelocity: v,
      speed,
      reynolds: (drag.airDensity * speed * 2 * ball.radius) / drag.airViscosity,
      spinParameter: (ball.radius * length(state.angularVelocity)) / speed,
    };
    const cd = evaluateCoefficient(drag.coefficient, context, 'C_D', true);
    if (!cd.ok) return cd;
    const area = Math.PI * ball.radius * ball.radius;
    acceleration = addScaled(acceleration, v, (-0.5 * drag.airDensity * area * cd.value * speed) / ball.mass);
  }
  return ok(acceleration);
}

/** 維持条件（05 §8.2）：純転がりに必要な静止摩擦 κ |F_e| / (1 + κ) が μ_g m g 以下（質量あたりで比べる）。 */
function sustainsRolling(external: Vec3, ball: BallParams, params: RollingParameters): boolean {
  const kappa = ball.inertiaCoefficient;
  return (kappa * length(external)) / (1 + kappa) <= params.friction * params.gravity;
}

interface Derivative {
  readonly velocity: Vec3;
  readonly acceleration: Vec3;
  readonly angularAcceleration: Vec3;
}

/** 純転がりの運動方程式：dv/dt = (F_e/m)/(1 + κ)、水平の角加速度は拘束から（α_x = a_z/R、α_z = −a_x/R）。 */
function rollingDerivative(state: RigidBodyState, ball: BallParams, params: RollingParameters): SimResult<Derivative> {
  const external = externalAcceleration(state, ball, params);
  if (!external.ok) return external;
  const a = scale(external.value, 1 / (1 + ball.inertiaCoefficient));
  return ok({ velocity: state.linearVelocity, acceleration: a, angularAcceleration: [a[2] / ball.radius, 0, -a[0] / ball.radius] });
}

/**
 * 滑りの運動方程式：dv/dt = F_e/m − μ_g g û、dω_h/dt = μ_g g (ŷ × û)/(κ R)。
 * u = 0 の段（純転がりから滑りへ入る最初のステップなど）では、û の代わりに fallback（試行の滑りの向き）を使う。
 */
function slidingDerivative(state: RigidBodyState, ball: BallParams, params: RollingParameters, fallback: Vec3): SimResult<Derivative> {
  const external = externalAcceleration(state, ball, params);
  if (!external.ok) return external;
  const u = rollingContactVelocity(state, ball.radius);
  const slip = length(u);
  const uHat = slip > 0 ? scale(u, 1 / slip) : fallback;
  const friction = params.friction * params.gravity;
  return ok({
    velocity: state.linearVelocity,
    acceleration: addScaled(external.value, uHat, -friction),
    angularAcceleration: scale(upCross(uHat), friction / (ball.inertiaCoefficient * ball.radius)),
  });
}

/** 位置・速度・角速度・姿勢を同じ RK4 で 1 ステップ進める（各段の ω はその段の値。05 §8.2 の姿勢の積分）。 */
function rk4(
  state: RigidBodyState, h: number, f: (s: RigidBodyState) => SimResult<Derivative>,
): SimResult<RigidBodyState> {
  const stage = (s: RigidBodyState, d: Derivative, dq: Quat, c: number): RigidBodyState => ({
    position: addScaled(s.position, d.velocity, c),
    linearVelocity: addScaled(s.linearVelocity, d.acceleration, c),
    angularVelocity: addScaled(s.angularVelocity, d.angularAcceleration, c),
    orientation: [s.orientation[0] + c * dq[0], s.orientation[1] + c * dq[1], s.orientation[2] + c * dq[2], s.orientation[3] + c * dq[3]],
  });
  const d1 = f(state);
  if (!d1.ok) return d1;
  const q1 = derivative(state.orientation, state.angularVelocity);
  const s2 = stage(state, d1.value, q1, h / 2);
  const d2 = f(s2);
  if (!d2.ok) return d2;
  const q2 = derivative(s2.orientation, s2.angularVelocity);
  const s3 = stage(state, d2.value, q2, h / 2);
  const d3 = f(s3);
  if (!d3.ok) return d3;
  const q3 = derivative(s3.orientation, s3.angularVelocity);
  const s4 = stage(state, d3.value, q3, h);
  const d4 = f(s4);
  if (!d4.ok) return d4;
  const q4 = derivative(s4.orientation, s4.angularVelocity);
  const weighted = (a: number, b: number, c: number, d: number): number => (h / 6) * (a + 2 * b + 2 * c + d);
  const mix = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): Vec3 =>
    [weighted(a[0], b[0], c[0], d[0]), weighted(a[1], b[1], c[1], d[1]), weighted(a[2], b[2], c[2], d[2])];
  const q0 = state.orientation;
  const q: Quat = [
    q0[0] + weighted(q1[0], q2[0], q3[0], q4[0]), q0[1] + weighted(q1[1], q2[1], q3[1], q4[1]),
    q0[2] + weighted(q1[2], q2[2], q3[2], q4[2]), q0[3] + weighted(q1[3], q2[3], q3[3], q4[3]),
  ];
  return ok({
    position: add(state.position, mix(d1.value.velocity, d2.value.velocity, d3.value.velocity, d4.value.velocity)),
    linearVelocity: add(state.linearVelocity, mix(d1.value.acceleration, d2.value.acceleration, d3.value.acceleration, d4.value.acceleration)),
    angularVelocity: add(state.angularVelocity, mix(d1.value.angularAcceleration, d2.value.angularAcceleration, d3.value.angularAcceleration, d4.value.angularAcceleration)),
    orientation: normalizeQuat(q),
  });
}

/**
 * 1 次精度のステップ（静止・移行）：速度と角速度を終わりの値へ時間の 1 次式で変え、位置は台形、
 * 姿勢は補間した ω で RK4（05 §8.2）。
 */
function linearStep(state: RigidBodyState, velocity: Vec3, angularVelocity: Vec3, h: number): RigidBodyState {
  const moved = advanceUniform(state, scale(sub(velocity, state.linearVelocity), 1 / h), scale(sub(angularVelocity, state.angularVelocity), 1 / h), h);
  return { ...moved, linearVelocity: velocity, angularVelocity };
}

/**
 * 地面上のボールを duration だけ進める（05 §8.2 の「積分」の手順 1〜3）。state は拘束 y = R、v_y = 0 を満たすものとする。
 * 状態（静止・純転がり・滑り）は state から判定する（静止は水平の速度と回転が厳密に 0、純転がりは u が丸め誤差の範囲で 0）。
 */
export function advanceRolling(state: RigidBodyState, ball: BallParams, params: RollingParameters, duration: number): SimResult<RigidBodyState> {
  if (!(duration > 0)) return ok(state);
  const h = duration;
  const radius = ball.radius;
  const mode = modeOf(state, radius);

  // 1. 静止：位置と水平の状態は変えず、姿勢だけ ω_y ŷ で回す。
  if (mode === 'rest') return ok(advanceUniform(state, [0, 0, 0], [0, 0, 0], h));

  const external = externalAcceleration(state, ball, params);
  if (!external.ok) return external;

  // 2. 純転がりで、t_k の状態で維持条件が成り立つ場合。
  if (mode === 'rolling' && sustainsRolling(external.value, ball, params)) {
    const speed = length(state.linearVelocity);
    const deceleration = length(external.value) / (1 + ball.inertiaCoefficient);
    if (speed <= params.zeroSpeed || speed <= deceleration * h) {
      // 静止の判定（数値上の規則）：このステップの間に速さが 0 になるとみなす。ω_y は残す。
      return ok(linearStep(state, [0, 0, 0], [0, state.angularVelocity[1], 0], h));
    }
    const stepped = rk4(state, h, (s) => rollingDerivative(s, ball, params));
    if (!stepped.ok) return stepped;
    return ok(enforceRolling(stepped.value, radius));
  }

  // 3. 滑り（または維持条件が成り立たない純転がり）。
  const kappa = ball.inertiaCoefficient;
  const trialSlip = addScaled(rollingContactVelocity(state, radius), external.value, h); // u* = u + (F_e/m) Δt
  const impulse = scale(trialSlip, -1 / (1 + 1 / kappa)); // P/m
  if (length(impulse) <= params.friction * params.gravity * h) {
    // 移行の候補：滑りを 0 にした状態で維持条件を確かめ、成り立てば純転がりへ移る。
    const velocity = add(addScaled(state.linearVelocity, external.value, h), impulse);
    const [vx, , vz] = velocity;
    const candidate = linearStep(state, velocity, [vz / radius, state.angularVelocity[1], -vx / radius], h);
    const candidateExternal = externalAcceleration(candidate, ball, params);
    if (!candidateExternal.ok) return candidateExternal;
    if (sustainsRolling(candidateExternal.value, ball, params)) return ok(candidate);
  }
  // 候補は捨て、t_k の状態から滑りを RK4 で進める。u = 0 の段では試行の滑りの向きを使う。
  const trialLength = length(trialSlip);
  const fallback = trialLength > 0 ? scale(trialSlip, 1 / trialLength) : scale(state.linearVelocity, -1 / Math.max(length(state.linearVelocity), Number.MIN_VALUE));
  return rk4(state, h, (s) => slidingDerivative(s, ball, params, fallback));
}
