// 接触点の表示（AC-02）：d の成分と、方位角・仰角（度、spec §4）。
import type { Vec3 } from '@kick-dynamics/physics-core';
import { directionToAngles } from '../units/direction';
import { radToDeg } from '../units/units';
import { element, formatNumber, section } from './dom';

export interface ContactPanel {
  readonly root: HTMLElement;
  readonly show: (d: Vec3 | null) => void;
}

export function createContactPanel(): ContactPanel {
  const value = element('dl', { class: 'readout' });
  const root = section('接触点', element('p', { class: 'hint' }, 'ボールの表面をクリックして指定します。'), value);
  const show = (d: Vec3 | null): void => {
    if (!d) {
      value.replaceChildren(element('dt', {}, '未指定'));
      return;
    }
    const angles = directionToAngles(d)!;
    value.replaceChildren(
      element('dt', {}, 'd'), element('dd', { 'data-testid': 'contact-d' }, `(${d.map((x) => formatNumber(x, 3)).join(', ')})`),
      element('dt', {}, '方位角 ψ'), element('dd', { 'data-testid': 'contact-azimuth' }, `${formatNumber(radToDeg(angles.azimuth), 1)}°`),
      element('dt', {}, '仰角 θ'), element('dd', { 'data-testid': 'contact-elevation' }, `${formatNumber(radToDeg(angles.elevation), 1)}°`),
    );
  };
  show(null);
  return { root, show };
}
