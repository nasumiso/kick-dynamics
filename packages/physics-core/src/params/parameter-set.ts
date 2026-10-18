// パラメータセット：値とメタデータ（単位・出典・確からしさ・適用条件）。
// 一覧と確からしさの区分の正本は docs/05-physics-model.md §10。
// Core の計算は value だけを使い、メタデータは結果にそのまま含めて UI と出力へ渡す（04 §6）。
import type { Mat3 } from '../math/mat3';
import type { Vec3 } from '../math/vec3';

/**
 * 確からしさの区分（05 §10.1）。
 * defined：定義値、standard：規格値、literature：文献値、measured：実測同定、
 * provisional：仮置き、assumption：仮定、undetermined：未決定
 */
export type Confidence =
  | 'defined'
  | 'standard'
  | 'literature'
  | 'measured'
  | 'provisional'
  | 'undetermined'
  | 'assumption';

export type ParameterId =
  | 'P-01' | 'P-02' | 'P-03' | 'P-04' | 'P-05' | 'P-06' | 'P-07' | 'P-08'
  | 'P-09' | 'P-10' | 'P-11' | 'P-12' | 'P-13' | 'P-14' | 'P-15' | 'P-16'
  | 'P-17' | 'P-18' | 'P-19' | 'P-20' | 'P-21' | 'P-22' | 'P-23' | 'P-24'
  | 'P-25' | 'P-26';

export interface ParameterEntry<T> {
  readonly id: ParameterId;
  /** 記号（05 §3 の表記） */
  readonly symbol: string;
  /** SI 単位。無次元は '—' */
  readonly unit: string;
  /** 値。未決定なら null */
  readonly value: T | null;
  /** 候補範囲（規格の範囲などで単一の値が決まっていない場合） */
  readonly candidateRange?: { readonly min: number; readonly max: number };
  readonly confidence: Confidence;
  /** 出典・備考（一次情報との照合状況を含む） */
  readonly source: string;
  /** 適用条件 */
  readonly applicability?: string;
}

/** 転がり移行・停止の閾値（P-19）。 */
export interface RestThresholds {
  /** v_rest m/s */
  readonly rest: number;
  /** v_stop m/s */
  readonly stopSpeed: number;
  /** ω_stop rad/s */
  readonly stopSpin: number;
}

/** 05 §10.2 のパラメータ一覧。キーは用途、id は表の ID。 */
export interface ParameterSet {
  readonly ballMass: ParameterEntry<number>; // P-01
  readonly ballRadius: ParameterEntry<number>; // P-02
  readonly ballInertiaCoefficient: ParameterEntry<number>; // P-03
  readonly footMass: ParameterEntry<number>; // P-04
  readonly footInertiaBody: ParameterEntry<Mat3>; // P-05（P-04・P-06 から計算）
  readonly footDimensions: ParameterEntry<Vec3>; // P-06
  readonly restitution: ParameterEntry<number>; // P-07
  readonly friction: ParameterEntry<number>; // P-08
  readonly gravity: ParameterEntry<number>; // P-09
  readonly airDensity: ParameterEntry<number>; // P-10
  readonly airViscosity: ParameterEntry<number>; // P-11
  readonly dragCoefficient: ParameterEntry<number>; // P-12（定数モデルの値）
  readonly liftCoefficient: ParameterEntry<number>; // P-13（定数モデルの値）
  readonly spinDecayLinear: ParameterEntry<number>; // P-14
  readonly groundRestitution: ParameterEntry<number>; // P-15
  readonly groundFriction: ParameterEntry<number>; // P-16
  readonly rollingResistance: ParameterEntry<number>; // P-17
  readonly timeStep: ParameterEntry<number>; // P-18
  readonly restThresholds: ParameterEntry<RestThresholds>; // P-19
  readonly wind: ParameterEntry<Vec3>; // P-20
  readonly magnusThreshold: ParameterEntry<number>; // P-21
  readonly torqueCoefficient: ParameterEntry<number>; // P-22
  readonly zeroSpeedThreshold: ParameterEntry<number>; // P-23
  readonly zeroSpinThreshold: ParameterEntry<number>; // P-24
  readonly tangentialSpeedThreshold: ParameterEntry<number>; // P-25
  readonly rollReferenceThreshold: ParameterEntry<number>; // P-26
}
