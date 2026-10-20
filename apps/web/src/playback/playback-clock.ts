// 再生クロック（T1.5-03、04 §6 の「再生クロック t_play += Δt_frame × 再生速度」）。
// 再生速度・一時停止・リプレイは再生時刻の進め方だけを変え、軌道のデータ（物理の計算結果）には触れない（NFR-04、VER-S04）。

/** 再生速度の候補（spec §4）。 */
export const PLAYBACK_SPEEDS = [1, 0.5, 0.25, 0.1] as const;

/** 1 フレームで進める描画時間の上限 s。タブが非表示だった後などに再生時刻が大きく飛ばないようにする（表示だけの値）。 */
const MAX_FRAME_SECONDS = 0.1;

export class PlaybackClock {
  private time = 0;
  private running = false;
  private rate: number = PLAYBACK_SPEEDS[0];

  constructor(private readonly duration: number) {}

  /** 再生時刻 s（0 ≤ t ≤ duration） */
  get t(): number {
    return this.time;
  }

  get playing(): boolean {
    return this.running;
  }

  get speed(): number {
    return this.rate;
  }

  get finished(): boolean {
    return this.time >= this.duration;
  }

  /** 描画の 1 フレームぶん進める。frameSeconds は前のフレームからの実時間 s。 */
  tick(frameSeconds: number): void {
    if (!this.running || !(frameSeconds > 0)) return;
    this.time = Math.min(this.duration, this.time + Math.min(frameSeconds, MAX_FRAME_SECONDS) * this.rate);
    if (this.time >= this.duration) this.running = false;
  }

  play(): void {
    if (this.finished) this.time = 0;
    this.running = true;
  }

  pause(): void {
    this.running = false;
  }

  /** 最初から再生し直す（AC-08）。 */
  replay(): void {
    this.time = 0;
    this.running = true;
  }

  setSpeed(speed: number): void {
    if (!(Number.isFinite(speed) && speed > 0)) throw new RangeError(`playback speed must be positive (${speed})`);
    this.rate = speed;
  }
}
