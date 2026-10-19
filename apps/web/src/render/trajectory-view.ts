// 軌道の描画（T1.4-09）：軌道のラインと、再生時刻でのボールの位置・姿勢。
import type { Trajectory } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { intervalAt } from '../playback/interpolate';

export function createTrajectoryLine(trajectory: Trajectory): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trajectory.position), 3));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffd60a }));
  line.name = 'trajectory';
  return line;
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

/** 再生時刻 t の位置（線形補間）と姿勢（球面線形補間）を object に与える。 */
export function applyTrajectoryPose(object: THREE.Object3D, trajectory: Trajectory, t: number): void {
  const { index: i, alpha } = intervalAt(trajectory.time, t);
  const j = Math.min(i + 1, trajectory.time.length - 1);
  const p = trajectory.position;
  const q = trajectory.orientation;
  object.position.set(
    p[3 * i]! + alpha * (p[3 * j]! - p[3 * i]!),
    p[3 * i + 1]! + alpha * (p[3 * j + 1]! - p[3 * i + 1]!),
    p[3 * i + 2]! + alpha * (p[3 * j + 2]! - p[3 * i + 2]!),
  );
  qa.set(q[4 * i]!, q[4 * i + 1]!, q[4 * i + 2]!, q[4 * i + 3]!);
  qb.set(q[4 * j]!, q[4 * j + 1]!, q[4 * j + 2]!, q[4 * j + 3]!);
  object.quaternion.slerpQuaternions(qa, qb, alpha);
}
