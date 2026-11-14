// 表示の設定パネル（表示専用、物理の計算には影響しない）：足の直方体とそのラベル・軸の表示を ON/OFF する。
import { element, section } from './dom';

export interface DisplaySettings {
  /** 足の直方体（面のラベルと物体座標の軸を含む）を表示するか */
  readonly foot: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = { foot: true };

export function createDisplayPanel(initial: DisplaySettings, onChange: (settings: DisplaySettings) => void): HTMLElement {
  let settings = initial;
  const foot = element('input', { type: 'checkbox', 'data-testid': 'display-foot' });
  foot.checked = initial.foot;
  foot.addEventListener('change', () => {
    settings = { ...settings, foot: foot.checked };
    onChange(settings);
  });
  return section('表示',
    element('label', { class: 'check-row' }, foot, ' 足（直方体・面のラベル・軸）'),
  );
}
