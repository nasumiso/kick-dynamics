// パラメータパネル（AC-13）：各物理パラメータの値・単位・確からしさ・出典を表示し、「仮置き」「未決定」を目立たせる。
// 検証状態（06 §2）は、実測との照合（VAL）を実施していないため、すべて「未検証」。
import type { ParameterEntry, ParameterSet } from '@kick-dynamics/physics-core';
import { CONFIDENCE_LABELS, formatParameterValue, needsAttention } from '../params/parameter-display';
import { PARAMETER_MEANINGS } from '../params/default-parameter-set';
import { element, section } from './dom';

/** (Re, S) の表の全体（05 §10.4）。行は Re（換算した速さを併記）、列は S。 */
function tableDetails(entry: ParameterEntry<unknown>): HTMLElement[] {
  const value = entry.value as { kind?: unknown; reynolds?: readonly number[]; spin?: readonly number[]; values?: readonly (readonly number[])[] } | null;
  if (!value || value.kind !== 'reynolds-spin-table' || !value.reynolds || !value.spin || !value.values) return [];
  const head = element('tr', {}, element('th', {}, 'Re＼S'), ...value.spin.map((s) => element('th', {}, String(s))));
  const rows = value.reynolds.map((re, j) => element('tr', {},
    element('th', {}, re.toExponential(2)), ...value.values![j]!.map((c) => element('td', {}, c.toFixed(3)))));
  return [element('details', { class: 'coefficient-table' }, element('summary', {}, '表の全体'),
    element('table', {}, element('thead', {}, head), element('tbody', {}, ...rows)))];
}

export function createParameterPanel(parameters: ParameterSet): HTMLElement {
  const entries = Object.values(parameters) as Array<ParameterEntry<unknown>>;
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const rows = entries.flatMap((entry) => {
    const badge = element('span', { class: `badge ${needsAttention(entry.confidence) ? 'badge-warn' : 'badge-info'}` }, CONFIDENCE_LABELS[entry.confidence]);
    const row = element('tr', { 'data-testid': `param-${entry.id}`, class: needsAttention(entry.confidence) ? 'attention' : '' },
      element('td', { class: 'param-id' }, entry.id),
      element('td', {},
        element('div', {}, `${PARAMETER_MEANINGS[entry.id]}（${entry.symbol}）`),
        element('div', { class: 'param-source' }, entry.source)),
      element('td', { class: 'param-value' }, formatParameterValue(entry), element('div', { class: 'unit' }, entry.unit)),
      element('td', {}, badge));
    // (Re, S) の表は、パラメータの行の下にパネル幅いっぱいの行で出す（値の列には入りきらないため）。
    const details = tableDetails(entry);
    return details.length === 0 ? [row] : [row, element('tr', { class: 'coefficient-table-row' }, element('td', { colspan: '4' }, ...details))];
  });
  const counts = (label: string, n: number): string => `${label} ${n}`;
  const provisional = entries.filter((e) => e.confidence === 'provisional').length;
  const undetermined = entries.filter((e) => e.confidence === 'undetermined').length;
  return section('物理パラメータ',
    element('p', { class: 'hint' },
      `${counts('仮置き', provisional)}・${counts('未決定', undetermined)}。検証状態：すべて未検証（実測との照合は未実施、06 §2）。`,
      '値は 05 §10.2 を写したスタブです。'),
    element('details', {}, element('summary', {}, `一覧（${entries.length} 件）`),
      element('table', { class: 'params' }, element('tbody', {}, ...rows))),
  );
}
