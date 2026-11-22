// 打点と足の移動方向の関係（spec 003 §3）。UI の状態の表し方で、Core のキック入力の定義（05 §6.2）は変えない。
// 接触点 d はワールド座標で持ち、足の移動方向 f を変えても動かさない。打点 (a, b) は、カメラの水平の向きから
// ボールを水平に見たときの、ボールの中心からのずれ（右・上、半径で割った値）。足の移動方向を変えても打点は動かない。
import type { Vec3 } from '@kick-dynamics/physics-core';
import { anglesToDirection, directionToAngles, type DirectionAngles } from '../units/direction';

/**
 * 入力の範囲の上限（暫定、UI の試作用の値で物理的な根拠はない。spec 003 §3）：足の移動方向 f から見たときの
 * 打点の中心からのずれが HIT_LIMIT 以下、つまり f と n = −d のなす角が arcsin HIT_LIMIT ≈ 71.8° 以下。
 */
export const HIT_LIMIT = 0.95;
/** 打点パッドの縁（水平に見たボールの輪郭の少し内側。かすめる点を選ばないため、表示の値）。 */
export const PAD_EDGE = 0.99;

/** 範囲の判定の丸めの余裕（境界上の向きを範囲内とみなすため）。 */
const EPSILON = 1e-9;

/** 打点パッドの座標の組：f = 足の移動方向、r = 右、u = 上（いずれも単位ベクトル）。 */
export interface FootFrame {
  readonly f: Vec3;
  readonly r: Vec3;
  readonly u: Vec3;
}

export interface ElevationRange {
  readonly min: number;
  readonly max: number;
}

const dot = (x: Vec3, y: Vec3): number => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];

/** r = (f × ŷ)/|f × ŷ|、u = r × f。f が鉛直に近いと r が決まらないが、θ の範囲（−45〜60°）では起きない。 */
export function footFrame(angles: DirectionAngles): FootFrame {
  const f = anglesToDirection(angles);
  const length = Math.hypot(f[2], f[0]);
  const r: Vec3 = [-f[2] / length, 0, f[0] / length];
  const u: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { f, r, u };
}

/** 打点 (a, b) = (d·r, d·u)。 */
export function hitOffset(d: Vec3, frame: FootFrame): readonly [number, number] {
  return [dot(d, frame.r), dot(d, frame.u)];
}

/**
 * 打点パッドの座標の組（spec 003 §3）：f = 足の移動方向の水平成分 (cos ψ, 0, sin ψ)、r = 右 (−sin ψ, 0, cos ψ)、u = 上 ŷ。
 * ψ = 0 のとき r = +z（表示上の右）。
 */
export function padFrame(azimuth: number): FootFrame {
  return { f: [Math.cos(azimuth), 0, Math.sin(azimuth)], r: [-Math.sin(azimuth), 0, Math.cos(azimuth)], u: [0, 1, 0] };
}

/** d = a r + b u − √(1 − a² − b²) f（f の側の半球の点）。a² + b² > 1 のときは縁の点にする。 */
export function directionFromHit(a: number, b: number, frame: FootFrame): Vec3 {
  const m = Math.hypot(a, b);
  const [ca, cb] = m > 1 ? [a / m, b / m] : [a, b];
  const w = Math.sqrt(Math.max(0, 1 - ca * ca - cb * cb));
  const { f, r, u } = frame;
  return [ca * r[0] + cb * u[0] - w * f[0], ca * r[1] + cb * u[1] - w * f[1], ca * r[2] + cb * u[2] - w * f[2]];
}

/** 入力の範囲：f から見た打点のずれが HIT_LIMIT 以下。言いかえると d·f ≤ −√(1 − HIT_LIMIT²)。 */
export function withinHitLimit(d: Vec3, f: Vec3): boolean {
  return dot(d, f) <= -Math.sqrt(1 - HIT_LIMIT * HIT_LIMIT) + EPSILON;
}

function wrapAngle(x: number): number {
  if (x > -Math.PI && x <= Math.PI) return x; // 範囲内の値は丸めずにそのまま返す
  const w = ((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return w === -Math.PI ? Math.PI : w;
}

function clampElevation(angles: DirectionAngles, range: ElevationRange): DirectionAngles {
  return { azimuth: wrapAngle(angles.azimuth), elevation: Math.min(range.max, Math.max(range.min, angles.elevation)) };
}

const valid = (angles: DirectionAngles, d: Vec3): boolean => withinHitLimit(d, anglesToDirection(angles));

/**
 * 方向の変更を範囲の端で止める（spec 003 §4）。from から to へ（ψ は短い向きに回る）動かしていき、範囲を出る手前の向きを返す。
 * from が範囲外のとき（ふつうは起きない）は、to を接触点に合わせて寄せる。
 */
export function limitDirection(from: DirectionAngles, to: DirectionAngles, d: Vec3, range: ElevationRange): DirectionAngles {
  const target = clampElevation(to, range);
  if (valid(target, d)) return target;
  if (!valid(from, d)) return directionTowardContact(d, target, range);
  const dPsi = wrapAngle(target.azimuth - from.azimuth);
  const dTheta = target.elevation - from.elevation;
  const at = (t: number): DirectionAngles => ({ azimuth: wrapAngle(from.azimuth + t * dPsi), elevation: from.elevation + t * dTheta });
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (valid(at(mid), d)) lo = mid;
    else hi = mid;
  }
  return at(lo);
}

/**
 * 接触点 d に対して範囲外の方向を、範囲内の最も近い向きへ寄せる（3D クリック、spec 003 §4）。範囲内ならそのまま返す。
 * まず n = −d を軸とする円錐の縁へ射影し、θ の範囲に収める。それでも範囲外なら、n の向きを θ の範囲に収めた向きにする
 * （n と θ を収めた向きのなす角は 45° 以下で、上限の角 arcsin 0.95 ≈ 71.8° より小さいので必ず範囲内）。
 */
export function directionTowardContact(d: Vec3, current: DirectionAngles, range: ElevationRange): DirectionAngles {
  const start = clampElevation(current, range);
  if (valid(start, d)) return start;
  const n: Vec3 = [-d[0], -d[1], -d[2]];
  const f = anglesToDirection(start);
  const along = dot(f, n);
  let t: Vec3 = [f[0] - along * n[0], f[1] - along * n[1], f[2] - along * n[2]];
  let tLength = Math.hypot(t[0], t[1], t[2]);
  if (!(tLength > 1e-9)) {
    // f が n の真逆：n に垂直な水平の向きを使う
    t = [-n[2], 0, n[0]];
    tLength = Math.hypot(t[0], t[2]);
  }
  if (tLength > 1e-9) {
    // 縁より少しだけ内側（丸めで範囲外にならないように）
    const sin = HIT_LIMIT * (1 - 1e-6);
    const cos = Math.sqrt(1 - sin * sin);
    const projected: Vec3 = [0, 1, 2].map((i) => cos * n[i]! + (sin * t[i]!) / tLength) as unknown as Vec3;
    const angles = directionToAngles(projected);
    if (angles) {
      const candidate = clampElevation(angles, range);
      if (valid(candidate, d)) return candidate;
    }
  }
  const nAngles = directionToAngles(n) ?? { azimuth: 0, elevation: 0 };
  return clampElevation(nAngles, range);
}

/**
 * 打点パッドで (a, b) を選べるか：パッドの縁の内側で、今の足の移動方向に対して入力の範囲内。
 * padAzimuth はパッドの視点（カメラ）の水平の向き。パッドに描くのは視点の側の半球なので、その点は常に視点の側にある。
 */
export function selectableHit(a: number, b: number, padAzimuth: number, angles: DirectionAngles): boolean {
  if (Math.hypot(a, b) > PAD_EDGE) return false;
  return withinHitLimit(directionFromHit(a, b, padFrame(padAzimuth)), anglesToDirection(angles));
}

/** 接触点が、パッドの視点の側の半球にあるか（裏側ならパッドには投影した位置を白抜きで示す）。 */
export function onPadSide(d: Vec3, padAzimuth: number): boolean {
  return d[0] * Math.cos(padAzimuth) + d[2] * Math.sin(padAzimuth) < 0;
}

/**
 * 選べない打点を、選べる範囲へ寄せる。from（今の打点）が選べるなら、from から求めた点へ進み、範囲を出る手前で止める。
 * from が使えないとき（接触点が裏側など）は、格子の上で求めた点に最も近い選べる点にする。選べる点がなければ null。
 */
export function clampHitToRange(
  a: number, b: number, padAzimuth: number, angles: DirectionAngles, from: readonly [number, number] | null,
): readonly [number, number] | null {
  if (selectableHit(a, b, padAzimuth, angles)) return [a, b];
  if (from && selectableHit(from[0], from[1], padAzimuth, angles)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (selectableHit(from[0] + mid * (a - from[0]), from[1] + mid * (b - from[1]), padAzimuth, angles)) lo = mid;
      else hi = mid;
    }
    return [from[0] + lo * (a - from[0]), from[1] + lo * (b - from[1])];
  }
  const n = 60;
  let best: readonly [number, number] | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = -1 + (2 * i) / n;
      const y = -1 + (2 * j) / n;
      const distance = Math.hypot(x - a, y - b);
      if (distance < bestDistance && selectableHit(x, y, padAzimuth, angles)) {
        best = [x, y];
        bestDistance = distance;
      }
    }
  }
  return best;
}
