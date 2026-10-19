// パラメータの表示（AC-13、FR-19、NFR-13）：値・単位・確からしさ・出典を表示用の文字列にする。
import type { Confidence, ParameterEntry } from '@kick-dynamics/physics-core';

/** 確からしさの区分の表示名（05 §10.1）。 */
export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  defined: '定義値',
  standard: '規格値',
  literature: '文献値',
  measured: '実測同定',
  provisional: '仮置き',
  assumption: '仮定',
  undetermined: '未決定',
};

/** 注意を促す表示にする区分：値に根拠がないか弱いもの（仮置き）と、値がないもの（未決定）。 */
export function needsAttention(confidence: Confidence): boolean {
  return confidence === 'provisional' || confidence === 'undetermined';
}

function formatScalar(x: number): string {
  if (x === 0) return '0';
  const abs = Math.abs(x);
  return abs < 1e-3 || abs >= 1e5 ? x.toExponential(2) : String(Number(x.toPrecision(6)));
}

export function formatParameterValue(entry: ParameterEntry<unknown>): string {
  const { value, candidateRange } = entry;
  if (value === null) {
    return candidateRange ? `候補範囲 ${formatScalar(candidateRange.min)}–${formatScalar(candidateRange.max)}` : '—（未決定）';
  }
  if (typeof value === 'number') return formatScalar(value);
  if (Array.isArray(value)) {
    const offDiagonalZero = value.length === 9 && [1, 2, 3, 5, 6, 7].every((i) => value[i] === 0);
    if (offDiagonalZero) return `diag(${[value[0], value[4], value[8]].map((x) => formatScalar(x as number)).join(', ')})`;
    return `(${value.map((x) => formatScalar(x as number)).join(', ')})`;
  }
  return JSON.stringify(value);
}
