// 表示の設定パネル（表示専用、物理の計算には影響しない）：足の直方体とそのラベル・軸の表示を ON/OFF する。
// 視点：足の移動方向の水平成分の真後ろから見る（ゴルフゲームのショットの視点、spec 003 §4）。
import { element, section } from './dom';
import { installShortcuts, shortcutButton } from './shortcuts';

export interface DisplaySettings {
  /** 足の直方体（面のラベルと物体座標の軸を含む）を表示するか */
  readonly foot: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = { foot: true };

export function createDisplayPanel(initial: DisplaySettings, onChange: (settings: DisplaySettings) => void, onViewBehind: () => void): HTMLElement {
  let settings = initial;
  const foot = element('input', { type: 'checkbox', 'data-testid': 'display-foot' });
  foot.checked = initial.foot;
  foot.addEventListener('change', () => {
    settings = { ...settings, foot: foot.checked };
    onChange(settings);
  });
  const { button: behind } = shortcutButton('足の後ろから見る', 'behind', 'view-behind');
  behind.addEventListener('click', onViewBehind);
  installShortcuts({ behind });
  return section('表示',
    element('label', { class: 'check-row' }, foot, ' 足（直方体・面のラベル・軸）'),
    element('div', { class: 'buttons' }, behind),
  );
}
