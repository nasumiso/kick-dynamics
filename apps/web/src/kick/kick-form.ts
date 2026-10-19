// キック入力の表示値（km/h・度・mm・rpm）↔ 入力の状態（SI）の変換（AC-04、FR-18）。
import type { FootModel } from '@kick-dynamics/physics-core';
import { degToRad, kmhToMs, msToKmh, radPerSecToRpm, radToDeg, rpmToRadPerSec } from '../units/units';
import type { KickState } from './kick-state';

/** パネルに表示する値（表示単位）。接触点 d はクリックで指定するため含めない。 */
export interface KickFormValues {
  readonly footSpeedKmh: number;
  readonly footAzimuthDeg: number;
  readonly footElevationDeg: number;
  readonly footRollDeg: number;
  readonly contactXmm: number;
  readonly contactYmm: number;
  /** ω_A の各成分 rpm（ワールド座標） */
  readonly footSpinRpm: readonly [number, number, number];
  readonly footModel: FootModel;
}

export function toFormValues(state: KickState): KickFormValues {
  return {
    footSpeedKmh: msToKmh(state.footSpeed),
    footAzimuthDeg: radToDeg(state.footAzimuth),
    footElevationDeg: radToDeg(state.footElevation),
    footRollDeg: radToDeg(state.footRoll),
    contactXmm: state.footContactLocation[0] * 1000,
    contactYmm: state.footContactLocation[1] * 1000,
    footSpinRpm: [
      radPerSecToRpm(state.footAngularVelocity[0]), radPerSecToRpm(state.footAngularVelocity[1]), radPerSecToRpm(state.footAngularVelocity[2]),
    ],
    footModel: state.footModel,
  };
}

/** 表示値を SI に変換して状態に反映する（接触点 d は変えない）。 */
export function applyFormValues(state: KickState, values: KickFormValues): KickState {
  return {
    ...state,
    footSpeed: kmhToMs(values.footSpeedKmh),
    footAzimuth: degToRad(values.footAzimuthDeg),
    footElevation: degToRad(values.footElevationDeg),
    footRoll: degToRad(values.footRollDeg),
    footContactLocation: [values.contactXmm / 1000, values.contactYmm / 1000],
    footAngularVelocity: [
      rpmToRadPerSec(values.footSpinRpm[0]), rpmToRadPerSec(values.footSpinRpm[1]), rpmToRadPerSec(values.footSpinRpm[2]),
    ],
    footModel: values.footModel,
  };
}
