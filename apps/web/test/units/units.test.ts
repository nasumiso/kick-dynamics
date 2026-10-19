// T1.4-04：表示単位の変換（VER-M05）。往復の一致と、定義から直接分かる値との一致。
import { describe, expect, it } from 'vitest';
import { degToRad, kmhToMs, msToKmh, radPerSecToRpm, radToDeg, rpmToRadPerSec } from '../../src/units/units';

const TOL = 1e-12;
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOL + TOL * Math.abs(expected));
}

const samples = [0, 1, -3.5, 27.8, 1e-9, 1234.5678];

describe('VER-M05 display unit conversions', () => {
  it.each([
    ['m/s ↔ km/h', msToKmh, kmhToMs],
    ['rad/s ↔ rpm', radPerSecToRpm, rpmToRadPerSec],
    ['rad ↔ °', radToDeg, degToRad],
  ] as const)('round-trips %s', (_, forward, backward) => {
    for (const x of samples) {
      expectClose(backward(forward(x)), x);
      expectClose(forward(backward(x)), x);
    }
  });

  it('matches values that follow from the definitions', () => {
    expectClose(msToKmh(10), 36);
    expectClose(kmhToMs(100), 250 / 9);
    expectClose(radPerSecToRpm(2 * Math.PI), 60);
    expectClose(rpmToRadPerSec(600), 20 * Math.PI);
    expectClose(radToDeg(Math.PI / 2), 90);
    expectClose(degToRad(180), Math.PI);
  });
});
