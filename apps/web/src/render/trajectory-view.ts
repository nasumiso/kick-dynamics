// 軌道の描画（T1.4-09）：軌道のラインと、再生時刻でのボールの位置・姿勢。
// 距離感の補助（表示専用）：通過した部分の太い軌跡、地面への投影、ボールの真下への垂線、接地点と距離の数字。
import type { Trajectory } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { intervalAt } from '../playback/interpolate';
import { createTextLabel } from './text-label';

/** 再生時刻 t までに通過した、軌道の線分の数（サンプル i から i + 1 までを 1 つと数える）。 */
export function traveledSegments(times: ArrayLike<number>, t: number): number {
  return intervalAt(times, t).index;
}

export interface GroundMark {
  /** 接地したときのボールの中心の真下の点 [x, 0, z] m */
  readonly point: readonly [number, number, number];
  /** 蹴った位置（サンプル 0 の真下）からの水平距離 m */
  readonly distance: number;
}

/** 接地（ground-contact）の事象ごとに、地面上の点と、蹴った位置からの水平距離を返す。 */
export function groundMarks(trajectory: Trajectory): GroundMark[] {
  const p = trajectory.position;
  const marks: GroundMark[] = [];
  for (const event of trajectory.events) {
    if (event.type !== 'ground-contact') continue;
    const i = event.sampleIndex;
    const x = p[3 * i]!;
    const z = p[3 * i + 2]!;
    marks.push({ point: [x, 0, z], distance: Math.hypot(x - p[0]!, z - p[2]!) });
  }
  return marks;
}

/** 距離の数字を出す接地点の数の上限と、前の数字との最小の間隔 m（転がりの細かい接地で数字が重ならないように）。 */
const MAX_LABELS = 6;
const MIN_LABEL_GAP = 1;

export interface TrajectoryView {
  readonly object: THREE.Group;
  /** 再生時刻 t と、そのときのボールの中心の位置に合わせて、軌跡と垂線を更新する。 */
  readonly update: (t: number, ballPosition: THREE.Vector3) => void;
  /** GPU の資源を解放する（キックごとに作り直すため）。 */
  readonly dispose: () => void;
}

export function createTrajectoryView(trajectory: Trajectory): TrajectoryView {
  const group = new THREE.Group();
  group.name = 'trajectory';
  const positions = new Float32Array(trajectory.position);

  // 軌道全体（これから通る部分の見通し）：細く薄い線。
  const pathGeometry = new THREE.BufferGeometry();
  pathGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const path = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: 0xe0a800, transparent: true, opacity: 0.45 }));
  group.add(path);

  // 通過した部分：太い線（画面上の幅 px）。描く線分の数を再生時刻に合わせて増やす。
  const trailGeometry = new LineGeometry();
  trailGeometry.setPositions(positions);
  const trail = new Line2(trailGeometry, new LineMaterial({ color: 0xf2b600, linewidth: 4 }));
  trailGeometry.instanceCount = 0;
  group.add(trail);

  // 地面への投影：横方向の曲がりと飛距離を読むための線。
  const track = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    track[i] = positions[i]!;
    track[i + 1] = 0.007;
    track[i + 2] = positions[i + 2]!;
  }
  const trackGeometry = new THREE.BufferGeometry();
  trackGeometry.setAttribute('position', new THREE.BufferAttribute(track, 3));
  const trackLine = new THREE.Line(trackGeometry, new THREE.LineBasicMaterial({ color: 0x3a6fd8 }));
  group.add(trackLine);

  // ボールの真下への垂線と、地面の印（高さを読むため）。
  const dropGeometry = new THREE.BufferGeometry();
  dropGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const drop = new THREE.Line(dropGeometry, new THREE.LineBasicMaterial({ color: 0x3a6fd8 }));
  group.add(drop);
  const footprint = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 32),
    new THREE.MeshBasicMaterial({ color: 0x3a6fd8, side: THREE.DoubleSide }),
  );
  footprint.rotation.x = -Math.PI / 2;
  group.add(footprint);

  // 接地点の印と、蹴った位置からの距離。
  const disposables: Array<{ dispose: () => void }> = [];
  const markGeometry = new THREE.RingGeometry(0.14, 0.2, 32);
  const markMaterial = new THREE.MeshBasicMaterial({ color: 0xd0453a, side: THREE.DoubleSide });
  disposables.push(markGeometry, markMaterial);
  let lastLabelled: GroundMark | null = null;
  let labels = 0;
  for (const mark of groundMarks(trajectory)) {
    const ring = new THREE.Mesh(markGeometry, markMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(mark.point[0], 0.008, mark.point[2]);
    group.add(ring);
    const gap = lastLabelled ? Math.hypot(mark.point[0] - lastLabelled.point[0], mark.point[2] - lastLabelled.point[2]) : Infinity;
    if (labels < MAX_LABELS && gap >= MIN_LABEL_GAP) {
      // 画面上で一定の大きさにする（近くの数字が視界をふさがないように）。
      const label = createTextLabel(`${mark.distance.toFixed(1)} m`, 0.032);
      label.material.sizeAttenuation = false;
      label.position.set(mark.point[0], 0.4, mark.point[2]);
      group.add(label);
      disposables.push(label.material.map!, label.material);
      lastLabelled = mark;
      labels++;
    }
  }

  const dropPositions = dropGeometry.getAttribute('position') as THREE.BufferAttribute;
  return {
    object: group,
    update: (t, ball) => {
      trailGeometry.instanceCount = traveledSegments(trajectory.time, t);
      dropPositions.setXYZ(0, ball.x, ball.y, ball.z);
      dropPositions.setXYZ(1, ball.x, 0.007, ball.z);
      dropPositions.needsUpdate = true;
      dropGeometry.computeBoundingSphere();
      footprint.position.set(ball.x, 0.009, ball.z);
    },
    dispose: () => {
      for (const object of [path, trackLine, drop, footprint, trail] as const) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
      for (const item of disposables) item.dispose();
    },
  };
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
