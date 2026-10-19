// キック 1 回分の一括計算（docs/04-architecture.md §5・§6 の simulateKick、tasks T1.5-01）。
//
// ParameterSet の値から各段階のパラメータを組み立て、入力・物性値・設定を入口でまとめて検証してから、
// buildImpactSetup → solveImpact → simulateFlight → computeMetrics の順に呼ぶ。
// - 時刻 0 が衝突の瞬間で、軌道のサンプル 0 は衝突直後のボールの状態（solveImpact の ballAfter）。
// - 空力係数は ParameterSet の値（P-12・P-22 は定数、P-13 は定数か S の折れ線、05 §7.4）を使う。関数の係数は、
//   境界にコールバックを置かない方針（04 §9）のため、この API では扱わない（段階 API の simulateFlight では使える）。
// - Core は既定値を持たない。計算に使うパラメータの値が未決定（null）なら、その ID をまとめて invalid-parameter で返す。
import type { BallParams, FootParams } from '../bodies/types';
import { buildImpactSetup } from '../contact/setup';
import { solveImpact } from '../contact/solver';
import type { ImpactResult, ImpactWarning, KickInput } from '../contact/types';
import { simulateFlight, type Trajectory } from '../flight/trajectory';
import type { FlightEnvironment, FlightForceSettings, FlightSimulationSettings, GroundContactHandler } from '../flight/types';
import { spinTableError } from '../flight/forces';
import { terminateOnGroundContact } from '../flight/ground-events';
import { groundHandler } from '../ground/bounce';
import { length, type Vec3 } from '../math/vec3';
import { computeFlightMetrics, type FlightMetrics } from '../metrics/flight-metrics';
import type { ParameterEntry, ParameterId, ParameterSet } from '../params/parameter-set';
import { fail, ok, type SimErrorCode, type SimResult } from '../result';
import { ACCEPTED_RANGES, describeRange, inRange, type AcceptedRange } from './ranges';

export const MODEL_VERSION = '0.0.0';

/** 回転減衰のモデルの選択（05 §7.5）。'linear' は P-14、'torque-coefficient' は P-22 の定数を使う。 */
export type SpinDecaySelection = 'none' | 'linear' | 'torque-coefficient';

/**
 * 接地の扱い。
 * - stop-at-first-contact：最初の接地で終了する（地面の係数を使わない）。
 * - bounce-and-roll：バウンド・転がり・停止（05 §8、P-15〜P-17・P-19 を使う）。
 * 地面の係数が未決定の間も計算できるよう、設定で切り替える（決定、2026-10-19）。
 */
export type GroundMode = 'stop-at-first-contact' | 'bounce-and-roll';

/** 計算の設定（04 §6）。Δt は ParameterSet の P-18 を使う。 */
export interface SimulationSettings {
  /** 最大シミュレーション時間 s */
  readonly maxTime: number;
  /** δ_t：接地時刻を求める二分法の打ち切り幅 s（05 §7.7） */
  readonly eventTimeTolerance: number;
  /** 各力項の ON/OFF（AC-11） */
  readonly forces: {
    readonly gravity: boolean;
    readonly drag: boolean;
    readonly magnus: boolean;
    readonly spinDecay: SpinDecaySelection;
  };
  readonly ground: GroundMode;
}

/** 測定値（05 §9）。 */
export type KickMetrics = FlightMetrics;

/** 結果に添える警告。補正はせず、結果とともに返す。 */
export interface KickWarning {
  readonly stage: 'impact';
  readonly code: ImpactWarning;
}

export interface KickSimulationResult {
  readonly modelVersion: string;
  readonly input: KickInput;
  /** 値とメタデータ（単位・出典・確からしさ）をそのまま含める（05 §10） */
  readonly parameters: ParameterSet;
  readonly settings: SimulationSettings;
  readonly impact: ImpactResult;
  readonly trajectory: Trajectory;
  readonly metrics: KickMetrics;
  readonly warnings: readonly KickWarning[];
}

/** 計算に使うパラメータ（入力と設定によって変わる）。 */
function requiredEntries(parameters: ParameterSet, settings: SimulationSettings): ParameterEntry<unknown>[] {
  const p = parameters;
  const entries: ParameterEntry<unknown>[] = [
    p.ballMass, p.ballRadius, p.ballInertiaCoefficient,
    // 有限質量の足でなくても、接触幾何（足の配置）に P-04〜P-06 を使う。
    p.footMass, p.footInertiaBody, p.footDimensions,
    p.restitution, p.friction, p.gravity, p.timeStep, p.wind,
    p.magnusThreshold, p.zeroSpeedThreshold, p.zeroSpinThreshold,
    p.tangentialSpeedThreshold, p.rollReferenceThreshold, p.verticalLaunchThreshold,
  ];
  const f = settings.forces;
  if (f.drag || f.magnus || f.spinDecay === 'torque-coefficient') entries.push(p.airDensity);
  if (f.drag) entries.push(p.dragCoefficient);
  if (f.magnus) entries.push(p.liftCoefficient);
  if (f.spinDecay === 'linear') entries.push(p.spinDecayLinear);
  if (f.spinDecay === 'torque-coefficient') entries.push(p.torqueCoefficient);
  if (settings.ground === 'bounce-and-roll') entries.push(p.groundRestitution, p.groundFriction, p.rollingResistance, p.restThresholds);
  return entries;
}

/** 値が決まっている（null でない）ことを型で表す。requiredEntries で確認した後に使う。 */
function v<T>(entry: ParameterEntry<T>): T {
  if (entry.value === null) throw new Error(`parameter ${entry.id} is undetermined`); // requiredEntries の確認漏れ（プログラムの誤り）
  return entry.value;
}

interface RangeCheck {
  readonly name: string;
  readonly value: number;
  readonly range: AcceptedRange;
  readonly code: SimErrorCode;
  readonly id?: ParameterId;
}

function checkRanges(checks: readonly RangeCheck[]): SimResult<void> {
  for (const c of checks) {
    if (!inRange(c.value, c.range)) {
      const where = c.id ? ` (${c.id})` : '';
      return fail(c.code, `${c.name}${where} must be in ${describeRange(c.range)} (${c.value})`, { accepted: c.range });
    }
  }
  return ok(undefined);
}

/** 05 §10.3 の範囲（仮置き）の検証。 */
function validateRanges(input: KickInput, parameters: ParameterSet, settings: SimulationSettings): SimResult<void> {
  const r = ACCEPTED_RANGES;
  const p = parameters;
  const dims: Vec3 = v(p.footDimensions);
  const dt = v(p.timeStep);
  const checks: RangeCheck[] = [
    { name: 'foot contact point speed |v_A^p|', value: length(input.footContactPointVelocity), range: r.footContactPointSpeed, code: 'invalid-input' },
    { name: 'foot angular speed |ω_A|', value: length(input.footAngularVelocity), range: r.footAngularSpeed, code: 'invalid-input' },
    { name: 'ball mass', value: v(p.ballMass), range: r.ballMass, code: 'invalid-parameter', id: 'P-01' },
    { name: 'ball radius', value: v(p.ballRadius), range: r.ballRadius, code: 'invalid-parameter', id: 'P-02' },
    { name: 'ball inertia coefficient κ', value: v(p.ballInertiaCoefficient), range: r.ballInertiaCoefficient, code: 'invalid-parameter', id: 'P-03' },
    { name: 'foot mass', value: v(p.footMass), range: r.footMass, code: 'invalid-parameter', id: 'P-04' },
    ...dims.map((value, i): RangeCheck => ({ name: `foot dimension L_${'xyz'[i]}`, value, range: r.footDimension, code: 'invalid-parameter', id: 'P-06' })),
    { name: 'restitution e', value: v(p.restitution), range: r.restitution, code: 'invalid-parameter', id: 'P-07' },
    { name: 'friction μ', value: v(p.friction), range: r.friction, code: 'invalid-parameter', id: 'P-08' },
    { name: 'gravity g', value: v(p.gravity), range: r.gravity, code: 'invalid-parameter', id: 'P-09' },
    { name: 'wind speed |w|', value: length(v(p.wind)), range: r.windSpeed, code: 'invalid-parameter', id: 'P-20' },
    { name: 'time step Δt', value: dt, range: r.timeStep, code: 'invalid-parameter', id: 'P-18' },
    { name: 'max time', value: settings.maxTime, range: r.maxTime, code: 'invalid-setting' },
    { name: 'step count maxTime / Δt', value: settings.maxTime / dt, range: r.stepCount, code: 'invalid-setting' },
  ];
  const f = settings.forces;
  if (f.drag || f.magnus || f.spinDecay === 'torque-coefficient') {
    checks.push({ name: 'air density ρ', value: v(p.airDensity), range: r.airDensity, code: 'invalid-parameter', id: 'P-10' });
  }
  if (f.drag) checks.push({ name: 'drag coefficient C_D', value: v(p.dragCoefficient), range: r.dragCoefficient, code: 'invalid-parameter', id: 'P-12' });
  if (f.magnus) {
    const lift = v(p.liftCoefficient);
    const values = typeof lift === 'number' ? [lift] : lift.points.map(([, c]) => c);
    checks.push(...values.map((value): RangeCheck => ({ name: 'lift coefficient C_L', value, range: r.liftCoefficient, code: 'invalid-parameter', id: 'P-13' })));
  }
  if (f.spinDecay === 'linear') {
    checks.push({ name: 'linear spin decay c_ω', value: v(p.spinDecayLinear), range: r.spinDecayLinear, code: 'invalid-parameter', id: 'P-14' });
  }
  if (f.spinDecay === 'torque-coefficient') {
    checks.push({ name: 'torque coefficient C_M', value: v(p.torqueCoefficient), range: r.torqueCoefficient, code: 'invalid-parameter', id: 'P-22' });
  }
  if (settings.ground === 'bounce-and-roll') {
    checks.push(
      { name: 'ground restitution e_g', value: v(p.groundRestitution), range: r.restitution, code: 'invalid-parameter', id: 'P-15' },
      { name: 'ground friction μ_g', value: v(p.groundFriction), range: r.friction, code: 'invalid-parameter', id: 'P-16' },
      { name: 'rolling resistance μ_r', value: v(p.rollingResistance), range: r.rollingResistance, code: 'invalid-parameter', id: 'P-17' },
    );
  }
  return checkRanges(checks);
}

function flightForces(parameters: ParameterSet, settings: SimulationSettings): FlightForceSettings {
  const f = settings.forces;
  const p = parameters;
  const lift = f.magnus ? v(p.liftCoefficient) : 0;
  return {
    gravity: f.gravity,
    drag: { enabled: f.drag, coefficient: { kind: 'constant', value: f.drag ? v(p.dragCoefficient) : 0 } },
    magnus: { enabled: f.magnus, coefficient: typeof lift === 'number' ? { kind: 'constant', value: lift } : lift },
    spinDecay: f.spinDecay === 'linear'
      ? { kind: 'linear', coefficient: v(p.spinDecayLinear) }
      : f.spinDecay === 'torque-coefficient'
        ? { kind: 'torque-coefficient', coefficient: { kind: 'constant', value: v(p.torqueCoefficient) } }
        : { kind: 'none' },
  };
}

/** キック 1 回分を、衝突から終了条件まで一括で計算する（04 §6）。 */
export function simulateKick(input: KickInput, parameters: ParameterSet, settings: SimulationSettings): SimResult<KickSimulationResult> {
  const missing = requiredEntries(parameters, settings).filter((e) => e.value === null).map((e) => e.id);
  if (missing.length > 0) {
    return fail('invalid-parameter', `parameters used by this simulation are undetermined: ${missing.join(', ')}`, { missing });
  }
  // 折れ線の表の構造（有限性・先頭の S・単調性）は、各点の範囲より先に確かめる。非有限の値の表は、
  // 範囲外（invalid-parameter）ではなく無効な係数（invalid-coefficient、05 §7.4）として返すため（IV-03-C2 の D01）。
  const lift = parameters.liftCoefficient.value;
  if (settings.forces.magnus && lift !== null && typeof lift !== 'number') {
    const error = spinTableError(lift);
    if (error !== null) return fail('invalid-coefficient', `C_L (P-13): ${error}`);
  }
  const ranges = validateRanges(input, parameters, settings);
  if (!ranges.ok) return ranges;

  const p = parameters;
  const ball: BallParams = { mass: v(p.ballMass), radius: v(p.ballRadius), inertiaCoefficient: v(p.ballInertiaCoefficient) };
  const foot: FootParams = { mass: v(p.footMass), inertiaBody: v(p.footInertiaBody), shape: { kind: 'box', dimensions: v(p.footDimensions) } };

  const setup = buildImpactSetup(input, { ball, foot, rollReferenceThreshold: v(p.rollReferenceThreshold) });
  if (!setup.ok) return setup;
  const impact = solveImpact(
    setup.value,
    { ball, foot, restitution: v(p.restitution), friction: v(p.friction), tangentialSpeedThreshold: v(p.tangentialSpeedThreshold) },
    input.footModel,
  );
  if (!impact.ok) return impact;

  const gravity = v(p.gravity);
  const environment: FlightEnvironment = {
    gravity,
    airDensity: p.airDensity.value ?? 0,
    // η は係数を関数で与える場合の Re の計算にだけ使う。この API の係数は定数なので使わない（未決定なら NaN を渡す）。
    airViscosity: p.airViscosity.value ?? Number.NaN,
    wind: v(p.wind),
  };
  const flightSettings: FlightSimulationSettings = {
    timeStep: v(p.timeStep),
    maxTime: settings.maxTime,
    eventTimeTolerance: settings.eventTimeTolerance,
    forces: flightForces(p, settings),
    thresholds: { magnus: v(p.magnusThreshold), zeroSpeed: v(p.zeroSpeedThreshold), zeroSpin: v(p.zeroSpinThreshold) },
  };
  let onGround: GroundContactHandler = terminateOnGroundContact;
  if (settings.ground === 'bounce-and-roll') {
    const rest = v(p.restThresholds);
    const handler = groundHandler(ball, {
      restitution: v(p.groundRestitution), friction: v(p.groundFriction), tangentialSpeedThreshold: v(p.tangentialSpeedThreshold),
      gravity, rollingResistance: v(p.rollingResistance), restSpeed: rest.rest, stopSpeed: rest.stopSpeed, stopSpin: rest.stopSpin,
    });
    if (!handler.ok) return handler;
    onGround = handler.value;
  }
  const trajectory = simulateFlight(impact.value.ballAfter, ball, environment, flightSettings, onGround);
  if (!trajectory.ok) return trajectory;

  return ok({
    modelVersion: MODEL_VERSION,
    input,
    parameters,
    settings,
    impact: impact.value,
    trajectory: trajectory.value,
    metrics: computeMetrics(impact.value, trajectory.value, parameters),
    warnings: impact.value.diagnostics.warnings.map((code) => ({ stage: 'impact', code })),
  });
}

/**
 * 測定値（05 §9、04 §6 の computeMetrics）。軌道のサンプル 0 は impact.ballAfter（VER-S02）なので、
 * 打ち出しの値は軌道から求める。P-27 が未決定ならスピン成分は定義不能（null）として扱う。
 */
export function computeMetrics(_impact: ImpactResult, trajectory: Trajectory, parameters: ParameterSet): KickMetrics {
  return computeFlightMetrics(trajectory, { verticalLaunchThreshold: parameters.verticalLaunchThreshold.value ?? Number.POSITIVE_INFINITY });
}
