// 飛翔の力モデルの設定（docs/05-physics-model.md §7、docs/04-architecture.md §6）。
//
// 配置（暫定、T1.2-01）：各力項の ON/OFF とモデルの選択は SimulationSettings 側（本ファイルの
// FlightForceSettings）に置き、物理定数（g、ρ、η、風速）は FlightEnvironment として渡す。
// どちらも、パイプライン（T1.5-01）で ParameterSet の値から組み立てる。
import type { RigidBodyState } from '../bodies/types';
import type { Vec3 } from '../math/vec3';
import type { SimResult } from '../result';

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

/** 縮退判定の閾値（05 §7.3〜7.5、P-21・P-23・P-24）。値は仮置き（05 §10.2）で、Core は既定値を持たない。 */
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

/** 地面イベントを含む飛翔の設定（05 §7.7）。 */
export interface FlightSimulationSettings extends FlightSettings {
  /** 最大シミュレーション時間 s。最初に時刻 k Δt ≥ maxTime となるステップで終了する */
  readonly maxTime: number;
  /** δ_t：接地時刻を求める二分法の打ち切り幅 s（05 §7.7。値は仮置き、06 §3 の TOL-C） */
  readonly eventTimeTolerance: number;
}

/** 地面との接触（05 §7.7）。state は y を R に射影した後の状態。 */
export interface GroundContact {
  /** 接地時刻 t* s */
  readonly time: number;
  readonly state: RigidBodyState;
  /** 飛翔の開始時に h ≤ 0 かつ v_y ≤ 0 だった場合（05 §7.7 の「初期状態」、§8.3） */
  readonly atStart: boolean;
  /** 飛翔の時間刻み Δt s（転がりへの移行の閾値の条件 e_g v_rest ≥ g Δt / 2 の確認に使う、05 §7.7） */
  readonly timeStep: number;
}

/**
 * 地面上の転がり（05 §8.2）。拘束 y = R、v_y = 0 を満たす状態を duration だけ進め、停止を判定する。
 * 飛翔の積分は、転がりに移った後は空力を使わずにこれで進める（決定、2026-10-19）。
 */
export interface GroundRolling {
  readonly advance: (state: RigidBodyState, duration: number) => RigidBodyState;
  readonly isStopped: (state: RigidBodyState) => boolean;
}

/** 接地の処理の結果：飛翔を終える、処理後の状態から飛翔を続ける、または処理後の状態から転がりに移る（05 §8.1）。 */
export type GroundContactResponse =
  | { readonly kind: 'terminate' }
  | { readonly kind: 'continue'; readonly state: RigidBodyState }
  | { readonly kind: 'roll'; readonly state: RigidBodyState; readonly rolling: GroundRolling };

/**
 * 接地の処理（05 §8 のバウンドなど）。M1.2 では既定で最初の接地で終了する。
 * バウンドは T1.3-07 で、この形の処理として与える（暫定、04 §6）。
 */
export type GroundContactHandler = (contact: GroundContact) => SimResult<GroundContactResponse>;

/**
 * 飛翔中のイベント。sampleIndex は、イベントの時刻の状態を表すサンプルの添字
 * （接地では処理の前の状態。処理の後に飛翔を続ける場合は sampleIndex + 1 が処理の後の状態）。
 *
 * - ground-contact：ステップ内で検出した接地（05 §7.7）。
 * - start-on-ground：飛翔の開始時に h ≤ 0 かつ v_y ≤ 0 で、開始時刻に地面上の処理（§8.3、§8.2）を行ったこと。
 * - roll-start・stop：転がりの開始と停止（§8.1、§8.2）。転がりに移る接地では、接地のイベント（response: 'roll'）の後に
 *   roll-start が同じ時刻で続く。
 *   05 §7.7 は開始時刻を接地イベントとして扱わないため、ground-contact とは別の種別にする（決定、2026-10-18）。
 */
export type FlightEvent =
  | {
    readonly type: 'ground-contact';
    readonly time: number;
    readonly sampleIndex: number;
    /** 二分法の反復回数 */
    readonly bisectionIterations: number;
    /** y を R に射影したことによる位置エネルギーの変化 m g (R − y) J（05 §7.7） */
    readonly projectionEnergy: number;
    readonly response: GroundContactResponse['kind'];
  }
  | {
    readonly type: 'start-on-ground';
    readonly time: number;
    readonly sampleIndex: number;
    readonly projectionEnergy: number;
    readonly response: GroundContactResponse['kind'];
  }
  /** 転がりの開始（05 §8.1）。sampleIndex は転がりに入った状態（y = R、v_y = 0）のサンプル */
  | { readonly type: 'roll-start'; readonly time: number; readonly sampleIndex: number }
  /** 停止（05 §8.2）：停止条件を最初に満たしたステップの終了時刻 */
  | { readonly type: 'stop'; readonly time: number; readonly sampleIndex: number }
  | { readonly type: 'max-time'; readonly time: number; readonly sampleIndex: number };

/** 時刻つきの状態。 */
export interface FlightSample {
  readonly time: number;
  readonly state: RigidBodyState;
}

/** ボールに働く力とトルク（ワールド座標）。 */
export interface ForceAndTorque {
  readonly force: Vec3;
  readonly torque: Vec3;
}
