// パラメータパネル（AC-13）：各物理パラメータの値・単位・確からしさ・出典を表示し、「仮置き」「未決定」を目立たせる。
// 検証状態（06 §2）は、実測との照合（VAL）を実施していないため、すべて「未検証」。
import type { ParameterEntry, ParameterSet } from '@kick-dynamics/physics-core';
import { CONFIDENCE_LABELS, formatParameterValue, needsAttention } from '../params/parameter-display';
import { PARAMETER_MEANINGS } from '../params/lab-parameter-set';
import { element, section } from './dom';

export function createParameterPanel(parameters: ParameterSet): HTMLElement {
  const entries = Object.values(parameters) as Array<ParameterEntry<unknown>>;
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const rows = entries.map((entry) => {
    const badge = element('span', { class: `badge ${needsAttention(entry.confidence) ? 'badge-warn' : 'badge-info'}` }, CONFIDENCE_LABELS[entry.confidence]);
    return element('tr', { 'data-testid': `param-${entry.id}`, class: needsAttention(entry.confidence) ? 'attention' : '' },
      element('td', { class: 'param-id' }, entry.id),
      element('td', {},
        element('div', {}, `${PARAMETER_MEANINGS[entry.id]}（${entry.symbol}）`),
        element('div', { class: 'param-source' }, entry.source)),
      element('td', { class: 'param-value' }, formatParameterValue(entry), element('div', { class: 'unit' }, entry.unit)),
      element('td', {}, badge));
  });
  const counts = (label: string, n: number): string => `${label} ${n}`;
  const provisional = entries.filter((e) => e.confidence === 'provisional').length;
  const undetermined = entries.filter((e) => e.confidence === 'undetermined').length;
  return section('物理パラメータ',
    element('p', { class: 'hint' },
      `${counts('仮置き', provisional)}・${counts('未決定', undetermined)}。検証状態：すべて未検証（実測との照合は未実施、06 §2）。`,
      '値は 05 §10.2 を写したもので、キックの計算に使います。'),
    element('details', {}, element('summary', {}, `一覧（${entries.length} 件）`),
      element('table', { class: 'params' }, element('tbody', {}, ...rows))),
  );
}
