// T1.4-03：Core ↔ Three.js のアダプタ。往復で値が一致すること（完了確認）に加え、
// 同じ値が同じ意味を持つこと（回転の作用・積の順・行列の行と列）を、Core と Three.js の両方で計算して確かめる。
import { mat3, quat, type Mat3, type Quat, type Vec3 } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  fromThreeMatrix3, fromThreeQuaternion, fromThreeVector, toThreeMatrix3, toThreeQuaternion, toThreeVector,
} from '../../src/adapters/three-adapter';

const TOL = 1e-12;
function expectAllClose(actual: readonly number[], expected: readonly number[]): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((a, i) => expect(Math.abs(a - expected[i]!)).toBeLessThanOrEqual(TOL + TOL * Math.abs(expected[i]!)));
}

const v: Vec3 = [0.3, -1.7, 2.5];
const q: Quat = quat.fromAxisAngle([1, 2, -0.5], 0.9);
const r: Quat = quat.fromAxisAngle([-0.4, 0.1, 1], -1.3);
const m: Mat3 = [1, 2, 3, 4, 5, 6, 7, 8, 10];

describe('round trips Core → Three.js → Core', () => {
  it('keeps vectors, quaternions and matrices exactly', () => {
    expect(fromThreeVector(toThreeVector(v))).toEqual(v);
    expect(fromThreeQuaternion(toThreeQuaternion(q))).toEqual(q);
    expect(fromThreeMatrix3(toThreeMatrix3(m))).toEqual(m);
  });
});

describe('the same values mean the same thing in Core and Three.js (ADR-0005)', () => {
  it('rotates a vector the same way (v ↦ q v q*)', () => {
    expectAllClose(fromThreeVector(toThreeVector(v).applyQuaternion(toThreeQuaternion(q))), quat.rotate(q, v));
  });

  it('composes rotations in the same order (Hamilton product q ⊗ r)', () => {
    const composed = toThreeQuaternion(q).multiply(toThreeQuaternion(r));
    expectAllClose(fromThreeQuaternion(composed), quat.multiply(q, r));
  });

  it('builds the same rotation matrix from a quaternion', () => {
    const fromThree = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(toThreeQuaternion(q)));
    expectAllClose(fromThreeMatrix3(fromThree), quat.toMat3(q));
  });

  it('multiplies matrices and vectors with the same rows and columns', () => {
    expectAllClose(fromThreeVector(toThreeVector(v).applyMatrix3(toThreeMatrix3(m))), mat3.mulVec(m, v));
  });

  it('uses +y as up and +x × +y = +z (right-handed, y up)', () => {
    const x = new THREE.Vector3(1, 0, 0);
    expect(fromThreeVector(x.cross(new THREE.Vector3(0, 1, 0)))).toEqual([0, 0, 1]);
    expect(fromThreeVector(THREE.Object3D.DEFAULT_UP)).toEqual([0, 1, 0]);
  });
});
