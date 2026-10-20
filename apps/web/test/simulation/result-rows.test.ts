// T1.5-04：測定値と衝突診断の表示行（AC-09 の表示単位の変換、AC-12 の診断の表示）。
// 期待値は換算の定義（1 m/s = 3.6 km/h、1 rad = 180/π°、1 rad/s = 60/2π rpm）から直接求める。値そのものは Core が計算する（VER-S03）。
import type { KickMetrics } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { INITIAL_KICK_STATE } from '../../src/kick/kick-state';
import { DEFAULT_PARAMETER_SET } from '../../src/params/default-parameter-set';
import { diagnosticsRows, metricsRows, WARNING_LABELS, type ResultRow } from '../../src/simulation/result-rows';
import { runKick } from '../../src/simulation/run-kick';

const byKey = (rows: ResultRow[]) => new Map(rows.map((r) => [r.key, r]));

const metrics: KickMetrics = {
  launchSpeed: 25, launchAngle: Math.PI / 12, launchDirection: -Math.PI / 36, spinRate: 20 * Math.PI,
  spinComponents: { gyro: 0, back: 10 * Math.PI, side: -2 * Math.PI },
  maxHeight: 3.25, flightTime: 1.5, landingPoint: [30, -1.2], carry: 30.02, lateralDeviation: -1.2, totalDistance: null,
};

describe('metrics rows (AC-09)', () => {
  const rows = byKey(metricsRows(metrics));

  it('shows display units together with the SI values', () => {
    expect(rows.get('launchSpeed')).toMatchObject({ display: '90.0 km/h', si: '25.000 m/s' });
    expect(rows.get('launchAngle')).toMatchObject({ display: '15.0°', si: '0.2618 rad' });
    expect(rows.get('launchDirection')).toMatchObject({ display: '-5.0°' });
    expect(rows.get('spinRate')).toMatchObject({ display: '600 rpm', si: '62.83 rad/s' });
    expect(rows.get('spinBack')).toMatchObject({ display: '300 rpm' });
    expect(rows.get('spinSide')).toMatchObject({ display: '-60 rpm' });
    expect(rows.get('carry')).toMatchObject({ display: '30.02 m', si: '30.0200 m' });
    expect(rows.get('landingPoint')).toMatchObject({ display: '(30.00, -1.20) m' });
  });

  it('shows missing values as not available, with the reason', () => {
    expect(rows.get('totalDistance')!.display).toBe('なし（停止しなかった）');
    const none = byKey(metricsRows({ ...metrics, spinComponents: null, flightTime: null, landingPoint: null, carry: null, lateralDeviation: null }));
    expect(none.get('spinBack')!.display).toContain('定義不能');
    expect(none.get('flightTime')!.display).toBe('なし（接地なし）');
    expect(none.get('carry')!.display).toBe('なし（接地なし）');
  });
});

describe('impact diagnostics rows (AC-12)', () => {
  it('shows the impulse, stick/slide, energies, momenta, foot after the impact and warnings', () => {
    const outcome = runKick(INITIAL_KICK_STATE, DEFAULT_PARAMETER_SET);
    if (!outcome.ok) throw new Error(outcome.reason);
    const { impact, warnings } = outcome.result;
    const rows = byKey(diagnosticsRows(impact, warnings));
    expect(rows.get('impulse')!.display).toBe(`${Math.hypot(...impact.impulse).toFixed(3)} N·s`);
    expect(['固着', '滑り', '離反（衝撃なし）']).toContain(rows.get('regime')!.display);
    expect(rows.get('regime')!.si).toBe(impact.regime);
    expect(rows.get('ballEnergy')!.display).toContain('→');
    expect(rows.has('angularMomentum')).toBe(true); // 有限質量の足
    expect(rows.get('warnings')!.display).toBe(warnings.length === 0 ? 'なし' : warnings.map((w) => WARNING_LABELS[w.code]).join('／'));
  });

  it('does not show system momenta for the kinematic (infinite-mass) foot', () => {
    const outcome = runKick({ ...INITIAL_KICK_STATE, footModel: 'kinematic-wall' }, DEFAULT_PARAMETER_SET);
    if (!outcome.ok) throw new Error(outcome.reason);
    const rows = byKey(diagnosticsRows(outcome.result.impact, []));
    expect(rows.get('momentum')!.display).toBe('無限質量の足では定義しない');
    expect(rows.has('angularMomentum')).toBe(false);
  });

  it('labels ΔT by its meaning for each foot model (05 §6.11)', () => {
    const label = (state: typeof INITIAL_KICK_STATE): string => {
      const outcome = runKick(state, DEFAULT_PARAMETER_SET);
      if (!outcome.ok) throw new Error(outcome.reason);
      return byKey(diagnosticsRows(outcome.result.impact, [])).get('energyChange')!.label;
    };
    expect(label(INITIAL_KICK_STATE)).toContain('足とボールの合計');
    expect(label({ ...INITIAL_KICK_STATE, footModel: 'kinematic-wall' })).toContain('足とともに並進する系');
    expect(label({ ...INITIAL_KICK_STATE, footModel: 'kinematic-wall', footAngularVelocity: [0, 0, 5] })).toContain('解釈はない');
  });

  it('lists warnings by their labels', () => {
    const outcome = runKick(INITIAL_KICK_STATE, DEFAULT_PARAMETER_SET);
    if (!outcome.ok) throw new Error(outcome.reason);
    const rows = byKey(diagnosticsRows(outcome.result.impact, [{ stage: 'impact', code: 'energy-increase' }]));
    expect(rows.get('warnings')).toMatchObject({ display: WARNING_LABELS['energy-increase'], si: 'energy-increase' });
  });
});
