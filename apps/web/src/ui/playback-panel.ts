// スタブ軌道の再生（T1.4-09、描画の確認用）。再生クロック・再生速度・リプレイの本実装は M1.5（T1.5-03）。
import { element, formatNumber, section } from './dom';

export interface PlaybackPanel {
  readonly root: HTMLElement;
  readonly showTime: (t: number, duration: number) => void;
}

export function createPlaybackPanel(onPlay: () => void, onReset: () => void): PlaybackPanel {
  const time = element('span', { class: 'hint', 'data-testid': 'playback-time' });
  const play = element('button', { type: 'button', 'data-testid': 'play-stub' }, 'スタブ軌道を再生');
  const reset = element('button', { type: 'button' }, '初期位置に戻す');
  play.addEventListener('click', onPlay);
  reset.addEventListener('click', onReset);
  const root = section('軌道（スタブ）',
    element('p', { class: 'hint' }, '描画の確認用の固定の軌道です（重力のみの真空中、最初の接地まで）。キック入力からの計算は M1.5 で接続します。再生後に接触点を指定するときは「初期位置に戻す」を押してください。'),
    element('div', { class: 'buttons' }, play, reset), time);
  return { root, showTime: (t, duration) => { time.textContent = `t = ${formatNumber(t, 2)} s / ${formatNumber(duration, 2)} s`; } };
}
