// 再生時刻での軌道の補間（描画層）。再生は描画の時計で進め、物理の時間刻みには影響しない（AGENTS.md ルール 5）。

export interface SampleInterval {
  /** 区間の始点のサンプルの添字 */
  readonly index: number;
  /** 区間内の位置 0 ≤ α ≤ 1（index と index + 1 の間） */
  readonly alpha: number;
}

/**
 * 時刻 t を含むサンプルの区間を二分探索で求める。t が範囲外なら端に寄せる。
 * 同じ時刻のサンプルが続く場合（接地の処理の前後）は、後のサンプルを使う。
 */
export function intervalAt(times: ArrayLike<number>, t: number): SampleInterval {
  const n = times.length;
  if (n === 1 || t <= times[0]!) return { index: 0, alpha: 0 };
  if (t >= times[n - 1]!) return { index: n - 1, alpha: 0 };
  let lo = 0;
  let hi = n - 1;
  // 不変条件：times[lo] ≤ t < times[hi]
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) lo = mid;
    else hi = mid;
  }
  return { index: lo, alpha: (t - times[lo]!) / (times[hi]! - times[lo]!) };
}
