// Lab が Core を呼ぶときに使う作業値（M1.4）。値と確からしさの正本は docs/05-physics-model.md §10.2。
// 採用値が未決定のパラメータに、表示と配置の計算のためだけの仮置きの値を与える。物理の結果に使う値は
// パイプライン（T1.5-01）でパラメータセットから組み立て、ここの値は使わない。
import { boxInertia, type BallParams, type FootParams, type ImpactGeometryParameters, type Vec3 } from '@kick-dynamics/physics-core';

/**
 * ボール（表示・配置用の仮置き）。R = 0.11 m は P-02 の候補範囲（外周 0.68–0.70 m から換算した 0.108–0.111 m）の中ほど、
 * m_B = 0.43 kg は P-01 の候補範囲 0.41–0.45 kg の中央、κ = 2/3 は P-03 の参照値の一つ（薄肉の中空球）。
 * 足の配置は R だけに依存し、m_B と κ は buildImpactSetup の入力検証を通すためだけに使う。
 */
export const WORKING_BALL: BallParams = { mass: 0.43, radius: 0.11, inertiaCoefficient: 2 / 3 };

/** 足（P-04・P-06 の仮置き、T0-08。P-05 は直方体の式で計算）。 */
const FOOT_DIMENSIONS: Vec3 = [0.26, 0.1, 0.08];
export const WORKING_FOOT: FootParams = {
  mass: 1.2, inertiaBody: boxInertia(1.2, FOOT_DIMENSIONS), shape: { kind: 'box', dimensions: FOOT_DIMENSIONS },
};

/** 接触幾何の計算に使う値。ε_φ は P-26 の仮置き（1e-6）。 */
export const WORKING_GEOMETRY: ImpactGeometryParameters = { ball: WORKING_BALL, foot: WORKING_FOOT, rollReferenceThreshold: 1e-6 };
