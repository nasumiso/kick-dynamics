// DOM の小さな補助（UI ライブラリは使わない。OQ-17 は未決定、ADR-0004）。

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, attributes: Record<string, string> = {}, ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

/** 見出し付きのパネルの区画。 */
export function section(title: string, ...children: Array<Node | string>): HTMLElement {
  return element('section', { class: 'panel-section' }, element('h2', {}, title), ...children);
}

/** 数値の表示（小数点以下の桁数を固定）。 */
export function formatNumber(value: number, digits: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(digits);
}
