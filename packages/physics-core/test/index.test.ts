// パッケージの入口（package.json の exports '.'）から実装済みの API を使えること。
import { describe, expect, it } from 'vitest';
import * as core from '../src/index';

describe('package entry point', () => {
  it('exposes the implemented Core API', () => {
    expect(core.MODEL_VERSION).toBe('0.0.0');
    expect(typeof core.vec3.cross).toBe('function');
    expect(typeof core.mat3.inverse).toBe('function');
    expect(typeof core.quat.multiply).toBe('function');
    expect(typeof core.boxInertia).toBe('function');
    expect(typeof core.computeForces).toBe('function');
    expect(typeof core.integrateFixedSteps).toBe('function');
    expect(typeof core.simulateKick).toBe('function');
  });
});
