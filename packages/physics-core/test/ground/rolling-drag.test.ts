// T1.5-12：転がりの間の抗力と、滑りの間の転がり抵抗（05 §8.2、2026-11-14 の改定）。VER-G07〜G11 と VER-G04 の追加分。
// 係数はテスト用の値（ρ・C_D・μ_g・μ_r は 05 §10.2 の仮置きと同じ水準だが、採用値の確認ではない）。
// 期待値は実装の式を写さず、05 §8.2 の閉形式、接触点まわりの角運動量、移行の式（手順 3）から求める。
// 停止イベントで途中で終わらないよう、接地の処理の 1 ステップ（advanceRolling）を直接繰り返す（06 の VER-G07〜G11 の構成、S-08）。
import { describe, expect, it } from 'vitest';
import { ballInertia, kineticEnergy } from '../../src/bodies/dynamics';
import type { RigidBodyState } from '../../src/bodies/types';
import { simulateFlight } from '../../src/flight/trajectory';
import type { FlightSimulationSettings } from '../../src/flight/types';
import { groundHandler, type GroundParameters } from '../../src/ground/bounce';
import { advanceRolling, rollingContactVelocity } from '../../src/ground/rolling';
import { IDENTITY_QUAT } from '../../src/math/quat';
import { add, cross, dot, length, scale, sub, type Vec3 } from '../../src/math/vec3';
import { expectAllClose, expectClose } from '../tolerance';
import { allOff, ball, environment, thresholds } from '../flight/fixtures';

const g = environment.gravity;
const R = ball.radius;
const m = ball.mass;
const kappa = ball.inertiaCoefficient;
const UP: Vec3 = [0, 1, 0];
const cd = 0.2;
/** 抗力の加速度の係数 k = ρ A C_D / (2m)（05 §8.2） */
const k = (environment.airDensity * Math.PI * R * R * cd) / (2 * m);

const drag = { coefficient: { kind: 'constant', value: cd }, airDensity: environment.airDensity, airViscosity: environment.airViscosity } as const;
const params: GroundParameters = {
  gravity: g, restitution: 0.6, friction: 0.6, tangentialSpeedThreshold: 1e-9, diagnosticRelativeTolerance: 1e-9,
  rollingResistance: 0.15, restSpeed: 0.3, stopSpeed: 0.01, stopSpin: 0.1, zeroSpeed: thresholds.zeroSpeed, drag,
};

function onGround(v: Vec3, w: Vec3): RigidBodyState {
  return { position: [0, R, 0], orientation: IDENTITY_QUAT, linearVelocity: v, angularVelocity: w };
}

function rollingSpin(v: Vec3): Vec3 {
  return scale(cross(UP, v), 1 / R);
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

const isRest = (s: RigidBodyState): boolean => s.linearVelocity[0] === 0 && s.linearVelocity[2] === 0;
const isRolling = (s: RigidBodyState): boolean => length(rollingContactVelocity(s, R)) <= 1e-9 * (1 + length(s.linearVelocity));

/** 純転がりの閉形式（05 §8.2）：a = μ_r g/(1+κ)、c = k/(1+κ)。速さ v(t) と距離 s(t)。 */
function rollingClosedForm(v0: number, muR: number, kk: number): { speed: (t: number) => number; distance: (t: number) => number; zeroTime: number } {
  const a = (muR * g) / (1 + kappa);
  const c = kk / (1 + kappa);
  if (a > 0 && c > 0) {
    const theta0 = Math.atan(v0 * Math.sqrt(c / a));
    const w = Math.sqrt(a * c);
    return {
      speed: (t) => Math.sqrt(a / c) * Math.tan(theta0 - w * t),
      distance: (t) => Math.log(Math.cos(theta0 - w * t) / Math.cos(theta0)) / c,
      zeroTime: theta0 / w,
    };
  }
  if (a === 0 && c > 0) {
    return { speed: (t) => v0 / (1 + c * v0 * t), distance: (t) => Math.log(1 + c * v0 * t) / c, zeroTime: Infinity };
  }
  return { speed: (t) => v0 - a * t, distance: (t) => v0 * t - 0.5 * a * t * t, zeroTime: v0 / a };
}

describe('VER-G07 pure rolling with drag (closed form)', () => {
  const direction: Vec3 = [Math.cos(0.3), 0, Math.sin(0.3)];

  for (const [name, muR] of [['μ_r > 0', 0.15], ['μ_r = 0', 0]] as const) {
    it(`matches the closed form with fourth-order convergence (${name})`, () => {
      const v0 = 30;
      const p = { ...params, rollingResistance: muR };
      const exact = rollingClosedForm(v0, muR, k);
      const start = onGround(scale(direction, v0), rollingSpin(scale(direction, v0)));
      const horizon = 2;
      // 維持条件を満たす初速であることの確認（κ (μ_r g + k v²)/(1+κ) ≤ μ_g g）
      expect((kappa * (muR * g + k * v0 * v0)) / (1 + kappa)).toBeLessThanOrEqual(params.friction * g);
      const errors = [0.1, 0.05].map((h) => {
        const n = Math.round(horizon / h);
        const end = steps(start, p, h, n).at(-1)!;
        expect(isRolling(end)).toBe(true);
        return Math.abs(length(end.linearVelocity) - exact.speed(horizon)) + Math.abs(dot(sub(end.position, start.position), direction) - exact.distance(horizon));
      });
      const order = Math.log2(errors[0]! / errors[1]!);
      expect(Math.abs(order - 4)).toBeLessThanOrEqual(0.5); // TOL-B（仮置き）
    });
  }

  it('keeps the rolling constraint and the direction, and rests no later than the step containing the zero-speed time', () => {
    const v0 = 12;
    const h = 0.005;
    const exact = rollingClosedForm(v0, params.rollingResistance, k);
    const start = onGround(scale(direction, v0), rollingSpin(scale(direction, v0)));
    const last = Math.ceil(exact.zeroTime / h);
    const states = steps(start, params, h, last + 10);
    const restIndex = states.findIndex(isRest);
    expect(restIndex).toBeGreaterThan(0);
    expect(restIndex).toBeLessThanOrEqual(last);
    for (const s of states.slice(0, restIndex)) {
      expect(isRolling(s)).toBe(true);
      expectClose(dot(s.linearVelocity, direction), length(s.linearVelocity)); // 向きは変わらない
    }
    // 静止の前の各格子時刻（v > ε_v）で閉形式と一致する（RK4 の誤差の範囲。Δt = 0.005 s では 1e-9 m/s 未満）
    for (let i = 0; i < restIndex; i += 50) {
      expectClose(length(states[i]!.linearVelocity), exact.speed(i * h), { relative: 1e-9, absolute: 1e-9 });
    }
  });
});

describe('VER-G08 sliding with rolling resistance (and drag)', () => {
  const noDrag: GroundParameters = { ...params, drag: null };
  const v0 = 8;

  for (const [name, spin, sign] of [
    ['forward slip (û = v̂, no spin)', 0, 1],
    ['backward slip (û = −v̂, overspin)', (-3 * v0) / R, -1],
  ] as const) {
    it(`follows the constant-rate closed form and switches in the step containing the slip-vanishing time (${name})`, () => {
      const h = 0.005;
      const start = onGround([v0, 0, 0], [0, 0, spin]);
      const u0 = v0 + R * spin; // u_x = v_x + R ω_z
      expect(Math.sign(u0)).toBe(sign);
      // û = sign x̂：dv/dt = −(sign μ_g + μ_r) g x̂、dω_z/dt = −sign μ_g g/(κ R)、|u| は r = μ_g g(1+1/κ) + sign μ_r g で減る
      const accel = -(sign * params.friction + params.rollingResistance) * g;
      const alpha = (-sign * params.friction * g) / (kappa * R);
      const rate = params.friction * g * (1 + 1 / kappa) + sign * params.rollingResistance * g;
      const slipTime = Math.abs(u0) / rate;
      const switchStep = Math.ceil(slipTime / h);
      const states = steps(start, noDrag, h, switchStep + 5);
      // (1) 移行の前の各格子時刻は閉形式（加速度が一定なので RK4 は丸め誤差だけ）
      for (let i = 0; i < switchStep; i++) {
        const t = i * h;
        expectAllClose(states[i]!.linearVelocity, [v0 + accel * t, 0, 0]);
        expectAllClose(states[i]!.angularVelocity, [0, 0, spin + alpha * t]);
        expectAllClose(states[i]!.position, [v0 * t + 0.5 * accel * t * t, R, 0]);
        expect(isRolling(states[i]!)).toBe(false);
      }
      // (2) 移行のステップは、滑りが消える時刻を含むステップ
      expect(isRolling(states[switchStep]!)).toBe(true);
      // (3) 移行のステップの終わりの速度：05 §8.2 の手順 3 の式（u* = u_k + (F_e/m)Δt、P/m = −u*/(1 + 1/κ)）
      const before = states[switchStep - 1]!;
      const vk = before.linearVelocity[0];
      const uk = vk + R * before.angularVelocity[2];
      const fe = -params.rollingResistance * g; // v_x > 0 なので転がり抵抗は −x̂
      const trial = uk + fe * h;
      const vNext = vk + fe * h - trial / (1 + 1 / kappa);
      expectAllClose(states[switchStep]!.linearVelocity, [vNext, 0, 0]);
      expectAllClose(states[switchStep]!.angularVelocity, [0, 0, -vNext / R]);
    });
  }

  it('changes the angular momentum about the contact point by the moment of the rolling-resistance and drag impulses (drag ON)', () => {
    // 接触点 P まわり：dL_P/dt = (R ŷ) × F_e（摩擦は P に働き、P は重心と同じ水平速度で動くので v_P × m v = 0）。
    const h = 1e-4;
    const start = onGround([20, 0, 3], [4, 0, -150]); // u = (3.5, 0, 2.56) m/s は v と平行でない（滑りの向きが回る）
    const states = steps(start, params, h, 6000);
    const end = states.findIndex(isRolling) - 1; // 滑りの区間だけで比べる
    expect(end).toBeGreaterThan(100);
    const inertia = kappa * m * R * R;
    const angularMomentum = (s: RigidBodyState): Vec3 => add(scale(s.angularVelocity, inertia), scale(cross([0, R, 0], s.linearVelocity), m));
    const externalForce = (s: RigidBodyState): Vec3 => {
      const v = s.linearVelocity;
      const speed = length(v);
      return scale(v, -m * (params.rollingResistance * g / speed + k * speed));
    };
    let impulse: Vec3 = [0, 0, 0];
    for (let i = 0; i < end; i++) impulse = add(impulse, scale(add(externalForce(states[i]!), externalForce(states[i + 1]!)), h / 2));
    const expected = add(angularMomentum(start), cross([0, R, 0], impulse));
    expectAllClose(angularMomentum(states[end]!), expected, { relative: 1e-6, absolute: 1e-9 }); // 台形則の誤差 O(Δt²)
  });
});

describe('VER-G09 boundary between pure rolling and sliding', () => {
  it('slides with û = −v̂ above the boundary speed and returns to rolling once, without chattering', () => {
    const boundary = Math.sqrt(((params.friction * g * (1 + kappa)) / kappa - params.rollingResistance * g) / k);
    const v0 = 40;
    expect(v0).toBeGreaterThan(boundary);
    const start = onGround([v0, 0, 0], rollingSpin([v0, 0, 0]));
    const states = steps(start, params, 0.005, 2000);
    const modes = states.map((s) => (isRest(s) ? 'rest' : isRolling(s) ? 'rolling' : 'sliding'));
    const runs = modes.filter((mode, i) => i === 0 || mode !== modes[i - 1]);
    expect(runs.slice(0, 3)).toEqual(['rolling', 'sliding', 'rolling']);
    expect(runs.filter((mode) => mode === 'sliding')).toHaveLength(1);
    for (let i = 1; i < states.length && modes[i] === 'sliding'; i++) {
      const u = rollingContactVelocity(states[i]!, R);
      expect(u[0]).toBeLessThan(0); // û = −v̂（v は +x）
      expect(u[2]).toBe(0);
    }
    const back = modes.indexOf('rolling', 1);
    expect(length(states[back]!.linearVelocity)).toBeLessThanOrEqual(boundary);
  });

  it('leaves pure rolling in a rotated direction as the x-axis case rotated (rounding residual of u, IV-05-C3 mismatch A)', () => {
    // 球・無風・等方な摩擦・定数 C_D なので、水平の回転について対称。x 軸方向の 1 ステップを 0.1 rad 回した結果と一致するはず。
    // 回した方向の拘束は丸め誤差の分だけ u ≠ 0 を残すが、その残りを滑りの向きにしてはいけない（離脱の向きは −v̂）。
    const v0 = 40;
    const angle = 0.1;
    const rotate = (a: Vec3): Vec3 => [a[0] * Math.cos(angle) - a[2] * Math.sin(angle), a[1], a[0] * Math.sin(angle) + a[2] * Math.cos(angle)];
    const axial = steps(onGround([v0, 0, 0], rollingSpin([v0, 0, 0])), params, 0.005, 1).at(-1)!;
    const direction: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
    const rotated = steps(onGround(scale(direction, v0), rollingSpin(scale(direction, v0))), params, 0.005, 1).at(-1)!;
    const tol = { relative: 1e-12, absolute: 1e-12 };
    expectAllClose(rotated.linearVelocity, rotate(axial.linearVelocity), tol);
    expectAllClose(rollingContactVelocity(rotated, R), rotate(rollingContactVelocity(axial, R)), tol);
  });
});

describe('VER-G10 drag ON/OFF consistency in pure rolling', () => {
  it('matches VER-G05 with drag OFF and never has more kinetic energy with drag ON', () => {
    const h = 0.005;
    const v0: Vec3 = [6, 0, -2];
    const start = onGround(v0, rollingSpin(v0));
    const off = steps(start, { ...params, drag: null }, h, 400);
    const on = steps(start, params, h, 400);
    const a = (params.rollingResistance * g) / (1 + kappa);
    const energy = (s: RigidBodyState): number => kineticEnergy({ mass: m, inertiaWorld: ballInertia(ball) }, s);
    off.forEach((s, i) => {
      if (isRest(s)) return;
      expectAllClose(s.linearVelocity, scale(v0, 1 - (a * i * h) / length(v0)));
    });
    on.forEach((s, i) => expect(energy(s)).toBeLessThanOrEqual(energy(off[i]!)));
  });
});

describe('VER-G11 accuracy of the switch to rolling', () => {
  it('switches within one step after the slip-vanishing time, and matches the velocity at a common later time (Δt, Δt/2, Δt/4)', () => {
    const v0 = 8;
    const start = onGround([v0, 0, 0], [0, 0, 0]);
    const rate = params.friction * g * (1 + 1 / kappa) + params.rollingResistance * g;
    const slipTime = v0 / rate;
    // 共通の時刻 T = 1 s の速度：接触点まわりの角運動量 L_P = (κ+1) m R v（純転がり）の変化は、重心に働く一定の転がり抵抗の
    // 力積のモーメントだけなので、v(T) = (v₀ − μ_r g T)/(1 + κ)（IV-05-C3 の不一致 B を受けて、記録を常設のテストに入れた）。
    const T = 1;
    const expected = (v0 - params.rollingResistance * g * T) / (1 + kappa);
    for (const h of [0.005, 0.0025, 0.00125]) {
      const states = steps(start, { ...params, drag: null }, h, Math.round(T / h));
      const switchTime = states.findIndex(isRolling) * h;
      expect(switchTime - slipTime).toBeGreaterThanOrEqual(0);
      expect(switchTime - slipTime).toBeLessThan(h);
      // 2026-11-14 の記録では誤差は 1e-13 程度（丸め誤差の水準）。
      expectClose(states.at(-1)!.linearVelocity[0], expected, { relative: 1e-12, absolute: 1e-12 });
    }
  });
});

describe('VER-G04 with drag: μ_r = 0 still reaches the stop thresholds', () => {
  it('ends with a stop event (not max-time) when drag is ON', () => {
    const settings: FlightSimulationSettings = {
      timeStep: 0.005, maxTime: 600, eventTimeTolerance: 1e-9, forces: { ...allOff, gravity: true }, thresholds,
    };
    const h = groundHandler(ball, { ...params, rollingResistance: 0, stopSpeed: 0.5, stopSpin: 5 });
    if (!h.ok) throw new Error(h.error.message);
    const t = simulateFlight(onGround([5, 0, 0], rollingSpin([5, 0, 0])), ball, environment, settings, h.value);
    if (!t.ok) throw new Error(t.error.message);
    expect(t.value.events.at(-1)!.type).toBe('stop');
  });
});
