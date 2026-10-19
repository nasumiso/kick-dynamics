// T1.4-06：足モデルの配置（AC-03 の自動確認は Core の VER-C17）。ここでは、配置の結果を Three.js の物体に
// 与えたとき、接触面（+z_b 面）上の点 (s_x, s_y, L_z/2) が接触点に、+z_b 軸が接触法線 n に重なることを確かめる。
import { quat, type Vec3 } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fromThreeVector, toThreeQuaternion, toThreeVector } from '../../src/adapters/three-adapter';
import { footPose } from '../../src/kick/foot-placement';
import { INITIAL_KICK_STATE, toKickInput } from '../../src/kick/kick-state';
import { WORKING_FOOT, WORKING_GEOMETRY } from '../../src/params/working-values';
import { anglesToDirection } from '../../src/units/direction';

const TOL = 1e-12;
function expectAllClose(actual: readonly number[], expected: readonly number[]): void {
  actual.forEach((a, i) => expect(Math.abs(a - expected[i]!)).toBeLessThanOrEqual(TOL + TOL * Math.abs(expected[i]!)));
}

describe('foot placement shown in Three.js (AC-03)', () => {
  const cases: Array<{ d: Vec3; roll: number; s: readonly [number, number] }> = [
    { d: [-1, 0, 0], roll: 0, s: [0, 0] },
    { d: anglesToDirection({ azimuth: 2.4, elevation: -0.3 }), roll: 0.7, s: [0.05, -0.02] },
    { d: anglesToDirection({ azimuth: -1.1, elevation: 0.5 }), roll: -2.0, s: [-0.1, 0.04] },
  ];
  for (const { d, roll, s } of cases) {
    it(`puts the contact face on the contact point with its normal along n (d = ${d.map((x) => x.toFixed(2)).join(', ')})`, () => {
      const input = toKickInput({ ...INITIAL_KICK_STATE, contactDirection: d, footRoll: roll, footContactLocation: s });
      const pose = footPose(input, WORKING_GEOMETRY);
      if (!pose.ok) throw new Error(pose.error.message);
      const object = new THREE.Object3D();
      toThreeVector(pose.value.position, object.position);
      toThreeQuaternion(pose.value.orientation, object.quaternion);
      object.updateMatrixWorld();
      const lz = WORKING_FOOT.shape.dimensions[2];
      expectAllClose(fromThreeVector(object.localToWorld(new THREE.Vector3(s[0], s[1], lz / 2))), pose.value.contactPoint);
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
      expectAllClose(fromThreeVector(normal), [-d[0], -d[1], -d[2]]);
    });
  }

  it('places the foot even when the foot velocity is not approaching the ball', () => {
    const input = toKickInput({ ...INITIAL_KICK_STATE, footAzimuth: Math.PI }); // 後ろ向きに動く足
    expect(footPose(input, WORKING_GEOMETRY).ok).toBe(true);
  });
});

describe('initial foot pose with the display-only anatomical mapping (05 §5.2)', () => {
  it('points the toe (+x_b) down and faces the instep (+z_b) towards the ball at the initial input', () => {
    const pose = footPose(toKickInput(INITIAL_KICK_STATE), WORKING_GEOMETRY);
    expect(pose.ok).toBe(true);
    if (!pose.ok) return;
    const toe = quat.rotate(pose.value.orientation, [1, 0, 0]);
    const instep = quat.rotate(pose.value.orientation, [0, 0, 1]);
    [0, -1, 0].forEach((x, i) => expect(Math.abs(toe[i]! - x)).toBeLessThanOrEqual(1e-12));
    [1, 0, 0].forEach((x, i) => expect(Math.abs(instep[i]! - x)).toBeLessThanOrEqual(1e-12));
  });
});
