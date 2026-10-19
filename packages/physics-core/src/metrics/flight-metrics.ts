// 測定値の計算（docs/05-physics-model.md §9）。
// 足との衝突の結果（M1.3）はまだないため、軌道の最初のサンプルを衝突直後のボールの状態として扱う
// （VER-S02：solveImpact の ballAfter と飛翔の初期状態は一致する）。
import { WORLD_UP } from '../frames';
import { cross, dot, length, scale, type Vec3 } from '../math/vec3';
import { stateAt, type Trajectory } from '../flight/trajectory';

export interface SpinComponents {
  /** ω·e1（進行方向軸まわり） rad/s */
  readonly gyro: number;
  /** ω·e2（正がバックスピン） rad/s */
  readonly back: number;
  /** ω·e3（正のとき、マグヌス力は進行方向に対して左向き） rad/s */
  readonly side: number;
}

export interface FlightMetrics {
  /** 初速 |v⁺| m/s */
  readonly launchSpeed: number;
  /** 打ち出し角（垂直）θ rad */
  readonly launchAngle: number;
  /** 打ち出し方向（水平）ψ rad（右が正） */
  readonly launchDirection: number;
  /** スピン量 |ω⁺| rad/s */
  readonly spinRate: number;
  /** スピン成分。打ち出しの速度が鉛直に近い（または 0 の）場合は定義不能で null */
  readonly spinComponents: SpinComponents | null;
  /** 最高到達点：最初の接地までのボール中心の高さ y の最大値 m（接地がなければ軌道の終わりまで） */
  readonly maxHeight: number;
  /** 飛行時間 s（接地がなければ null） */
  readonly flightTime: number | null;
  /** 着地点：最初の接地時のボール中心の (x, z) m */
  readonly landingPoint: readonly [number, number] | null;
  /** キャリー：初期のボール中心と最初の接地時のボール中心との水平距離 m */
  readonly carry: number | null;
  /** 横ずれ：着地点の z m */
  readonly lateralDeviation: number | null;
  /** 総距離：初期のボール中心と停止位置のボール中心との水平距離 m（05 §9）。停止イベントがなければ（max-time で終了した場合を含む）null */
  readonly totalDistance: number | null;
}

export interface MetricsSettings {
  /**
   * スピン成分を定義不能とする閾値：|v̂ × ŷ| がこの値以下なら鉛直に近いとみなす（05 §10.2 P-27、仮置き）。
   */
  readonly verticalLaunchThreshold: number;
}

/** e1 = v̂、e2 = (v̂ × ŷ)/|v̂ × ŷ|、e3 = e2 × e1 への射影（05 §9）。 */
export function spinComponents(velocity: Vec3, angularVelocity: Vec3, verticalLaunchThreshold: number): SpinComponents | null {
  const speed = length(velocity);
  if (!(speed > 0)) return null;
  const e1 = scale(velocity, 1 / speed);
  const side = cross(e1, WORLD_UP);
  const sideLength = length(side);
  if (sideLength <= verticalLaunchThreshold) return null;
  const e2 = scale(side, 1 / sideLength);
  const e3 = cross(e2, e1);
  return { gyro: dot(angularVelocity, e1), back: dot(angularVelocity, e2), side: dot(angularVelocity, e3) };
}

/**
 * 区間 [t0, t1] の 3 次エルミート補間（位置 y と速度 v_y）の極大値。v0 > 0 ≥ v1 のときに呼ぶ。
 * 補間の誤差は O(Δt⁴) で、真空中の放物運動（2 次多項式）では厳密になる。
 */
function hermiteApex(t0: number, y0: number, v0: number, t1: number, y1: number, v1: number): number {
  const h = t1 - t0;
  // dy/dt × h を s ∈ [0, 1] の 2 次式として評価する。
  const slope = (s: number) => (6 * s * s - 6 * s) * (y0 - y1) + (3 * s * s - 4 * s + 1) * h * v0 + (3 * s * s - 2 * s) * h * v1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (slope(mid) > 0) lo = mid;
    else hi = mid;
  }
  const s = 0.5 * (lo + hi);
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * v0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * v1;
}

export function computeFlightMetrics(trajectory: Trajectory, settings: MetricsSettings): FlightMetrics {
  const launch = stateAt(trajectory, 0);
  const v = launch.linearVelocity;
  const horizontalSpeed = Math.hypot(v[0], v[2]);

  // 最初の接地：開始時刻の地面上の処理（start-on-ground、05 §7.7 の「初期状態」）は含めない（決定、2026-10-18）。
  const landing = trajectory.events.find((e) => e.type === 'ground-contact');
  const lastIndex = landing ? landing.sampleIndex : trajectory.time.length - 1;
  const stop = trajectory.events.find((e) => e.type === 'stop');

  const t = trajectory.time;
  const p = trajectory.position;
  const u = trajectory.linearVelocity;
  let maxHeight = p[1]!;
  for (let i = 1; i <= lastIndex; i++) {
    const y = p[3 * i + 1]!;
    if (y > maxHeight) maxHeight = y;
    const vPrev = u[3 * (i - 1) + 1]!;
    const vNext = u[3 * i + 1]!;
    if (t[i]! > t[i - 1]! && vPrev > 0 && vNext <= 0) {
      maxHeight = Math.max(maxHeight, hermiteApex(t[i - 1]!, p[3 * (i - 1) + 1]!, vPrev, t[i]!, y, vNext));
    }
  }

  const base = {
    launchSpeed: length(v),
    launchAngle: Math.atan2(v[1], horizontalSpeed),
    launchDirection: Math.atan2(v[2], v[0]),
    spinRate: length(launch.angularVelocity),
    spinComponents: spinComponents(v, launch.angularVelocity, settings.verticalLaunchThreshold),
    maxHeight,
    totalDistance: stop ? horizontalDistance(stateAt(trajectory, stop.sampleIndex).position, launch.position) : null,
  };
  if (!landing) {
    return { ...base, flightTime: null, landingPoint: null, carry: null, lateralDeviation: null };
  }
  const at = stateAt(trajectory, landing.sampleIndex).position;
  const x = at[0];
  const z = at[2];
  return {
    ...base,
    flightTime: landing.time - t[0]!,
    landingPoint: [x, z],
    carry: horizontalDistance(at, launch.position),
    lateralDeviation: z,
  };
}

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
