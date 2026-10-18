// 飛翔の力モデルの設定（docs/05-physics-model.md §7、docs/04-architecture.md §6）。
//
// 配置（暫定、T1.2-01）：各力項の ON/OFF とモデルの選択は SimulationSettings 側（本ファイルの
// FlightForceSettings）に置き、物理定数（g、ρ、η、風速）は FlightEnvironment として渡す。
// どちらも、パイプライン（T1.5-01）で ParameterSet の値から組み立てる。
import type { Vec3 } from '../math/vec3';

/** 空力係数のモデル：定数、または (Re, S) の関数（05 §7.3〜7.6、04 §6）。 */
export type CoefficientModel =
  | { readonly kind: 'constant'; readonly value: number }
  | { readonly kind: 'function'; readonly evaluate: (reynolds: number, spinParameter: number) => number };

/** 回転減衰のモデル（05 §7.5）。 */
export type SpinDecayModel =
  | { readonly kind: 'none' }
  | { readonly kind: 'linear'; readonly coefficient: number } // (b) c_ω kg·m²/s
  | { readonly kind: 'torque-coefficient'; readonly coefficient: CoefficientModel }; // (c) C_M

export interface FlightForceSettings {
  readonly gravity: boolean;
  readonly drag: { readonly enabled: boolean; readonly coefficient: CoefficientModel };
  readonly magnus: { readonly enabled: boolean; readonly coefficient: CoefficientModel };
  readonly spinDecay: SpinDecayModel;
}

/** 縮退判定の閾値（05 §7.3〜7.5、P-21・P-23・P-24）。値は未決定のため既定値を持たない。 */
export interface DegeneracyThresholds {
  /** ε：|ω × v_r| に対する閾値 m/s² */
  readonly magnus: number;
  /** ε_v：|v_r| に対する閾値 m/s */
  readonly zeroSpeed: number;
  /** ε_ω：|ω| に対する閾値 rad/s */
  readonly zeroSpin: number;
}

/** 飛翔に使う物理定数（P-09〜P-11、P-20）。 */
export interface FlightEnvironment {
  /** g m/s² */
  readonly gravity: number;
  /** ρ kg/m³ */
  readonly airDensity: number;
  /** η Pa·s（係数を関数で与える場合の Re の計算にだけ使う） */
  readonly airViscosity: number;
  /** w m/s（Phase 1 は 0） */
  readonly wind: Vec3;
}

export interface FlightSettings {
  /** Δt s（固定刻み、05 §7.7） */
  readonly timeStep: number;
  readonly forces: FlightForceSettings;
  readonly thresholds: DegeneracyThresholds;
}

/** ボールに働く力とトルク（ワールド座標）。 */
export interface ForceAndTorque {
  readonly force: Vec3;
  readonly torque: Vec3;
}
