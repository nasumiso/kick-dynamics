// simulateKick の入口で受け付ける入力・物性値・設定の範囲（docs/05-physics-model.md §10.3）。
// 範囲はすべて仮置き（2026-10-19、人間が承認）。目的は、極端な値による桁あふれと入力の誤りを入口でまとめて
// 防ぐことだけで（packages/physics-core/AGENTS.md）、現実のキックの値の範囲を表すものではない。
// 範囲外は補正・切り詰めをせずに SimResult のエラーで返す。

/** 閉区間 [min, max]。minExclusive なら (min, max]。 */
export interface AcceptedRange {
  readonly min: number;
  readonly max: number;
  readonly minExclusive?: boolean;
}

export const ACCEPTED_RANGES = {
  /** |v_A^p| m/s */
  footContactPointSpeed: { min: 0, max: 60 },
  /** |ω_A| rad/s */
  footAngularSpeed: { min: 0, max: 200 },
  /** m_B kg（P-01） */
  ballMass: { min: 0.1, max: 2 },
  /** R m（P-02） */
  ballRadius: { min: 0.05, max: 0.3 },
  /** κ（P-03） */
  ballInertiaCoefficient: { min: 0, max: 1, minExclusive: true },
  /** m_A kg（P-04） */
  footMass: { min: 0.1, max: 50 },
  /** L_x, L_y, L_z m（P-06） */
  footDimension: { min: 0.01, max: 1 },
  /** e（P-07）、e_g（P-15） */
  restitution: { min: 0, max: 1 },
  /** μ（P-08）、μ_g（P-16） */
  friction: { min: 0, max: 2 },
  /** μ_r（P-17） */
  rollingResistance: { min: 0, max: 1 },
  /** C_D（P-12） */
  dragCoefficient: { min: 0, max: 2 },
  /** C_L（P-13）。負の C_L も受け付ける（05 §7.4） */
  liftCoefficient: { min: -2, max: 2 },
  /** C_M（P-22） */
  torqueCoefficient: { min: 0, max: 1 },
  /** c_ω kg·m²/s（P-14） */
  spinDecayLinear: { min: 0, max: 1 },
  /** g m/s²（P-09） */
  gravity: { min: 1, max: 30 },
  /** ρ kg/m³（P-10） */
  airDensity: { min: 0, max: 2 },
  /** |w| m/s（P-20） */
  windSpeed: { min: 0, max: 50 },
  /** Δt s（P-18） */
  timeStep: { min: 1e-5, max: 0.05 },
  /** 最大シミュレーション時間 s */
  maxTime: { min: 0, max: 120, minExclusive: true },
  /** ステップ数 maxTime / Δt */
  stepCount: { min: 0, max: 1e6 },
} as const satisfies Record<string, AcceptedRange>;

/** 有限で、範囲に含まれるか。 */
export function inRange(value: number, range: AcceptedRange): boolean {
  if (!Number.isFinite(value)) return false;
  const aboveMin = range.minExclusive ? value > range.min : value >= range.min;
  return aboveMin && value <= range.max;
}

export function describeRange(range: AcceptedRange): string {
  return `${range.minExclusive ? '(' : '['}${range.min}, ${range.max}]`;
}
