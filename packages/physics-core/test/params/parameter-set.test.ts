// T1.1-07：05 §10 の全パラメータと確からしさの区分が型で表現できること。
// 値は 05 §10.2（2026-10-18 時点）の記載をそのまま写したテスト用の例で、Core の既定値ではない。
import { describe, expect, it } from 'vitest';
import { boxInertia } from '../../src/bodies/dynamics';
import type { Confidence, ParameterEntry, ParameterId, ParameterSet } from '../../src/params/parameter-set';
import { expectAllClose } from '../tolerance';

function undetermined<T>(id: ParameterId, symbol: string, unit: string, source: string): ParameterEntry<T> {
  return { id, symbol, unit, value: null, confidence: 'undetermined', source };
}

const phase1Table: ParameterSet = {
  ballMass: {
    id: 'P-01', symbol: 'm_B', unit: 'kg', value: null, candidateRange: { min: 0.41, max: 0.45 },
    confidence: 'standard', source: 'IFAB 競技規則 第 2 条とされる範囲（一次情報未照合）',
  },
  ballRadius: {
    id: 'P-02', symbol: 'R', unit: 'm', value: null,
    candidateRange: { min: 0.68 / (2 * Math.PI), max: 0.7 / (2 * Math.PI) },
    confidence: 'standard', source: '外周 0.68–0.70 m からの換算（一次情報未照合）',
  },
  ballInertiaCoefficient: undetermined('P-03', 'κ', '—', 'OQ-06'),
  footMass: { id: 'P-04', symbol: 'm_A', unit: 'kg', value: 1.2, confidence: 'provisional', source: '出典なし（T0-08）。OQ-02' },
  footInertiaBody: {
    id: 'P-05', symbol: 'I_A^body', unit: 'kg·m²', value: [0.00164, 0, 0, 0, 0.0074, 0, 0, 0, 0.00776],
    confidence: 'provisional', source: 'P-04・P-06 から直方体の式で計算',
  },
  footDimensions: { id: 'P-06', symbol: 'L_x, L_y, L_z', unit: 'm', value: [0.26, 0.1, 0.08], confidence: 'provisional', source: '出典なし（T0-08）。OQ-02' },
  restitution: undetermined('P-07', 'e', '—', 'OQ-04'),
  friction: undetermined('P-08', 'μ', '—', 'OQ-05'),
  gravity: { id: 'P-09', symbol: 'g', unit: 'm/s²', value: 9.80665, confidence: 'defined', source: '標準重力' },
  airDensity: {
    id: 'P-10', symbol: 'ρ', unit: 'kg/m³', value: 1.225, confidence: 'standard',
    source: '国際標準大気の海面値とされる値（一次情報未照合）',
  },
  airViscosity: undetermined('P-11', 'η', 'Pa·s', '国際標準大気の値を候補'),
  dragCoefficient: undetermined('P-12', 'C_D', '—', 'OQ-07'),
  liftCoefficient: undetermined('P-13', 'C_L', '—', 'OQ-07'),
  spinDecayLinear: undetermined('P-14', 'c_ω', 'kg·m²/s', 'OQ-08'),
  groundRestitution: undetermined('P-15', 'e_g', '—', 'OQ-09'),
  groundFriction: undetermined('P-16', 'μ_g', '—', 'OQ-09'),
  rollingResistance: undetermined('P-17', 'μ_r', '—', 'OQ-09'),
  timeStep: { id: 'P-18', symbol: 'Δt', unit: 's', value: 0.005, confidence: 'provisional', source: '収束試験（VER-F02）に基づく暫定の候補。OQ-12' },
  restThresholds: undetermined('P-19', 'v_rest, v_stop, ω_stop', 'm/s, rad/s', 'OQ-09'),
  wind: { id: 'P-20', symbol: 'w', unit: 'm/s', value: [0, 0, 0], confidence: 'assumption', source: 'Phase 1 は無風' },
  magnusThreshold: { id: 'P-21', symbol: 'ε', unit: 'm/s²', value: 1e-9, confidence: 'provisional', source: '丸め誤差の見積もり（T1.2-05）' },
  torqueCoefficient: undetermined('P-22', 'C_M', '—', 'OQ-08'),
  zeroSpeedThreshold: { id: 'P-23', symbol: 'ε_v', unit: 'm/s', value: 1e-6, confidence: 'provisional', source: '力の大きさの見積もり（T1.2-05）' },
  zeroSpinThreshold: { id: 'P-24', symbol: 'ε_ω', unit: 'rad/s', value: 1e-6, confidence: 'provisional', source: '正規化のゼロ除算の回避（T1.2-06）' },
  tangentialSpeedThreshold: undetermined('P-25', 'ε_t', 'm/s', 'M1.3'),
  rollReferenceThreshold: undetermined('P-26', 'ε_φ', '—', 'M1.3'),
  verticalLaunchThreshold: { id: 'P-27', symbol: 'ε_vert', unit: '—', value: 1e-6, confidence: 'provisional', source: 'スピン成分の定義不能の判定（T1.2-09）' },
};

describe('ParameterSet', () => {
  it('covers every parameter ID of 05 §10.2 exactly once', () => {
    const ids = Object.values(phase1Table).map((entry) => entry.id).sort();
    const expected = Array.from({ length: 27 }, (_, i) => `P-${String(i + 1).padStart(2, '0')}`);
    expect(ids).toEqual(expected);
  });

  it('can express every confidence category of 05 §10.1', () => {
    const all: Confidence[] = ['defined', 'standard', 'literature', 'measured', 'provisional', 'assumption', 'undetermined'];
    for (const confidence of all) {
      const entry: ParameterEntry<number> = { ...phase1Table.restitution, value: 0.5, confidence };
      expect(entry.confidence).toBe(confidence);
    }
  });
});

describe('provisional foot parameters (T0-08)', () => {
  it('derive P-05 from P-04 and P-06 with the box formula of 05 §5.2', () => {
    expectAllClose(boxInertia(phase1Table.footMass.value!, phase1Table.footDimensions.value!), phase1Table.footInertiaBody.value!);
  });
});
