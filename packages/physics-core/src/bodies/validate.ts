// 物性値の検証（docs/04-architecture.md §6：範囲外のパラメータは例外ではなく SimResult のエラー）。
import { determinant, get, inverse, type Mat3 } from '../math/mat3';
import { isFiniteVec3 } from '../math/vec3';
import { fail, ok, type SimResult } from '../result';
import type { BallParams, FootParams } from './types';

function positive(name: string, value: number): SimResult<void> {
  return Number.isFinite(value) && value > 0 ? ok(undefined) : fail('invalid-parameter', `${name} must be finite and positive (${value})`);
}

/** 正の有限値で、その逆数も有限（逆数を使う計算で桁あふれしない）。 */
function invertible(value: number): boolean {
  return Number.isFinite(value) && value > 0 && Number.isFinite(1 / value);
}

/** m_B > 0、R > 0、κ > 0（いずれも有限）で、質量と慣性モーメント κ m R² が有限な逆数を持つ。 */
export function validateBall(ball: BallParams): SimResult<void> {
  for (const [name, value] of [['ball mass', ball.mass], ['ball radius', ball.radius], ['ball inertia coefficient κ', ball.inertiaCoefficient]] as const) {
    const r = positive(name, value);
    if (!r.ok) return r;
  }
  const moment = ball.inertiaCoefficient * ball.mass * ball.radius * ball.radius;
  if (!invertible(ball.mass) || !invertible(moment)) {
    return fail('invalid-parameter', `ball mass and moment of inertia κ m R² must have finite inverses (${ball.mass}, ${moment})`);
  }
  return ok(undefined);
}

/**
 * 3×3 行列が有限・対称・正定値で、逆行列が有限に求まるか（対称行列の Sylvester の判定法：主小行列式がすべて正）。
 */
export function isSymmetricPositiveDefinite(m: Mat3): boolean {
  if (!m.every(Number.isFinite)) return false;
  const scale = Math.max(...m.map(Math.abs));
  const symmetric = [[0, 1], [0, 2], [1, 2]].every(([i, j]) => Math.abs(get(m, i!, j!) - get(m, j!, i!)) <= 1e-12 * scale);
  const minor1 = get(m, 0, 0);
  const minor2 = get(m, 0, 0) * get(m, 1, 1) - get(m, 0, 1) * get(m, 1, 0);
  const det = determinant(m);
  if (!(symmetric && minor1 > 0 && minor2 > 0 && det > 0 && Number.isFinite(det))) return false;
  // 行列式が有限でも、逆行列の要素が桁あふれする場合は計算に使えない。
  return inverse(m).every(Number.isFinite);
}

/** m_A > 0（有限）、物体座標の慣性テンソルが対称正定値、直方体の寸法が正（いずれも有限）。 */
export function validateFoot(foot: FootParams): SimResult<void> {
  const mass = positive('foot mass', foot.mass);
  if (!mass.ok) return mass;
  if (!invertible(foot.mass)) return fail('invalid-parameter', `foot mass must have a finite inverse (${foot.mass})`);
  if (!isSymmetricPositiveDefinite(foot.inertiaBody)) {
    return fail('invalid-parameter', 'foot inertia tensor must be finite, symmetric and positive definite');
  }
  const dims = foot.shape.dimensions;
  if (!isFiniteVec3(dims) || !dims.every((d) => d > 0)) {
    return fail('invalid-parameter', `foot dimensions must be finite and positive (${dims.join(', ')})`);
  }
  return ok(undefined);
}
