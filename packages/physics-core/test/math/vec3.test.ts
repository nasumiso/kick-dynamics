// VER-M01：Vec3 演算の恒等式。
import { describe, expect, it } from 'vitest';
import {
  add, addScaled, cross, dot, length, negate, normalize, scale, sub, UNIT_X, UNIT_Y, UNIT_Z, type Vec3,
} from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';

const a: Vec3 = [1.5, -2.25, 3.125];
const b: Vec3 = [-0.75, 4.5, 2];
const c: Vec3 = [0.3, 0.1, -1.7];

describe('VER-M01 Vec3', () => {
  it('adds and subtracts component-wise', () => {
    expect(add(a, b)).toEqual([0.75, 2.25, 5.125]);
    expect(sub(a, b)).toEqual([2.25, -6.75, 1.125]);
    expectAllClose(sub(add(a, b), b), a);
    expect(negate(a)).toEqual([-1.5, 2.25, -3.125]);
    expect(scale(a, 2)).toEqual([3, -4.5, 6.25]);
    expectAllClose(addScaled(a, b, 0.5), add(a, scale(b, 0.5)));
  });

  it('dot product is symmetric and bilinear', () => {
    expectClose(dot(a, b), dot(b, a));
    expectClose(dot(a, add(b, c)), dot(a, b) + dot(a, c));
    expectClose(dot(a, a), length(a) ** 2);
  });

  it('cross product follows the right-handed basis', () => {
    expect(cross(UNIT_X, UNIT_Y)).toEqual(UNIT_Z);
    expect(cross(UNIT_Y, UNIT_Z)).toEqual(UNIT_X);
    expect(cross(UNIT_Z, UNIT_X)).toEqual(UNIT_Y);
    expectAllClose(cross(UNIT_Y, UNIT_X), [0, 0, -1]);
  });

  it('cross product is perpendicular to its operands and anti-commutative', () => {
    const axb = cross(a, b);
    expectClose(dot(axb, a), 0);
    expectClose(dot(axb, b), 0);
    expectAllClose(cross(b, a), negate(axb));
    // |a × b|² = |a|²|b|² − (a·b)²（ラグランジュの恒等式）
    expectClose(dot(axb, axb), dot(a, a) * dot(b, b) - dot(a, b) ** 2);
    // a × (b × c) = b(a·c) − c(a·b)
    expectAllClose(cross(a, cross(b, c)), sub(scale(b, dot(a, c)), scale(c, dot(a, b))));
  });

  it('normalize returns a unit vector in the same direction', () => {
    const n = normalize(a);
    expectClose(length(n), 1);
    expectAllClose(scale(n, length(a)), a);
  });

  it('normalize rejects zero and non-finite vectors', () => {
    expect(() => normalize([0, 0, 0])).toThrow(RangeError);
    expect(() => normalize([Number.NaN, 0, 0])).toThrow(RangeError);
    expect(() => normalize([Number.POSITIVE_INFINITY, 0, 0])).toThrow(RangeError);
  });
});
