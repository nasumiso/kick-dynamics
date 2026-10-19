// キックの実行と再生（T1.5-02）。再生速度・一時停止・リプレイは T1.5-03。
import { element, formatNumber, section } from './dom';

export interface PlaybackPanel {
  readonly root: HTMLElement;
  readonly showTime: (t: number, duration: number) => void;
}

export function createPlaybackPanel(onRun: () => void, onReset: () => void): PlaybackPanel {
  const time = element('span', { class: 'hint', 'data-testid': 'playback-time' });
  const run = element('button', { type: 'button', 'data-testid': 'run-kick' }, 'キックを実行');
  const reset = element('button', { type: 'button' }, '初期位置に戻す');
  run.addEventListener('click', onRun);
  reset.addEventListener('click', onReset);
  const root = section('キックの実行',
    element('p', { class: 'hint' }, '入力とパラメータからキック 1 回分を計算し、実時間で再生します。計算に使う値の多くは「仮置き」です（物理パラメータの一覧を参照）。再生後に入力を変えるときは「初期位置に戻す」を押してください。'),
    element('div', { class: 'buttons' }, run, reset), time);
  return { root, showTime: (t, duration) => { time.textContent = `t = ${formatNumber(t, 2)} s / ${formatNumber(duration, 2)} s`; } };
}
