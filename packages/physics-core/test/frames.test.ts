// VER-M06：座標系の規約（右手系、重力が −y、05 §2 の軸の定義）。
import { describe, expect, it } from 'vitest';
import { gravityVector, WORLD_FORWARD, WORLD_RIGHT, WORLD_UP } from '../src/frames';
import { fromAxisAngle, rotate } from '../src/math/quat';
import { cross } from '../src/math/vec3';
import { expectAllClose } from './tolerance';

describe('VER-M06 coordinate conventions', () => {
  it('uses a right-handed frame with +z = x̂ × ŷ', () => {
    expect(WORLD_FORWARD).toEqual([1, 0, 0]);
    expect(WORLD_UP).toEqual([0, 1, 0]);
    expect(cross(WORLD_FORWARD, WORLD_UP)).toEqual(WORLD_RIGHT);
  });

  it('gravity points along −y', () => {
    expect(gravityVector(9.80665)).toEqual([0, -9.80665, 0]);
  });

  it('positive rotations follow the right-hand rule about each axis', () => {
    const quarter = Math.PI / 2;
    expectAllClose(rotate(fromAxisAngle([0, 0, 1], quarter), [1, 0, 0]), [0, 1, 0]);
    expectAllClose(rotate(fromAxisAngle([0, 1, 0], quarter), [1, 0, 0]), [0, 0, -1]);
    expectAllClose(rotate(fromAxisAngle([1, 0, 0], quarter), [0, 1, 0]), [0, 0, 1]);
  });
});
