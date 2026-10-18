import { describe, expect, it } from 'vitest';
import { MODEL_VERSION } from '../src/index';

describe('physics-core', () => {
  it('exports a model version', () => {
    expect(MODEL_VERSION).toBe('0.0.0');
  });
});
