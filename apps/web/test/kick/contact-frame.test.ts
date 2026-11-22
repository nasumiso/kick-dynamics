// 打点と足の移動方向の関係（spec 003 §3、AC-U02〜AC-U04、AC-U06）。
import type { Vec3 } from '@kick-dynamics/physics-core';
import { buildImpactSetup } from '@kick-dynamics/physics-core';
import { describe, expect, it } from 'vitest';
import {
  clampHitToRange, directionFromHit, directionTowardContact, HIT_LIMIT, hitOffset, limitDirection, onPadSide, PAD_EDGE,
  padFrame, selectableHit, withinHitLimit,
} from '../../src/kick/contact-frame';
import { INITIAL_KICK_STATE, KICK_INPUT_RANGES, toKickInput } from '../../src/kick/kick-state';
import { WORKING_GEOMETRY } from '../../src/params/working-values';
import { anglesToDirection } from '../../src/units/direction';
import { degToRad } from '../../src/units/units';

const range = KICK_INPUT_RANGES.footElevation;
const dot = (x: Vec3, y: Vec3): number => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
const angles = (psiDeg: number, thetaDeg: number) => ({ azimuth: degToRad(psiDeg), elevation: degToRad(thetaDeg) });

/** 方向の格子（ψ −180〜180°、θ −45〜60°） */
const directionGrid = [-180, -120, -60, -15, 0, 30, 90, 150].flatMap((psi) => [-45, -10, 0, 10, 35, 60].map((theta) => angles(psi, theta)));
/** 打点の格子（パッドの縁の内側） */
const hitGrid = [-0.98, -0.6, -0.2, 0, 0.3, 0.7, 0.98].flatMap((a) => [-0.98, -0.5, 0, 0.4, 0.98].map((b) => [a, b] as const))
  .filter(([a, b]) => Math.hypot(a, b) <= PAD_EDGE);

describe('pad frame (horizontal view)', () => {
  it('is orthonormal, horizontal, with r = +z (screen right) and u = up when ψ = 0', () => {
    const { f, r, u } = padFrame(0);
    expect(f).toEqual([1, 0, 0]);
    expect(r[2]).toBeCloseTo(1, 12);
    expect(u).toEqual([0, 1, 0]);
    for (const { azimuth } of directionGrid) {
      const frame = padFrame(azimuth);
      expect(frame.f[1]).toBe(0);
      expect(dot(frame.f, frame.r)).toBeCloseTo(0, 12);
      expect(dot(frame.r, frame.r)).toBeCloseTo(1, 12);
    }
  });

  it('round-trips (a, b) → d → (a, b) and gives a unit d (AC-U03)', () => {
    for (const { azimuth } of directionGrid) {
      const frame = padFrame(azimuth);
      for (const [a, b] of hitGrid) {
        const d = directionFromHit(a, b, frame);
        expect(Math.hypot(...d)).toBeCloseTo(1, 12);
        const [a2, b2] = hitOffset(d, frame);
        expect(a2).toBeCloseTo(a, 12);
        expect(b2).toBeCloseTo(b, 12);
      }
    }
  });

  it('puts the initial contact (behind the ball) at the pad center', () => {
    const [a, b] = hitOffset(INITIAL_KICK_STATE.contactDirection, padFrame(INITIAL_KICK_STATE.footAzimuth));
    expect(a).toBeCloseTo(0, 12);
    expect(b).toBeCloseTo(0, 12);
  });
});

describe('selectable range (AC-U02)', () => {
  it('contains the pad center when the camera looks along the foot direction (V view)', () => {
    for (const dir of directionGrid) expect(selectableHit(0, 0, dir.azimuth, dir)).toBe(true);
  });

  it('makes the foot approach the ball for every selectable or clamped hit, from any camera direction', () => {
    for (const padPsi of [0, 45, 120, 180, -90].map(degToRad)) {
      for (const dir of directionGrid) {
        for (const [a, b] of hitGrid) {
          const hit = clampHitToRange(a, b, padPsi, dir, null);
          if (!hit) continue; // カメラが足の前にあると、選べる点がないことがある
          expect(selectableHit(hit[0], hit[1], padPsi, dir)).toBe(true);
          const d = directionFromHit(hit[0], hit[1], padFrame(padPsi));
          const input = toKickInput({ ...INITIAL_KICK_STATE, contactDirection: d, footAzimuth: dir.azimuth, footElevation: dir.elevation });
          expect(buildImpactSetup(input, WORKING_GEOMETRY).ok).toBe(true);
        }
      }
    }
  });

  it('stops a drag at the edge of the range along the way from the current hit', () => {
    const dir = angles(0, 35);
    expect(clampHitToRange(0.1, -0.2, 0, dir, [0, 0])).toEqual([0.1, -0.2]);
    // θ = 35° では、上の縁は選べない（d·f が −0.31 より大きい）
    expect(selectableHit(0, 0.95, 0, dir)).toBe(false);
    const [a, b] = clampHitToRange(0, 0.95, 0, dir, [0, 0])!;
    expect(a).toBeCloseTo(0, 12);
    expect(b).toBeLessThan(0.95);
    const d = directionFromHit(a, b, padFrame(0));
    expect(dot(d, anglesToDirection(dir))).toBeCloseTo(-Math.sqrt(1 - HIT_LIMIT * HIT_LIMIT), 6);
  });

  it('does not depend on the foot azimuth: the pad shows the camera view', () => {
    // ψ を変えても、同じ接触点の打点は変わらない（パッドの視点はカメラ）
    const d: [number, number, number] = [-0.8, 0.2, 0.3];
    const l = Math.hypot(...d);
    const unit: Vec3 = [d[0] / l, d[1] / l, d[2] / l];
    expect(hitOffset(unit, padFrame(0))).toEqual(hitOffset(unit, padFrame(0)));
    expect(onPadSide(unit, 0)).toBe(true);
    expect(onPadSide(unit, Math.PI)).toBe(false);
  });
});

describe('limit direction (AC-U04)', () => {
  const behind: Vec3 = [-1, 0, 0];

  it('accepts a change inside the limit as is (θ is clamped to its range)', () => {
    expect(limitDirection(angles(0, 10), angles(30, 20), behind, range)).toEqual(angles(30, 20));
    expect(limitDirection(angles(0, 10), angles(0, 80), behind, range).elevation).toBeCloseTo(range.max, 12);
  });

  it('stops at the edge of the limit instead of going outside', () => {
    const result = limitDirection(angles(0, 0), angles(150, 0), behind, range);
    expect(withinHitLimit(behind, anglesToDirection(result))).toBe(true);
    expect(result.azimuth).toBeCloseTo(Math.asin(HIT_LIMIT), 6);
    expect(result.elevation).toBeCloseTo(0, 12);
  });

  it('does not jump over an out-of-range stretch when both ends are in range (Codex review, PR #32)', () => {
    const raw: Vec3 = [-0.211309, -0.906308, 0.365998];
    const l = Math.hypot(...raw);
    const d: Vec3 = [raw[0] / l, raw[1] / l, raw[2] / l];
    const from = angles(165, 40);
    const to = angles(0, 40);
    // 前提：両端は範囲内で、途中（ψ = 120°）は範囲外
    expect(withinHitLimit(d, anglesToDirection(from))).toBe(true);
    expect(withinHitLimit(d, anglesToDirection(to))).toBe(true);
    expect(withinHitLimit(d, anglesToDirection(angles(120, 40)))).toBe(false);
    const result = limitDirection(from, to, d, range);
    expect(withinHitLimit(d, anglesToDirection(result))).toBe(true);
    expect(result.azimuth).toBeGreaterThan(degToRad(120));
    expect(result.azimuth).toBeLessThan(degToRad(165));
    // 端で止まったあと、同じ向きへさらに求めても動かない
    expect(limitDirection(result, to, d, range).azimuth).toBeCloseTo(result.azimuth, 6);
  });

  it('rotates ψ the short way across ±180°', () => {
    const d: Vec3 = [1, 0, 0]; // 足は −x へ動く
    expect(limitDirection(angles(170, 0), angles(-170, 0), d, range)).toEqual(angles(-170, 0));
  });
});

describe('direction toward contact (AC-U06)', () => {
  it('keeps the current direction when it is within the limit', () => {
    expect(directionTowardContact([-1, 0, 0], angles(20, 10), range)).toEqual(angles(20, 10));
  });

  it('pulls the direction inside the limit for any clicked contact point', () => {
    const contacts: Vec3[] = [[1, 0, 0], [0, 0, 1], [0, 1, 0], [0, -1, 0], [0.6, 0.8, 0], [-0.3, -0.9, 0.3]];
    for (const raw of contacts) {
      const l = Math.hypot(...raw);
      const d: Vec3 = [raw[0] / l, raw[1] / l, raw[2] / l];
      for (const current of directionGrid) {
        const result = directionTowardContact(d, current, range);
        expect(withinHitLimit(d, anglesToDirection(result))).toBe(true);
        expect(result.elevation).toBeGreaterThanOrEqual(range.min - 1e-12);
        expect(result.elevation).toBeLessThanOrEqual(range.max + 1e-12);
      }
    }
  });
});
