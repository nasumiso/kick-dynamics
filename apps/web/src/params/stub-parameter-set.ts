// パラメータセットのスタブ（AC-13 の表示用、T1.4-08）。05 §10.2（2026-10-19 時点）の記載を写したもので、Core の既定値ではない。
// 05 §10.2 を変更したら、ここも同時に更新する。物理の計算に使うパラメータセットはパイプライン（T1.5-01）で扱う。
import { boxInertia, type ParameterEntry, type ParameterId, type ParameterSet, type Vec3 } from '@kick-dynamics/physics-core';

function undetermined<T>(id: ParameterId, symbol: string, unit: string, source: string): ParameterEntry<T> {
  return { id, symbol, unit, value: null, confidence: 'undetermined', source };
}

const footDimensions: Vec3 = [0.26, 0.1, 0.08];

export const STUB_PARAMETER_SET: ParameterSet = {
  ballMass: {
    id: 'P-01', symbol: 'm_B', unit: 'kg', value: null, candidateRange: { min: 0.41, max: 0.45 },
    confidence: 'standard', source: 'IFAB 競技規則 第 2 条の 5 号球の規定とされる範囲（一次情報未照合）',
  },
  ballRadius: {
    id: 'P-02', symbol: 'R', unit: 'm', value: null, candidateRange: { min: 0.68 / (2 * Math.PI), max: 0.7 / (2 * Math.PI) },
    confidence: 'standard', source: '外周 0.68–0.70 m からの換算（一次情報未照合）',
  },
  ballInertiaCoefficient: undetermined('P-03', 'κ', '—', '参照：2/5（中実球）、2/3（薄肉の中空球）。OQ-06'),
  footMass: { id: 'P-04', symbol: 'm_A', unit: 'kg', value: 1.2, confidence: 'provisional', source: '出典なし（T0-08）。OQ-02' },
  footInertiaBody: {
    id: 'P-05', symbol: 'I_A^body', unit: 'kg·m²', value: boxInertia(1.2, footDimensions),
    confidence: 'provisional', source: 'P-04・P-06 から直方体の式（05 §5.2）で計算',
  },
  footDimensions: { id: 'P-06', symbol: 'L_x, L_y, L_z', unit: 'm', value: footDimensions, confidence: 'provisional', source: '出典なし（T0-08）。OQ-02' },
  restitution: undetermined('P-07', 'e', '—', 'OQ-04'),
  friction: undetermined('P-08', 'μ', '—', 'OQ-05'),
  gravity: { id: 'P-09', symbol: 'g', unit: 'm/s²', value: 9.80665, confidence: 'defined', source: '標準重力' },
  airDensity: {
    id: 'P-10', symbol: 'ρ', unit: 'kg/m³', value: 1.225, confidence: 'standard', source: '国際標準大気の海面値とされる値（一次情報未照合）',
  },
  airViscosity: undetermined('P-11', 'η', 'Pa·s', '国際標準大気の値を候補とし、照合後に記入'),
  dragCoefficient: undetermined('P-12', 'C_D', '—', 'モデル形も未決定。OQ-07'),
  liftCoefficient: undetermined('P-13', 'C_L', '—', 'OQ-07'),
  spinDecayLinear: undetermined('P-14', 'c_ω', 'kg·m²/s', 'OQ-08'),
  groundRestitution: undetermined('P-15', 'e_g', '—', 'OQ-09'),
  groundFriction: undetermined('P-16', 'μ_g', '—', 'OQ-09'),
  rollingResistance: undetermined('P-17', 'μ_r', '—', 'OQ-09'),
  timeStep: { id: 'P-18', symbol: 'Δt', unit: 's', value: 0.005, confidence: 'provisional', source: '収束試験（VER-F02）に基づく暫定の候補。OQ-12' },
  restThresholds: undetermined('P-19', 'v_rest, v_stop, ω_stop', 'm/s, rad/s', 'OQ-09'),
  wind: { id: 'P-20', symbol: 'w', unit: 'm/s', value: [0, 0, 0], confidence: 'assumption', source: 'Phase 1 は無風' },
  magnusThreshold: { id: 'P-21', symbol: 'ε', unit: 'm/s²', value: 1e-9, confidence: 'provisional', source: '数値上の閾値（T1.2-05）。物理的な根拠はない' },
  torqueCoefficient: undetermined('P-22', 'C_M', '—', 'OQ-08'),
  zeroSpeedThreshold: { id: 'P-23', symbol: 'ε_v', unit: 'm/s', value: 1e-6, confidence: 'provisional', source: '数値上の閾値（T1.2-05）。物理的な根拠はない' },
  zeroSpinThreshold: { id: 'P-24', symbol: 'ε_ω', unit: 'rad/s', value: 1e-6, confidence: 'provisional', source: '数値上の閾値（T1.2-06）。物理的な根拠はない' },
  tangentialSpeedThreshold: { id: 'P-25', symbol: 'ε_t', unit: 'm/s', value: 1e-9, confidence: 'provisional', source: '数値上の閾値（T1.3-03）。物理的な根拠はない' },
  rollReferenceThreshold: { id: 'P-26', symbol: 'ε_φ', unit: '—', value: 1e-6, confidence: 'provisional', source: '数値上の閾値（T1.3-06）。物理的な根拠はない' },
  verticalLaunchThreshold: { id: 'P-27', symbol: 'ε_vert', unit: '—', value: 1e-6, confidence: 'provisional', source: '数値上の閾値（T1.2-09）。物理的な根拠はない' },
  diagnosticRelativeTolerance: { id: 'P-28', symbol: 'τ_diag', unit: '—', value: 1e-9, confidence: 'provisional', source: '数値上の閾値（T1.3-05）。物理的な根拠はない' },
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
