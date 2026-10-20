// T1.5-06：結果の出力（AC-14）。出力した JSON を読み戻し、その入力・パラメータ・設定で Core を再実行すると、
// 同じ結果（軌道の全配列がビット単位で一致、衝突・測定値・警告も一致）になること（往復テスト、VER-S01）。
import { simulateKick, type KickInput, type ParameterSet, type SimulationSettings } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { RESULT_SCHEMA, RESULT_SCHEMA_VERSION, resultFileName, toResultJson, type ResultFile } from '../../src/export/result-json';
import { INITIAL_KICK_STATE } from '../../src/kick/kick-state';
import { DEFAULT_PARAMETER_SET } from '../../src/params/default-parameter-set';
import { degToRad } from '../../src/units/units';
import { DEFAULT_SIMULATION_SETTINGS, runKick } from '../../src/simulation/run-kick';

const states = [
  INITIAL_KICK_STATE,
  { ...INITIAL_KICK_STATE, contactDirection: [-0.9, -0.3, 0.3] as const, footElevation: degToRad(25), footAngularVelocity: [0, 3, 0] as const },
  { ...INITIAL_KICK_STATE, footModel: 'kinematic-wall' as const },
];

describe('result file (AC-14)', () => {
  for (const [i, state] of states.entries()) {
    it(`reproduces the same result when Core is run again from the exported input, parameters and settings (case ${i + 1})`, () => {
      const outcome = runKick(state, DEFAULT_PARAMETER_SET, DEFAULT_SIMULATION_SETTINGS);
      if (!outcome.ok) throw new Error(outcome.reason);
      const original = outcome.result;
      const file = JSON.parse(toResultJson(original, new Date('2026-10-20T04:35:12Z'))) as ResultFile;
      expect(file.schema).toBe(RESULT_SCHEMA);
      expect(file.schemaVersion).toBe(RESULT_SCHEMA_VERSION);
      expect(file.units).toBe('SI');
      expect(file.modelVersion).toBe(original.modelVersion);
      expect(file.parameters.ballRadius.confidence).toBe('provisional'); // 確からしさ・出典も出力される
      expect(file.parameters.dragCoefficient.source).toContain('Goff');

      const rerun = simulateKick(file.input as KickInput, file.parameters as ParameterSet, file.settings as SimulationSettings);
      if (!rerun.ok) throw new Error(rerun.error.message);
      const t = rerun.value.trajectory;
      expect(file.result.trajectory.sampleCount).toBe(t.time.length);
      expect(Float64Array.from(file.result.trajectory.time)).toEqual(t.time);
      expect(Float64Array.from(file.result.trajectory.position)).toEqual(t.position);
      expect(Float64Array.from(file.result.trajectory.linearVelocity)).toEqual(t.linearVelocity);
      expect(Float64Array.from(file.result.trajectory.orientation)).toEqual(t.orientation);
      expect(Float64Array.from(file.result.trajectory.angularVelocity)).toEqual(t.angularVelocity);
      expect(file.result.trajectory.events).toEqual(t.events);
      expect(file.result.impact).toEqual(JSON.parse(JSON.stringify(rerun.value.impact)));
      expect(file.result.metrics).toEqual(JSON.parse(JSON.stringify(rerun.value.metrics)));
      expect(file.result.warnings).toEqual(rerun.value.warnings);
    });
  }

  it('names the file after the export time', () => {
    expect(resultFileName(new Date(2026, 9, 20, 4, 35, 12))).toBe('kick-20261020-043512.json');
  });
});
