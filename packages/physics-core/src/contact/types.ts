// 足–ボールの瞬間点接触の入出力（docs/05-physics-model.md §6、docs/04-architecture.md §6）。
import type { BallParams, FootParams, RigidBodyState } from '../bodies/types';
import type { Vec3 } from '../math/vec3';

/** 有限質量の 3D 剛体（05 §5.2）、または無限質量の動く壁（05 §6.9）。 */
export type FootModel = 'finite-mass' | 'kinematic-wall';

/** 物理的に整合した衝突直前の状態（05 §6.2）。 */
export interface ImpactSetup {
  readonly ball: RigidBodyState;
  readonly foot: RigidBodyState;
  /** 接触点 p m（ワールド座標） */
  readonly contactPoint: Vec3;
  /** 接触法線 n（足 → ボールの向きの単位ベクトル） */
  readonly contactNormal: Vec3;
}

/** 衝突の計算に使う物性と係数（05 §10.2 の P-01〜P-08、P-25 の値）。 */
export interface ContactParameters {
  readonly ball: BallParams;
  readonly foot: FootParams;
  /** e（0 ≤ e ≤ 1） */
  readonly restitution: number;
  /** μ（≥ 0） */
  readonly friction: number;
  /** ε_t：接線速度がほぼ 0 とみなす閾値 m/s（05 §6.8、P-25） */
  readonly tangentialSpeedThreshold: number;
}

/** 衝突終了時の状態のラベル（05 §6.8。衝突中ずっとその状態だったことは意味しない）。 */
export type ImpactRegime = 'separating' | 'stick' | 'slide';

export interface ImpactResult {
  /** ボールに加わる衝撃量 J N·s（足には −J） */
  readonly impulse: Vec3;
  readonly regime: ImpactRegime;
  readonly ballAfter: RigidBodyState;
  readonly footAfter: RigidBodyState;
  readonly diagnostics: ImpactDiagnostics;
}

export interface ImpactDiagnostics {
  /** 接触点の相対速度 u（ボール − 足）の衝突前後 m/s */
  readonly relativeVelocityBefore: Vec3;
  readonly relativeVelocityAfter: Vec3;
  /**
   * ΔT = ½ J·(u⁻ + u⁺) J（05 §6.11）。有限質量モデルでは足とボールの運動エネルギーの合計の変化。
   * 無限質量モデルで ω_A = 0 なら、足とともに並進する系から見たボールの運動エネルギーの変化。
   */
  readonly kineticEnergyChange: number;
  /** 地上系でのボールの運動エネルギー（並進＋回転）の衝突前後 J */
  readonly ballKineticEnergyBefore: number;
  readonly ballKineticEnergyAfter: number;
  /**
   * 足とボールの全運動量と、接触点 p（固定点）まわりの全角運動量の衝突前後（05 §6.11）。
   * 無限質量モデルでは定義しないため null。
   */
  readonly systemMomentum: { readonly before: Vec3; readonly after: Vec3 } | null;
  readonly systemAngularMomentum: { readonly before: Vec3; readonly after: Vec3 } | null;
  /** 滑りの解で使った滑り方向 t̂（固着・離反、μ = 0 の滑りでは null） */
  readonly slidingDirection: Vec3 | null;
  readonly warnings: readonly ImpactWarning[];
}

/**
 * 衝突の警告（05 §6.8）。結果は返し、補正はしない。
 * - tangent-direction-approximated：|u_t⁻| ≤ ε_t なのに固着解が摩擦円錐を外れたため、t̂ = −J*_t/|J*_t| を近似として使った
 * - energy-increase：ΔT > 0（有限質量モデル、または無限質量モデルで ω_A = 0 の場合だけ判定、05 §6.11）
 * - slip-reversal：滑りの解で u_t⁺ · t̂ < 0（05 §6.8 の手順 5）
 * 判定には丸め誤差を除くための相対的な幅（P-28、仮置き）を使う。
 */
export type ImpactWarning = 'tangent-direction-approximated' | 'energy-increase' | 'slip-reversal';
