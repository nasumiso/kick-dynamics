// 足の速度 v_A^p の矢印（入力の確認用の表示）。物理の計算には使わない。
// ボールへ近づく向き（v_A^p · n > 0、05 §6.2）では矢じりを接触点に置き、足が接触点へ向かって動く様子を示す。
// 離れる向きでは接触点から矢を出し、色を変える。
import type { Vec3 } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { toThreeVector } from '../adapters/three-adapter';

/** 表示の縮尺：速さ 1 m/s あたりの矢の長さ m（表示専用）。 */
const LENGTH_PER_SPEED = 0.01;
const MIN_LENGTH = 0.05;
const MAX_LENGTH = 0.4;
const APPROACH_COLOR = 0x2f9e44;
const SEPARATING_COLOR = 0xe03131;

export interface ArrowGeometry {
  /** 矢の根元（ワールド座標 m） */
  readonly origin: Vec3;
  /** 矢の向き（単位ベクトル） */
  readonly direction: Vec3;
  /** 矢の長さ m（表示の縮尺） */
  readonly length: number;
  /** 足がボールへ近づく向きか */
  readonly approaching: boolean;
}

/**
 * 接触点 p = ボール中心 + R d と v_A^p から矢の形を求める。速さが 0 のときは null（表示しない）。
 * 近づく向きかどうかは n = −d との内積で判定する（05 §6.2 の接触の成立条件と同じ）。
 */
export function velocityArrowGeometry(ballCenter: Vec3, radius: number, d: Vec3, velocity: Vec3): ArrowGeometry | null {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  if (!(speed > 0)) return null;
  const direction: Vec3 = [velocity[0] / speed, velocity[1] / speed, velocity[2] / speed];
  const length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, speed * LENGTH_PER_SPEED));
  const contact: Vec3 = [ballCenter[0] + radius * d[0], ballCenter[1] + radius * d[1], ballCenter[2] + radius * d[2]];
  const approaching = -(velocity[0] * d[0] + velocity[1] * d[1] + velocity[2] * d[2]) > 0;
  const origin: Vec3 = approaching
    ? [contact[0] - length * direction[0], contact[1] - length * direction[1], contact[2] - length * direction[2]]
    : contact;
  return { origin, direction, length, approaching };
}

export interface VelocityArrow {
  readonly object: THREE.Object3D;
  /** geometry が null なら非表示にする */
  readonly update: (geometry: ArrowGeometry | null) => void;
}

export function createVelocityArrow(): VelocityArrow {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), MIN_LENGTH, APPROACH_COLOR);
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  return {
    object: arrow,
    update: (geometry) => {
      arrow.visible = geometry !== null;
      if (!geometry) return;
      arrow.position.copy(toThreeVector(geometry.origin, origin));
      arrow.setDirection(toThreeVector(geometry.direction, direction));
      arrow.setLength(geometry.length, Math.min(0.04, geometry.length * 0.3), 0.025);
      arrow.setColor(geometry.approaching ? APPROACH_COLOR : SEPARATING_COLOR);
    },
  };
}
