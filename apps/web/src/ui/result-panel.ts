// 測定値と衝突診断のパネル（T1.5-04、AC-09・AC-12）。表示単位の値と、Core の内部単位（SI）の値を併記する。
import type { KickSimulationResult } from '@kick-dynamics/physics-core';
import { diagnosticsRows, metricsRows, type ResultRow } from '../simulation/result-rows';
import { element, section } from './dom';

function table(rows: readonly ResultRow[], testId: string): HTMLElement {
  return element('table', { class: 'results', 'data-testid': testId },
    element('thead', {}, element('tr', {}, element('th', {}, '項目'), element('th', {}, '表示'), element('th', {}, 'SI（内部の値）'))),
    element('tbody', {}, ...rows.map((r) => element('tr', { 'data-key': r.key },
      element('td', {}, r.label), element('td', {}, r.display), element('td', { class: 'si' }, r.si)))));
}

export interface ResultPanel {
  readonly root: HTMLElement;
  readonly show: (result: KickSimulationResult | null) => void;
}

export function createResultPanel(): ResultPanel {
  const body = element('div', {});
  const root = section('測定値と衝突診断', body);
  const show = (result: KickSimulationResult | null): void => {
    if (!result) {
      body.replaceChildren(element('p', { class: 'hint' }, 'キックを実行すると表示されます。'));
      return;
    }
    body.replaceChildren(
      element('h3', {}, '測定値（05 §9）'), table(metricsRows(result.metrics), 'metrics'),
      element('h3', {}, '衝突診断'), table(diagnosticsRows(result.impact, result.warnings), 'diagnostics'),
      element('p', { class: 'hint' }, `モデル ${result.modelVersion}。値の多くは仮置きのパラメータによる計算で、実測と照合していない（未検証）。`),
    );
  };
  show(null);
  return { root, show };
}
