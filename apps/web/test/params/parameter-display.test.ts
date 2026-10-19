// T1.4-08：パラメータの表示（AC-13 の自動で確かめられる部分）。
import type { ParameterEntry, ParameterId } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { CONFIDENCE_LABELS, formatParameterValue, needsAttention } from '../../src/params/parameter-display';
import { PARAMETER_MEANINGS, STUB_PARAMETER_SET } from '../../src/params/stub-parameter-set';

const entries = Object.values(STUB_PARAMETER_SET) as Array<ParameterEntry<unknown>>;

describe('stub parameter set for the parameter panel', () => {
  it('covers every parameter ID of 05 §10.2 exactly once, with a meaning for each', () => {
    const ids = entries.map((e) => e.id).sort();
    const expected = Array.from({ length: 28 }, (_, i) => `P-${String(i + 1).padStart(2, '0')}` as ParameterId);
    expect(ids).toEqual(expected);
    for (const id of expected) expect(PARAMETER_MEANINGS[id]).toBeTruthy();
  });

  it('has a source for every entry and no value for undetermined entries', () => {
    for (const entry of entries) {
      expect(entry.source.length).toBeGreaterThan(0);
      if (entry.confidence === 'undetermined') expect(entry.value).toBeNull();
    }
  });
});

describe('parameter display', () => {
  it('labels the confidence categories of 05 §10.1 and marks provisional and undetermined values', () => {
    expect(CONFIDENCE_LABELS.provisional).toBe('仮置き');
    expect(CONFIDENCE_LABELS.undetermined).toBe('未決定');
    expect(needsAttention('provisional')).toBe(true);
    expect(needsAttention('undetermined')).toBe(true);
    expect(needsAttention('defined')).toBe(false);
    expect(needsAttention('standard')).toBe(false);
  });

  it('formats values, ranges and missing values', () => {
    expect(formatParameterValue(STUB_PARAMETER_SET.gravity)).toBe('9.80665');
    expect(formatParameterValue(STUB_PARAMETER_SET.ballMass)).toBe('候補範囲 0.41–0.45');
    expect(formatParameterValue(STUB_PARAMETER_SET.restitution)).toBe('—（未決定）');
    expect(formatParameterValue(STUB_PARAMETER_SET.footDimensions)).toBe('(0.26, 0.1, 0.08)');
    expect(formatParameterValue(STUB_PARAMETER_SET.footInertiaBody)).toBe('diag(0.00164, 0.0074, 0.00776)') // 05 §10.2 の表記と同じ;
    expect(formatParameterValue(STUB_PARAMETER_SET.magnusThreshold)).toBe('1.00e-9');
    expect(formatParameterValue({ ...STUB_PARAMETER_SET.footInertiaBody, value: [1, 2, 0, 2, 1, 0, 0, 0, 1] })).toBe('(1, 2, 0, 2, 1, 0, 0, 0, 1)');
  });
});
