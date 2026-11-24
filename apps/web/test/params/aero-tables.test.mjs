// 05 §10.4 の表：Lab の既定（src/params/aero-tables.ts）が scripts/aero-tables.mjs の出力と一致すること（A3-03）。
// Node の API（子プロセス）を使うため .mjs で書く（Lab の型検査は DOM 向けで Node の型を持たない。依存を増やさないため）。
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reynoldsSpinTableError } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import { DRAG_TABLE, LIFT_TABLE } from '../../src/params/aero-tables';

const script = fileURLToPath(new URL('../../../../scripts/aero-tables.mjs', import.meta.url));

describe('aero coefficient tables (05 §10.4)', () => {
  it('match the output of scripts/aero-tables.mjs', () => {
    const generated = JSON.parse(execFileSync(process.execPath, [script, 'json']).toString());
    expect(DRAG_TABLE).toEqual(generated.drag);
    expect(LIFT_TABLE).toEqual(generated.lift);
  });

  it('are valid tables (C_D non-negative)', () => {
    expect(reynoldsSpinTableError(DRAG_TABLE, true)).toBeNull();
    expect(reynoldsSpinTableError(LIFT_TABLE, false)).toBeNull();
  });
});
