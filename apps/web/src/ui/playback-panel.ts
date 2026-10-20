// キックの実行と軌道の再生（T1.5-02、T1.5-03）。再生速度・一時停止・リプレイは再生時刻の進め方だけを変える（AC-07・AC-08）。
import { PLAYBACK_SPEEDS } from '../playback/playback-clock';
import { element, formatNumber, section } from './dom';

export interface PlaybackPanel {
  readonly root: HTMLElement;
  readonly showTime: (t: number, duration: number) => void;
  /** 実行の結果、または実行しなかった理由（AC-05） */
  readonly showMessage: (message: string, ok: boolean) => void;
  /** 再生中か一時停止中か。null は再生する軌道がない状態（再生操作を無効にする） */
  readonly showPlaying: (playing: boolean | null) => void;
}

export interface PlaybackControls {
  readonly togglePause: () => void;
  readonly replay: () => void;
  readonly setSpeed: (speed: number) => void;
}

export function createPlaybackPanel(onKick: () => void, onReset: () => void, controls: PlaybackControls): PlaybackPanel {
  const time = element('span', { class: 'hint', 'data-testid': 'playback-time' });
  const message = element('p', { class: 'status', 'data-testid': 'kick-result' });
  message.hidden = true;
  const kick = element('button', { type: 'button', 'data-testid': 'run-kick' }, 'キック');
  const reset = element('button', { type: 'button', 'data-testid': 'reset' }, '初期位置に戻す');
  const pause = element('button', { type: 'button', 'data-testid': 'pause' }, '一時停止');
  const replay = element('button', { type: 'button', 'data-testid': 'replay' }, 'リプレイ');
  const speed = element('select', { 'data-testid': 'speed' },
    ...PLAYBACK_SPEEDS.map((s) => element('option', { value: String(s) }, `${s} 倍`)));
  pause.disabled = true;
  replay.disabled = true;
  kick.addEventListener('click', onKick);
  reset.addEventListener('click', onReset);
  pause.addEventListener('click', controls.togglePause);
  replay.addEventListener('click', controls.replay);
  speed.addEventListener('change', () => controls.setSpeed(Number(speed.value)));
  const root = section('キックの実行と再生',
    element('p', { class: 'hint' }, '入力とパラメータから Core で衝突・飛翔・接地を計算し、軌道を再生します。再生速度・一時停止・リプレイは表示だけを変え、計算結果は変わりません。再生後に接触点を指定するときは「初期位置に戻す」を押してください。'),
    element('div', { class: 'buttons' }, kick, reset),
    element('div', { class: 'buttons' }, pause, replay, element('label', { class: 'hint' }, '再生速度 ', speed)),
    time, message);
  return {
    root,
    showTime: (t, duration) => { time.textContent = `t = ${formatNumber(t, 2)} s / ${formatNumber(duration, 2)} s`; },
    showMessage: (text, ok) => {
      message.hidden = false;
      message.textContent = text;
      message.className = ok ? 'status ok' : 'status error';
    },
    showPlaying: (playing) => {
      pause.textContent = playing === false ? '再開' : '一時停止';
      pause.disabled = playing === null;
      replay.disabled = playing === null;
    },
  };
}
