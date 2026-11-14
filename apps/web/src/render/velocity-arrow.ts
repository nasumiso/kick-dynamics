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

/** 軸の太さ（半径 m）と矢じりの大きさ m（見やすさのための表示の値）。 */
const SHAFT_RADIUS = 0.006;
const HEAD_RADIUS = 0.018;
const HEAD_LENGTH = 0.045;

/**
 * 太い矢（円柱の軸＋円錐の矢じり）。線の太さは WebGL では 1 px に固定されるため、メッシュで作る。
 * 形は +y 向きの長さ 1 で作り、update で向き・長さを合わせる。
 */
export function createVelocityArrow(): VelocityArrow {
  const material = new THREE.MeshBasicMaterial({ color: APPROACH_COLOR });
  const shaftGeometry = new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, 1, 12);
  shaftGeometry.translate(0, 0.5, 0); // 根元を原点に
  const shaft = new THREE.Mesh(shaftGeometry, material);
  const headGeometry = new THREE.ConeGeometry(HEAD_RADIUS, 1, 16);
  headGeometry.translate(0, -0.5, 0); // 先端を原点に
  const head = new THREE.Mesh(headGeometry, material);
  const arrow = new THREE.Group();
  arrow.name = 'foot-velocity-arrow';
  arrow.add(shaft, head);
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    object: arrow,
    update: (geometry) => {
      arrow.visible = geometry !== null;
      if (!geometry) return;
      arrow.position.copy(toThreeVector(geometry.origin, origin));
      arrow.quaternion.setFromUnitVectors(up, toThreeVector(geometry.direction, direction));
      const headLength = Math.min(HEAD_LENGTH, geometry.length * 0.4);
      shaft.scale.set(1, geometry.length - headLength, 1);
      head.scale.set(1, headLength, 1);
      head.position.set(0, geometry.length, 0);
      material.color.setHex(geometry.approaching ? APPROACH_COLOR : SEPARATING_COLOR);
    },
  };
}
