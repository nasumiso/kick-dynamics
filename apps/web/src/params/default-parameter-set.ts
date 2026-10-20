// Lab の既定のパラメータセット（T1.5-02）。05 §10.2（2026-10-20 時点）の値・確からしさ・出典を写したもので、
// Core の既定値ではない（Core は既定値を持たない）。05 §10.2 を変更したら、ここも同時に更新する。
// 値の多くは「仮置き」で、UI はそれと分かる表示をする（AC-13）。P-14・P-22 は未決定のため、回転減衰は使わない。
import { boxInertia, type ParameterEntry, type ParameterId, type ParameterSet, type Vec3 } from '@kick-dynamics/physics-core';

function undetermined<T>(id: ParameterId, symbol: string, unit: string, source: string): ParameterEntry<T> {
  return { id, symbol, unit, value: null, confidence: 'undetermined', source };
}

const footDimensions: Vec3 = [0.26, 0.1, 0.08];
const NUMERICAL = '数値上の閾値。物理的な根拠はない';

export const DEFAULT_PARAMETER_SET: ParameterSet = {
  ballMass: {
    id: 'P-01', symbol: 'm_B', unit: 'kg', value: 0.43, candidateRange: { min: 0.41, max: 0.45 }, confidence: 'provisional',
    source: '規格の範囲（IFAB 競技規則 第 2 条 1 項、照合済み）410–450 g の中央を選んだ仮置き',
  },
  ballRadius: {
    id: 'P-02', symbol: 'R', unit: 'm', value: 0.69 / (2 * Math.PI),
    candidateRange: { min: 0.68 / (2 * Math.PI), max: 0.7 / (2 * Math.PI) }, confidence: 'provisional',
    source: '規格の外周の範囲（IFAB 競技規則 第 2 条 1 項、照合済み）68–70 cm の中央から換算した仮置き',
  },
  ballInertiaCoefficient: { id: 'P-03', symbol: 'κ', unit: '—', value: 2 / 3, confidence: 'provisional', source: '出典なし。薄い球殻の式。OQ-06' },
  footMass: { id: 'P-04', symbol: 'm_A', unit: 'kg', value: 1.2, confidence: 'provisional', source: '出典なし（T0-08）。OQ-02' },
  footInertiaBody: {
    id: 'P-05', symbol: 'I_A^body', unit: 'kg·m²', value: boxInertia(1.2, footDimensions),
    confidence: 'provisional', source: 'P-04・P-06 から直方体の式（05 §5.2）で計算',
  },
  footDimensions: { id: 'P-06', symbol: 'L_x, L_y, L_z', unit: 'm', value: footDimensions, confidence: 'provisional', source: '出典なし（T0-08）。OQ-02' },
  restitution: { id: 'P-07', symbol: 'e', unit: '—', value: 0.5, confidence: 'provisional', source: '出典なし。OQ-04' },
  friction: { id: 'P-08', symbol: 'μ', unit: '—', value: 0.5, confidence: 'provisional', source: '出典なし。OQ-05' },
  gravity: { id: 'P-09', symbol: 'g', unit: 'm/s²', value: 9.80665, confidence: 'defined', source: '標準重力' },
  airDensity: {
    id: 'P-10', symbol: 'ρ', unit: 'kg/m³', value: 1.225, confidence: 'standard', source: '国際標準大気の海面値とされる値（一次情報未照合）',
  },
  airViscosity: {
    id: 'P-11', symbol: 'η', unit: 'Pa·s', value: 1.789e-5, confidence: 'standard', source: '国際標準大気の海面値とされる値（一次情報未照合）',
  },
  dragCoefficient: {
    id: 'P-12', symbol: 'C_D', unit: '—', value: 0.2, confidence: 'literature',
    source: 'Goff & Carré, Am. J. Phys. 77(11), 1020–1027 (2009)。無回転、抗力危機より高い Re。OQ-07',
  },
  liftCoefficient: {
    id: 'P-13', symbol: 'C_L', unit: '—', value: { kind: 'spin-table', points: [[0, 0], [0.25, 0.3], [1, 0.3]] }, confidence: 'provisional',
    source: 'S の折れ線。値の水準は Goff & Carré (2009) Fig. 14 の |C_L| 0.27–0.31、形は仮定。OQ-07',
  },
  spinDecayLinear: undetermined('P-14', 'c_ω', 'kg·m²/s', 'OQ-08'),
  groundRestitution: { id: 'P-15', symbol: 'e_g', unit: '—', value: 0.6, confidence: 'provisional', source: '出典なし。OQ-09' },
  groundFriction: { id: 'P-16', symbol: 'μ_g', unit: '—', value: 0.6, confidence: 'provisional', source: '出典なし。OQ-09' },
  rollingResistance: { id: 'P-17', symbol: 'μ_r', unit: '—', value: 0.05, confidence: 'provisional', source: '出典なし。OQ-09' },
  timeStep: { id: 'P-18', symbol: 'Δt', unit: 's', value: 0.005, confidence: 'provisional', source: '収束試験（VER-F02）に基づく暫定の候補。OQ-12' },
  restThresholds: {
    id: 'P-19', symbol: 'v_rest, v_stop, ω_stop', unit: 'm/s, rad/s', value: { rest: 0.1, stopSpeed: 0.05, stopSpin: 0.5 },
    confidence: 'provisional', source: `${NUMERICAL}。OQ-09`,
  },
  wind: { id: 'P-20', symbol: 'w', unit: 'm/s', value: [0, 0, 0], confidence: 'assumption', source: 'Phase 1 は無風' },
  magnusThreshold: { id: 'P-21', symbol: 'ε', unit: 'm/s²', value: 1e-9, confidence: 'provisional', source: `${NUMERICAL}（T1.2-05）` },
  torqueCoefficient: undetermined('P-22', 'C_M', '—', 'OQ-08'),
  zeroSpeedThreshold: { id: 'P-23', symbol: 'ε_v', unit: 'm/s', value: 1e-6, confidence: 'provisional', source: `${NUMERICAL}（T1.2-05）` },
  zeroSpinThreshold: { id: 'P-24', symbol: 'ε_ω', unit: 'rad/s', value: 1e-6, confidence: 'provisional', source: `${NUMERICAL}（T1.2-06）` },
  tangentialSpeedThreshold: { id: 'P-25', symbol: 'ε_t', unit: 'm/s', value: 1e-9, confidence: 'provisional', source: `${NUMERICAL}（T1.3-03）` },
  rollReferenceThreshold: { id: 'P-26', symbol: 'ε_φ', unit: '—', value: 1e-6, confidence: 'provisional', source: `${NUMERICAL}（T1.3-06）` },
  verticalLaunchThreshold: { id: 'P-27', symbol: 'ε_vert', unit: '—', value: 1e-6, confidence: 'provisional', source: `${NUMERICAL}（T1.2-09）` },
  diagnosticRelativeTolerance: { id: 'P-28', symbol: 'τ_diag', unit: '—', value: 1e-9, confidence: 'provisional', source: `${NUMERICAL}（T1.3-05）` },
};

/** 表示用のパラメータの意味（05 §10.2 の「意味」列）。 */
export const PARAMETER_MEANINGS: Record<ParameterId, string> = {
  'P-01': 'ボール質量', 'P-02': 'ボール半径', 'P-03': 'ボール慣性係数', 'P-04': '足の質量', 'P-05': '足の慣性テンソル',
  'P-06': '足（直方体）の寸法', 'P-07': '足–ボールの反発係数', 'P-08': '足–ボールの摩擦係数', 'P-09': '重力加速度',
  'P-10': '空気の密度', 'P-11': '空気の粘性係数', 'P-12': '抗力係数', 'P-13': '揚力（マグヌス）係数', 'P-14': '線形の回転減衰係数',
  'P-15': '地面の反発係数', 'P-16': '地面の摩擦係数', 'P-17': '転がり抵抗係数', 'P-18': '物理の時間刻み',
  'P-19': '転がり移行・停止の閾値', 'P-20': '風速', 'P-21': 'マグヌス力の縮退判定の閾値', 'P-22': '空力トルク係数',
  'P-23': 'ゼロ速度の判定閾値', 'P-24': '無回転の判定閾値', 'P-25': '接線速度がほぼ 0 とみなす閾値',
  'P-26': 'φ の基準軸を切り替える閾値', 'P-27': 'スピン成分を定義不能とする閾値', 'P-28': '衝突診断の警告の判定幅',
};
