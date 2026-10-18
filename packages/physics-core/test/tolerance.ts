// テスト用の許容誤差（docs/06-validation.md §3）。
//
// TOL-A（仮置き、M1.1）：丸め誤差のみが生じる比較。倍精度の機械イプシロン（約 2.2e-16）に、
// 演算の規模（数十〜数百回）と余裕を掛けて 1e-12 とした。物理量の典型的な大きさ（1 程度）を
// 想定した値であり、根拠のある確定値ではない。
import { expect } from 'vitest';

export const TOL_A = { relative: 1e-12, absolute: 1e-12 } as const;

/** |a − b| ≤ absolute + relative |b| の判定幅（06 §3）。 */
export interface Tolerance {
  readonly relative: number;
  readonly absolute: number;
}

export function expectClose(actual: number, expected: number, tol: Tolerance = TOL_A): void {
  const bound = tol.absolute + tol.relative * Math.abs(expected);
  const error = Math.abs(actual - expected);
  if (!(error <= bound)) {
    expect.fail(`expected ${actual} to be within ${bound} of ${expected} (error ${error})`);
  }
}

export function expectAllClose(actual: readonly number[], expected: readonly number[], tol: Tolerance = TOL_A): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expectClose(actual[i]!, expected[i]!, tol);
  }
}
