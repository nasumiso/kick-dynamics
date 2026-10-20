// キックの実行と軌道の再生（T1.5-02）。再生クロック・再生速度・リプレイの本実装は T1.5-03。
import { element, formatNumber, section } from './dom';

export interface PlaybackPanel {
  readonly root: HTMLElement;
  readonly showTime: (t: number, duration: number) => void;
  /** 実行の結果、または実行しなかった理由（AC-05） */
  readonly showMessage: (message: string, ok: boolean) => void;
}

export function createPlaybackPanel(onKick: () => void, onReset: () => void): PlaybackPanel {
  const time = element('span', { class: 'hint', 'data-testid': 'playback-time' });
  const message = element('p', { class: 'status', 'data-testid': 'kick-result' });
  message.hidden = true;
  const kick = element('button', { type: 'button', 'data-testid': 'run-kick' }, 'キック');
  const reset = element('button', { type: 'button', 'data-testid': 'reset' }, '初期位置に戻す');
  kick.addEventListener('click', onKick);
  reset.addEventListener('click', onReset);
  const root = section('キックの実行',
    element('p', { class: 'hint' }, '入力とパラメータから Core で衝突・飛翔・接地を計算し、軌道を再生します。再生後に接触点を指定するときは「初期位置に戻す」を押してください。'),
    element('div', { class: 'buttons' }, kick, reset), time, message);
  return {
    root,
    showTime: (t, duration) => { time.textContent = `t = ${formatNumber(t, 2)} s / ${formatNumber(duration, 2)} s`; },
    showMessage: (text, ok) => {
      message.hidden = false;
      message.textContent = text;
      message.className = ok ? 'status ok' : 'status error';
    },
  };
}
