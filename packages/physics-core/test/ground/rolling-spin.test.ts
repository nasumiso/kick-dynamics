// T1.5-14：接地面のねじり摩擦（05 §8.2、2026-11-14 に追加）。VER-G12 と VER-G04 の追加分。
// 係数はテスト用の値（μ_g・ℓ_s は 05 §10.2 の仮置きと同じ水準だが、採用値の確認ではない）。
// 期待値は 05 §8.2 の閉形式 ω_y(t) = sign(ω_y0) max(|ω_y0| − α_s t, 0)、α_s = μ_g g ℓ_s/(κ R²) から求める。
// 停止イベントで途中で終わらないよう、(1)(2) は接地の処理の 1 ステップ（advanceRolling）を直接繰り返す（06 の S-08）。
import { describe, expect, it } from 'vitest';
import type { RigidBodyState } from '../../src/bodies/types';
import { simulateFlight } from '../../src/flight/trajectory';
import type { FlightSimulationSettings } from '../../src/flight/types';
import { groundHandler, type GroundParameters } from '../../src/ground/bounce';
import { advanceRolling, rollingContactVelocity } from '../../src/ground/rolling';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { length, type Vec3 } from '../../src/math/vec3';
import { allOff, ball, environment, thresholds } from '../flight/fixtures';

const g = environment.gravity;
const R = ball.radius;
const kappa = ball.inertiaCoefficient;
const drag = { coefficient: { kind: 'constant', value: 0.2 }, airDensity: environment.airDensity, airViscosity: environment.airViscosity } as const;
const params: GroundParameters = {
  gravity: g, restitution: 0.6, friction: 0.6, tangentialSpeedThreshold: 1e-9, diagnosticRelativeTolerance: 1e-9,
  rollingResistance: 0.15, restSpeed: 0.3, stopSpeed: 0.05, stopSpin: 0.5, zeroSpeed: thresholds.zeroSpeed, drag,
  spinFrictionLength: 0.01,
};
const noSpinFriction: GroundParameters = { ...params, spinFrictionLength: 0 };
/** α_s = μ_g g ℓ_s/(κ R²)（05 §8.2） */
const alpha = (params.friction * g * params.spinFrictionLength) / (kappa * R * R);

function onGround(v: Vec3, w: Vec3): RigidBodyState {
  return { position: [0, R, 0], orientation: IDENTITY_QUAT, linearVelocity: v, angularVelocity: w };
}

function steps(start: RigidBodyState, p: GroundParameters, h: number, n: number): RigidBodyState[] {
  const states = [start];
  for (let i = 0; i < n; i++) {
    const r = advanceRolling(states[i]!, ball, p, h);
    if (!r.ok) throw new Error(r.error.message);
    states.push(r.value);
  }
  return states;
}

type Mode = 'rest' | 'rolling' | 'sliding';
function modeOf(s: RigidBodyState): Mode {
  const [vx, , vz] = s.linearVelocity;
  const [wx, , wz] = s.angularVelocity;
  if (vx === 0 && vz === 0 && wx === 0 && wz === 0) return 'rest';
  return length(rollingContactVelocity(s, R)) <= 1e-9 * (1 + length(s.linearVelocity)) ? 'rolling' : 'sliding';
}

const horizontal = (s: RigidBodyState): number[] =>
  [s.position[0], s.position[1], s.position[2], s.linearVelocity[0], s.linearVelocity[2], s.angularVelocity[0], s.angularVelocity[2]];

describe('VER-G12 torsional friction', () => {
  const h = 0.005;
  // 純転がりから入って静止まで（ω_y は静止の後に 0 になる）、滑りから入る場合、静止から入る場合。
  const cases: Array<[string, RigidBodyState, Mode]> = [
    ['pure rolling', onGround([3, 0, 0], [0, 40, -3 / R]), 'rolling'],
    ['sliding (no spin about the horizontal axes)', onGround([3, 0, 0], [0, -40, 0]), 'sliding'],
    ['rest', onGround([0, 0, 0], [0, 25, 0]), 'rest'],
  ];

  for (const [name, start, mode] of cases) {
    it(`decays ω_y at the constant rate α_s and holds it at exactly 0 (${name})`, () => {
      expect(modeOf(start)).toBe(mode);
      const w0 = start.angularVelocity[1];
      const zeroTime = Math.abs(w0) / alpha;
      const n = Math.ceil(zeroTime / h) + 200;
      const states = steps(start, params, h, n);
      for (let i = 0; i <= n; i++) {
        const t = i * h;
        const exact = Math.sign(w0) * Math.max(Math.abs(w0) - alpha * t, 0);
        const wy = states[i]!.angularVelocity[1];
        if (exact === 0) {
          // 0 に達した後は厳密に 0（max(…, 0) のため。符号は反転しない）
          expect(wy).toBe(0);
        } else {
          // 逐次の引き算の丸め誤差の上界 c n ε |ω_y0|（c = 4 は仮置き、06 VER-G12 の T-06）。0 に達する直前の格子も同じ判定
          // （IV-05-C4 の C14 を受けて、直前の 1 点を符号だけで確かめていたのを改めた）。
          expect(Math.abs(wy - exact)).toBeLessThanOrEqual(4 * Math.max(i, 1) * Number.EPSILON * Math.abs(w0));
        }
      }
      // 終わりまでに 0 に達している
      expect(states.at(-1)!.angularVelocity[1]).toBe(0);
    });
  }

  it('does not change the horizontal state or the mode sequence when C_D is constant (ℓ_s > 0 vs ℓ_s = 0)', () => {
    // 滑り → 純転がり → 静止 を通る構成
    const start = onGround([6, 0, 1], [2, 35, 0]);
    const n = 1500;
    const withFriction = steps(start, params, h, n);
    const without = steps(start, noSpinFriction, h, n);
    const modes = new Set(withFriction.map(modeOf));
    expect([...modes].sort()).toEqual(['rest', 'rolling', 'sliding']);
    for (let i = 0; i <= n; i++) {
      expect(horizontal(withFriction[i]!)).toEqual(horizontal(without[i]!));
      expect(modeOf(withFriction[i]!)).toBe(modeOf(without[i]!));
    }
    // ω_y だけが違う
    expect(withFriction.at(-1)!.angularVelocity[1]).toBe(0);
    expect(without.at(-1)!.angularVelocity[1]).toBe(35);
  });
});

describe('VER-G12 (3) / VER-G04: a curving ball ends with stop when ℓ_s > 0 and max-time when ℓ_s = 0', () => {
  // 構成と期待値は IV-05-D4 の導出資料 §6（verification/independent/IV-05/derivation-spin-friction.md）による（IV-05-C4 の C16 を受けて、
  // マグヌス力 OFF の直線の弾道から、マグヌス力で曲がる弾道に改めた）。
  // R = 0.69/(2π)（P-02）、抗力 OFF、マグヌス力 ON（P-13 の折れ線。飛翔中は S > 0.25 で C_L = 0.3）、回転減衰 OFF、e_g = 0、最大時間 12 s。
  const curveBall = { ...ball, radius: 0.69 / (2 * Math.PI) };
  const settings: FlightSimulationSettings = {
    timeStep: 0.005, maxTime: 12, eventTimeTolerance: 1e-9, thresholds,
    forces: { ...allOff, gravity: true, magnus: { enabled: true, coefficient: { kind: 'spin-table', points: [[0, 0], [0.25, 0.3], [1, 0.3]] } } },
  };
  const ground: GroundParameters = { ...params, restitution: 0, restSpeed: 0.1, drag: null };
  const launch: RigidBodyState = {
    position: [0, curveBall.radius + 1, 0], orientation: IDENTITY_QUAT, linearVelocity: [5, 0, 0], angularVelocity: [0, 50, 0],
  };

  function run(p: GroundParameters) {
    const handler = groundHandler(curveBall, p);
    if (!handler.ok) throw new Error(handler.error.message);
    const r = simulateFlight(launch, curveBall, environment, settings, handler.value);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  }

  it('curves in the air (+x toward −z) before rolling', () => {
    const t = run(ground);
    const contact = t.events.find((e) => e.type === 'ground-contact')!;
    // 接地の位置の参考値 (x, z) ≈ (2.2573, −0.0467) m（導出資料 §6。RK4・求根の誤差を含む参考値なので、向きと大きさの水準だけを確かめる）
    const z = t.position[3 * contact.sampleIndex + 2]!;
    expect(z).toBeLessThan(-0.04);
    expect(z).toBeGreaterThan(-0.05);
  });

  it('stops at t = 7.220 s once ω_y has decayed (ℓ_s > 0)', () => {
    const t = run(ground);
    const last = t.events.at(-1)!;
    expect(last.type).toBe('stop');
    expect(t.time[last.sampleIndex]).toBeCloseTo(7.22, 9); // 番号 1444 の格子（導出資料 §6）
    expect(Math.abs(t.angularVelocity[3 * last.sampleIndex + 1]!)).toBeLessThan(ground.stopSpin);
  });

  it('runs to max-time at 12 s while |ω_y| ≥ ω_stop remains (ℓ_s = 0)', () => {
    const t = run({ ...ground, spinFrictionLength: 0 });
    const last = t.events.at(-1)!;
    expect(last.type).toBe('max-time');
    expect(t.time[last.sampleIndex]).toBeCloseTo(12, 9);
  });
});

describe('ℓ_s validation', () => {
  for (const value of [-0.01, Number.NaN, Infinity]) {
    it(`rejects ℓ_s = ${value}`, () => {
      const r = groundHandler(ball, { ...params, spinFrictionLength: value });
      expect(!r.ok && r.error.code).toBe('invalid-parameter');
    });
  }
});
