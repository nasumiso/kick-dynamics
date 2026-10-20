// T1.5-03：再生クロック（AC-07・AC-08）と、再生速度が計算結果に影響しないこと（VER-S04）。
import { stateAt } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { INITIAL_KICK_STATE } from '../../src/kick/kick-state';
import { DEFAULT_PARAMETER_SET } from '../../src/params/default-parameter-set';
import { PLAYBACK_SPEEDS, PlaybackClock } from '../../src/playback/playback-clock';
import { applyTrajectoryPose } from '../../src/render/trajectory-view';
import { runKick } from '../../src/simulation/run-kick';

describe('playback clock', () => {
  it('advances by frame time × speed and stops at the end', () => {
    const clock = new PlaybackClock(1);
    clock.play();
    clock.tick(0.05);
    expect(clock.t).toBeCloseTo(0.05, 15);
    clock.setSpeed(0.25);
    clock.tick(0.08);
    expect(clock.t).toBeCloseTo(0.07, 15);
    for (let i = 0; i < 100; i++) clock.tick(0.05);
    expect(clock.t).toBe(1);
    expect(clock.playing).toBe(false);
    expect(clock.finished).toBe(true);
  });

  it('does not advance while paused, and resumes from the same time', () => {
    const clock = new PlaybackClock(2);
    clock.play();
    clock.tick(0.05);
    clock.pause();
    clock.tick(0.05);
    expect(clock.t).toBeCloseTo(0.05, 15);
    clock.play();
    clock.tick(0.05);
    expect(clock.t).toBeCloseTo(0.1, 15);
  });

  it('replays from the start (AC-08), also after finishing', () => {
    const clock = new PlaybackClock(0.1);
    clock.play();
    clock.tick(0.1);
    expect(clock.finished).toBe(true);
    clock.replay();
    expect(clock.t).toBe(0);
    expect(clock.playing).toBe(true);
    clock.tick(0.05);
    expect(clock.t).toBeCloseTo(0.05, 15);
  });

  it('caps a long frame (e.g. after the tab was hidden) and rejects non-positive speeds', () => {
    const clock = new PlaybackClock(10);
    clock.play();
    clock.tick(5);
    expect(clock.t).toBeCloseTo(0.1, 15);
    expect(() => clock.setSpeed(0)).toThrow(RangeError);
  });
});

describe('VER-S04 playback speed does not change the computed result', () => {
  it('leaves the trajectory data unchanged and shows the same pose at the same playback time for every speed', () => {
    const outcome = runKick(INITIAL_KICK_STATE, DEFAULT_PARAMETER_SET);
    if (!outcome.ok) throw new Error(outcome.reason);
    const trajectory = outcome.result.trajectory;
    const snapshot = [trajectory.time, trajectory.position, trajectory.orientation, trajectory.linearVelocity, trajectory.angularVelocity]
      .map((a) => Float64Array.from(a));
    const duration = trajectory.time[trajectory.time.length - 1]!;
    const posesAt = (speed: number): Map<string, number[]> => {
      const clock = new PlaybackClock(duration);
      clock.setSpeed(speed);
      clock.play();
      const ball = new THREE.Object3D();
      const poses = new Map<string, number[]>();
      // 同じ再生時刻 t = 0.1, 0.2, … での姿勢を記録する（再生速度によってフレームの数は変わる）。
      while (clock.playing) {
        clock.tick(1 / 60);
        applyTrajectoryPose(ball, trajectory, clock.t);
      }
      for (const t of [0.1, 0.5, 1, 2]) {
        applyTrajectoryPose(ball, trajectory, t);
        poses.set(String(t), [...ball.position.toArray(), ...ball.quaternion.toArray()]);
      }
      return poses;
    };
    const reference = posesAt(1);
    for (const speed of PLAYBACK_SPEEDS) expect(posesAt(speed)).toEqual(reference);
    // 再生の後も、軌道のデータはビット単位で変わらない。
    [trajectory.time, trajectory.position, trajectory.orientation, trajectory.linearVelocity, trajectory.angularVelocity]
      .forEach((a, i) => expect(Float64Array.from(a)).toEqual(snapshot[i]));
    // 同じ入力で計算し直しても、同じ結果になる（再生は計算に影響しない）。
    const again = runKick(INITIAL_KICK_STATE, DEFAULT_PARAMETER_SET);
    if (!again.ok) throw new Error(again.reason);
    expect(Float64Array.from(again.result.trajectory.position)).toEqual(snapshot[1]);
    expect(stateAt(again.result.trajectory, 1)).toEqual(stateAt(trajectory, 1));
  });
});
