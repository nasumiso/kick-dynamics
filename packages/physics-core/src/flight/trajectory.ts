// 軌道データの出力形式（docs/04-architecture.md §6 の Trajectory）。
// 配列の構造体で、各量は Float64Array（OQ-15）。サンプル i の位置は position[3i … 3i+2]、姿勢は orientation[4i … 4i+3]（[x, y, z, w]）。
import type { BallParams, RigidBodyState } from '../bodies/types';
import { ok, type SimResult } from '../result';
import { simulateFlightRun, type FlightRun } from './ground-events';
import type { FlightEnvironment, FlightEvent, FlightSimulationSettings, GroundContactHandler } from './types';

export interface Trajectory {
  /** s。単調非減少。同じ時刻が続くのは、状態が不連続なイベント（接地の処理の前後）の時刻だけ */
  readonly time: Float64Array;
  /** m、3N */
  readonly position: Float64Array;
  /** m/s、3N */
  readonly linearVelocity: Float64Array;
  /** 4N、[x, y, z, w] */
  readonly orientation: Float64Array;
  /** rad/s、3N（ワールド座標） */
  readonly angularVelocity: Float64Array;
  /** イベント。各イベントの時刻のサンプルを必ず含む（sampleIndex） */
  readonly events: readonly FlightEvent[];
}

export function toTrajectory(run: FlightRun): Trajectory {
  const n = run.samples.length;
  const time = new Float64Array(n);
  const position = new Float64Array(3 * n);
  const linearVelocity = new Float64Array(3 * n);
  const orientation = new Float64Array(4 * n);
  const angularVelocity = new Float64Array(3 * n);
  run.samples.forEach((sample, i) => {
    time[i] = sample.time;
    position.set(sample.state.position, 3 * i);
    linearVelocity.set(sample.state.linearVelocity, 3 * i);
    orientation.set(sample.state.orientation, 4 * i);
    angularVelocity.set(sample.state.angularVelocity, 3 * i);
  });
  return { time, position, linearVelocity, orientation, angularVelocity, events: run.events };
}

/** サンプル i の状態。 */
export function stateAt(trajectory: Trajectory, i: number): RigidBodyState {
  const p = trajectory.position;
  const v = trajectory.linearVelocity;
  const q = trajectory.orientation;
  const w = trajectory.angularVelocity;
  return {
    position: [p[3 * i]!, p[3 * i + 1]!, p[3 * i + 2]!],
    linearVelocity: [v[3 * i]!, v[3 * i + 1]!, v[3 * i + 2]!],
    orientation: [q[4 * i]!, q[4 * i + 1]!, q[4 * i + 2]!, q[4 * i + 3]!],
    angularVelocity: [w[3 * i]!, w[3 * i + 1]!, w[3 * i + 2]!],
  };
}

/** 地面イベントを含めて飛翔を積分し、軌道データを返す（05 §7、04 §6 の simulateFlight）。 */
export function simulateFlight(
  initial: RigidBodyState, ball: BallParams, environment: FlightEnvironment, settings: FlightSimulationSettings,
  onGroundContact?: GroundContactHandler,
): SimResult<Trajectory> {
  const run = simulateFlightRun(initial, ball, environment, settings, onGroundContact);
  if (!run.ok) return run;
  return ok(toTrajectory(run.value));
}
