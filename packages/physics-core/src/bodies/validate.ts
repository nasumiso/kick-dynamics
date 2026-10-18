// 物性値の検証（docs/04-architecture.md §6：範囲外のパラメータは例外ではなく SimResult のエラー）。
import { determinant, get, type Mat3 } from '../math/mat3';
import { isFiniteVec3 } from '../math/vec3';
import { fail, ok, type SimResult } from '../result';
import type { BallParams, FootParams } from './types';

function positive(name: string, value: number): SimResult<void> {
  return Number.isFinite(value) && value > 0 ? ok(undefined) : fail('invalid-parameter', `${name} must be finite and positive (${value})`);
}

/** m_B > 0、R > 0、κ > 0（いずれも有限）。慣性テンソル κ m R² E が正定値になる条件。 */
export function validateBall(ball: BallParams): SimResult<void> {
  for (const [name, value] of [['ball mass', ball.mass], ['ball radius', ball.radius], ['ball inertia coefficient κ', ball.inertiaCoefficient]] as const) {
    const r = positive(name, value);
    if (!r.ok) return r;
  }
  return ok(undefined);
}

/** 3×3 行列が有限・対称・正定値か（対称行列の Sylvester の判定法：主小行列式がすべて正）。 */
export function isSymmetricPositiveDefinite(m: Mat3): boolean {
  if (!m.every(Number.isFinite)) return false;
  const scale = Math.max(...m.map(Math.abs));
  const symmetric = [[0, 1], [0, 2], [1, 2]].every(([i, j]) => Math.abs(get(m, i!, j!) - get(m, j!, i!)) <= 1e-12 * scale);
  const minor1 = get(m, 0, 0);
  const minor2 = get(m, 0, 0) * get(m, 1, 1) - get(m, 0, 1) * get(m, 1, 0);
  return symmetric && minor1 > 0 && minor2 > 0 && determinant(m) > 0;
}

/** m_A > 0（有限）、物体座標の慣性テンソルが対称正定値、直方体の寸法が正（いずれも有限）。 */
export function validateFoot(foot: FootParams): SimResult<void> {
  const mass = positive('foot mass', foot.mass);
  if (!mass.ok) return mass;
  if (!isSymmetricPositiveDefinite(foot.inertiaBody)) {
    return fail('invalid-parameter', 'foot inertia tensor must be finite, symmetric and positive definite');
  }
  const dims = foot.shape.dimensions;
  if (!isFiniteVec3(dims) || !dims.every((d) => d > 0)) {
    return fail('invalid-parameter', `foot dimensions must be finite and positive (${dims.join(', ')})`);
  }
  return ok(undefined);
}
