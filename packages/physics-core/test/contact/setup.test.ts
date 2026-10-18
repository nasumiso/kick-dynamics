// T1.3-06：入力からの接触幾何の構築（buildImpactSetup）。VER-C17。
// 期待値は 05 §6.2 の定義（物体座標の r_A = (s_x, s_y, L_z/2)、+z_b 面の法線 = n、φ の基準）から求め、
// 足の姿勢は回転として（変換したベクトルで）比べる。ε_φ は 05 §10.2 の仮置き（P-26）。
import { describe, expect, it } from 'vitest';
import { buildImpactSetup } from '../../src/contact/setup';
import { pointVelocity } from '../../src/contact/solver';
import type { KickInput } from '../../src/contact/types';
import { rotate } from '../../src/math/quat';
import { addScaled, cross, dot, length, normalize, scale, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';
import { ball, foot } from './fixtures';

const ROLL_REFERENCE_THRESHOLD = 1e-6; // P-26（仮置き）
const geometry = { ball, foot, rollReferenceThreshold: ROLL_REFERENCE_THRESHOLD };
const [, , lz] = foot.shape.dimensions;

const base: KickInput = {
  contactDirection: [-3, 0.6, 0.4], // 長さ 1 でない入力：正規化して使う
  footRollAboutNormal: 0.3,
  footContactLocation: [0.05, -0.02],
  footContactPointVelocity: [18, 5, -2],
  footAngularVelocity: [2, -6, 10],
  footModel: 'finite-mass',
};

function build(input: KickInput) {
  const r = buildImpactSetup(input, geometry);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function projectedUnit(v: Vec3, n: Vec3): Vec3 {
  return normalize(addScaled(v, n, -dot(v, n)));
}

describe('VER-C17 impact geometry from the kick input', () => {
  const s = build(base);
  const d = normalize(base.contactDirection);
  const n = scale(d, -1);

  it('places the contact point on the ball at p = x_B + R d with a unit normal n = −d', () => {
    expectAllClose(s.ball.position, [0, ball.radius, 0]);
    expectAllClose(s.contactNormal, n);
    expectClose(length(s.contactNormal), 1);
    expectAllClose(s.contactPoint, addScaled(s.ball.position, d, ball.radius));
    expect(s.ball.linearVelocity).toEqual([0, 0, 0]);
    expect(s.ball.angularVelocity).toEqual([0, 0, 0]);
  });

  it('aligns the outward normal of the +z_b face with n and places the foot at x_A = p − r_A', () => {
    expectAllClose(rotate(s.foot.orientation, [0, 0, 1]), n);
    const rA = rotate(s.foot.orientation, [base.footContactLocation[0], base.footContactLocation[1], lz / 2]);
    expectAllClose(s.foot.position, sub(s.contactPoint, rA));
  });

  it('sets v_A = v_A^p − ω_A × r_A so that the contact point moves with the input v_A^p', () => {
    const rA = sub(s.contactPoint, s.foot.position);
    expectAllClose(s.foot.linearVelocity, sub(base.footContactPointVelocity, cross(base.footAngularVelocity, rA)));
    expectAllClose(pointVelocity(s.foot, rA), base.footContactPointVelocity);
    expectAllClose(s.foot.angularVelocity, base.footAngularVelocity);
  });

  it('uses the projection of ŷ as y_b for φ = 0 and rotates it about n in the right-handed sense', () => {
    const y0 = projectedUnit([0, 1, 0], n);
    const zero = build({ ...base, footRollAboutNormal: 0 });
    expectAllClose(rotate(zero.foot.orientation, [0, 1, 0]), y0);
    const quarter = build({ ...base, footRollAboutNormal: Math.PI / 2 });
    expectAllClose(rotate(quarter.foot.orientation, [0, 1, 0]), cross(n, y0));
    // 一般の φ：y_b = cos φ y0 + sin φ (n × y0)。
    const yb = rotate(s.foot.orientation, [0, 1, 0]);
    expectClose(dot(yb, y0), Math.cos(base.footRollAboutNormal));
    expectClose(dot(yb, cross(n, y0)), Math.sin(base.footRollAboutNormal));
  });

  it('switches the reference to the projection of x̂ when |ŷ − (ŷ·n)n| ≤ ε_φ, and keeps ŷ just above it', () => {
    // 真下から蹴り上げる：n = +ŷ（d = −ŷ）。ŷ の射影の長さは 0 なので x̂ の射影（= x̂）を使う。
    const below = build({ ...base, contactDirection: [0, -1, 0], footRollAboutNormal: 0, footContactPointVelocity: [0, 10, 0] });
    expectAllClose(rotate(below.foot.orientation, [0, 1, 0]), [1, 0, 0]);
    expectAllClose(rotate(below.foot.orientation, [0, 0, 1]), [0, 1, 0]);
    // 境界の両側：n を ŷ から角度 θ だけ傾けると、ŷ の射影の長さは sin θ。
    const tilted = (theta: number) => {
      const nT: Vec3 = [Math.sin(theta), Math.cos(theta), 0];
      return { nT, setup: build({ ...base, contactDirection: scale(nT, -1), footRollAboutNormal: 0, footContactPointVelocity: scale(nT, 10) }) };
    };
    const above = tilted(1e-3); // sin θ ≈ 1e-3 > ε_φ：ŷ の射影
    expectAllClose(rotate(above.setup.foot.orientation, [0, 1, 0]), projectedUnit([0, 1, 0], above.nT));
    const inside = tilted(1e-7); // sin θ ≈ 1e-7 ≤ ε_φ：x̂ の射影
    expectAllClose(rotate(inside.setup.foot.orientation, [0, 1, 0]), projectedUnit([1, 0, 0], inside.nT));
  });

  it('returns errors for every invalid input of 05 §6.2', () => {
    const cases: Array<[KickInput, string]> = [
      [{ ...base, contactDirection: [Number.NaN, 0, 0] }, 'invalid-input'],
      [{ ...base, footRollAboutNormal: Number.POSITIVE_INFINITY }, 'invalid-input'],
      [{ ...base, footAngularVelocity: [0, Number.NaN, 0] }, 'invalid-input'],
      [{ ...base, contactDirection: [0, 0, 0] }, 'invalid-input'],
      [{ ...base, footContactLocation: [foot.shape.dimensions[0] / 2, 0] }, 'invalid-input'],
      [{ ...base, footContactLocation: [0, -foot.shape.dimensions[1] / 2] }, 'invalid-input'],
      [{ ...base, footContactPointVelocity: [-18, 5, -2] }, 'separating-input'],
      [{ ...base, footContactPointVelocity: [0, 0, 0] }, 'separating-input'],
      [{ ...base, contactDirection: [-1, 0, 0], footContactPointVelocity: [0, 5, -3] }, 'separating-input'], // 接線方向だけ（v_A^p · n = 0）
    ];
    for (const [input, code] of cases) {
      const r = buildImpactSetup(input, geometry);
      expect(!r.ok && r.error.code).toBe(code);
    }
  });
});

describe('VER-C17 normalization of extreme directions (IV-02-C I02-D01)', () => {
  // 有限で長さが 0 でない d は、成分の大きさによらず同じ向きとして扱う（05 §6.2）。
  for (const [label, scaleFactor] of [['near the largest double', Number.MAX_VALUE], ['subnormal', Number.MIN_VALUE]] as const) {
    it(`returns the unit normal for d = s (−1, −1, 0) with s ${label}`, () => {
      const s = build({ ...base, contactDirection: [-scaleFactor, -scaleFactor, 0], footContactPointVelocity: [1, 1, 0] });
      expectAllClose(s.contactNormal, [Math.SQRT1_2, Math.SQRT1_2, 0]);
      expectClose(length(sub(s.contactPoint, s.ball.position)), ball.radius);
    });
  }
});

describe('VER-C17 accuracy just above the ε_φ switch (IV-02-C I02-H01)', () => {
  // 基準軸 ŷ − (ŷ·n) n は n ≈ ŷ で打ち消し合い、長さ ℓ = |ŷ − (ŷ·n) n| で割るため、姿勢の誤差は
  // 機械イプシロン / ℓ 程度に増える（06 §4.3 VER-C17 の許容誤差の注記）。ℓ = sin θ。
  for (const theta of [1.001e-6, 1.01e-6, 2e-6, 1e-5]) {
    it(`keeps the pose within the conditioned bound ~ ε_mach/ℓ (θ = ${theta})`, () => {
      const nT: Vec3 = [Math.sin(theta), Math.cos(theta), 0];
      const s = build({ ...base, contactDirection: scale(nT, -1), footRollAboutNormal: 0, footContactPointVelocity: scale(nT, 10) });
      const bound = { relative: 0, absolute: (64 * Number.EPSILON) / Math.sin(theta) };
      expectAllClose(rotate(s.foot.orientation, [0, 0, 1]), nT, bound);
      expectAllClose(rotate(s.foot.orientation, [0, 1, 0]), [-Math.cos(theta), Math.sin(theta), 0], bound);
    });
  }
});

describe('roll reference threshold validation (PR #7 review)', () => {
  it('rejects ε_φ outside 0 ≤ ε_φ < 1 as invalid-parameter instead of throwing', () => {
    const alongX: KickInput = { ...base, contactDirection: [-1, 0, 0], footContactPointVelocity: [10, 0, 0] };
    const alongY: KickInput = { ...base, contactDirection: [0, -1, 0], footContactPointVelocity: [0, 10, 0] };
    for (const [input, threshold] of [[alongX, 1], [alongX, 2], [alongY, -1e-6], [alongX, Number.NaN], [alongX, Number.POSITIVE_INFINITY]] as const) {
      const r = buildImpactSetup(input, { ...geometry, rollReferenceThreshold: threshold });
      expect(!r.ok && r.error.code).toBe('invalid-parameter');
    }
  });

  it('accepts the ends of the valid range on the poles', () => {
    // ε_φ = 0：n = +ŷ ちょうどなら ŷ の射影は 0 ≤ 0 なので x̂ の射影を使う。ε_φ → 1 でも n = +x̂ では ŷ の射影（長さ 1 > ε_φ）を使う。
    const alongY: KickInput = { ...base, contactDirection: [0, -1, 0], footContactPointVelocity: [0, 10, 0] };
    const alongX: KickInput = { ...base, contactDirection: [-1, 0, 0], footContactPointVelocity: [10, 0, 0] };
    expect(buildImpactSetup(alongY, { ...geometry, rollReferenceThreshold: 0 }).ok).toBe(true);
    expect(buildImpactSetup(alongX, { ...geometry, rollReferenceThreshold: 0.999999 }).ok).toBe(true);
  });
});
