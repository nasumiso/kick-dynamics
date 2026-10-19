// Core の型 ↔ Three.js の型の変換（04 §3、T1.4-03）。
// 座標系は同じ（ADR-0005：y 上向きの右手系。Three.js も y 上向きの右手系）なので、成分はそのまま対応する。
// 四元数は Core が [x, y, z, w]（Hamilton 積、物体 → ワールドの能動回転）、Three.js の Quaternion も (x, y, z, w) で、
// applyQuaternion は v ↦ q v q* なので同じ回転を表す。Mat3 は Core が行優先、Three.js の Matrix3.elements は列優先。
import type { Mat3, Quat, Vec3 } from '@kick-dynamics/physics-core';
import * as THREE from 'three';

export function toThreeVector(v: Vec3, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(v[0], v[1], v[2]);
}

export function fromThreeVector(v: THREE.Vector3): Vec3 {
  return [v.x, v.y, v.z];
}

export function toThreeQuaternion(q: Quat, target = new THREE.Quaternion()): THREE.Quaternion {
  return target.set(q[0], q[1], q[2], q[3]);
}

export function fromThreeQuaternion(q: THREE.Quaternion): Quat {
  return [q.x, q.y, q.z, q.w];
}

export function toThreeMatrix3(m: Mat3, target = new THREE.Matrix3()): THREE.Matrix3 {
  // Matrix3.set は行優先で受け取る。
  return target.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
}

export function fromThreeMatrix3(m: THREE.Matrix3): Mat3 {
  const e = m.elements; // 列優先
  return [e[0]!, e[3]!, e[6]!, e[1]!, e[4]!, e[7]!, e[2]!, e[5]!, e[8]!];
}
