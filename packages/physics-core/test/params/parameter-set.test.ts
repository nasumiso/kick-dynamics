// T1.1-07：05 §10 の全パラメータと確からしさの区分が型で表現できること。
// 値は 05 §10.2（2026-10-18 時点）の記載をそのまま写したテスト用の例で、Core の既定値ではない。
import { describe, expect, it } from 'vitest';
import type { Confidence, ParameterEntry, ParameterId, ParameterSet } from '../../src/params/parameter-set';

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
  footMass: undetermined('P-04', 'm_A', 'kg', 'OQ-02'),
  footInertiaBody: undetermined('P-05', 'I_A^body', 'kg·m²', 'P-04・P-06 から直方体の式で計算'),
  footDimensions: undetermined('P-06', 'L_x, L_y, L_z', 'm', 'OQ-02、T0-08'),
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
  timeStep: undetermined('P-18', 'Δt', 's', 'OQ-12'),
  restThresholds: undetermined('P-19', 'v_rest, v_stop, ω_stop', 'm/s, rad/s', 'OQ-09'),
  wind: { id: 'P-20', symbol: 'w', unit: 'm/s', value: [0, 0, 0], confidence: 'assumption', source: 'Phase 1 は無風' },
  magnusThreshold: undetermined('P-21', 'ε', 'm/s²', 'M1.2'),
  torqueCoefficient: undetermined('P-22', 'C_M', '—', 'OQ-08'),
  zeroSpeedThreshold: undetermined('P-23', 'ε_v', 'm/s', 'M1.2'),
  zeroSpinThreshold: undetermined('P-24', 'ε_ω', 'rad/s', 'M1.2'),
  tangentialSpeedThreshold: undetermined('P-25', 'ε_t', 'm/s', 'M1.3'),
  rollReferenceThreshold: undetermined('P-26', 'ε_φ', '—', 'M1.3'),
};

describe('ParameterSet', () => {
  it('covers every parameter ID of 05 §10.2 exactly once', () => {
    const ids = Object.values(phase1Table).map((entry) => entry.id).sort();
    const expected = Array.from({ length: 26 }, (_, i) => `P-${String(i + 1).padStart(2, '0')}`);
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
