// キック入力パネル（AC-04、T1.4-07）。表示単位（km/h・度・mm・rpm）で入力し、SI への変換は kick-form.ts で行う。
// 範囲は UI の試作用の暫定値（kick-state.ts の KICK_INPUT_RANGES）。
import type { FootModel } from '@kick-dynamics/physics-core';
import type { KickFormValues } from '../kick/kick-form';
import { KICK_INPUT_RANGES } from '../kick/kick-state';
import { WORKING_FOOT } from '../params/working-values';
import { msToKmh, radPerSecToRpm, radToDeg } from '../units/units';
import { element, formatNumber, section } from './dom';

export interface KickPanel {
  readonly root: HTMLElement;
  /** 入力の妥当性の表示（Core の buildImpactSetup の結果） */
  readonly showStatus: (message: string, ok: boolean) => void;
}

interface SliderSpec {
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  /** 'any' は刻みなし（端点を丸めずに入力できる） */
  readonly step: number | 'any';
  readonly digits: number;
  readonly testId: string;
}

/** スライダーと数値欄の組。どちらを操作しても同じ値になる。 */
function slider(spec: SliderSpec, initial: number, onInput: (value: number) => void): HTMLElement {
  const attrs = { min: String(spec.min), max: String(spec.max), step: String(spec.step) };
  const range = element('input', { type: 'range', ...attrs });
  const number = element('input', { type: 'number', class: 'number', 'data-testid': spec.testId, ...attrs });
  const set = (value: number): void => {
    range.value = String(value);
    number.value = formatNumber(value, spec.digits);
  };
  set(initial);
  range.addEventListener('input', () => {
    set(Number(range.value));
    onInput(Number(range.value));
  });
  number.addEventListener('change', () => {
    const value = Math.min(spec.max, Math.max(spec.min, Number(number.value)));
    if (!Number.isFinite(value)) return set(Number(range.value));
    set(value);
    onInput(value);
  });
  return element('label', { class: 'slider-row' }, element('span', { class: 'slider-label' }, spec.label), range, number, element('span', { class: 'unit' }, spec.unit));
}

export function createKickPanel(initial: KickFormValues, onChange: (values: KickFormValues) => void): KickPanel {
  let values = initial;
  const showSpeedMs = (): void => {
    speedMs.textContent = `= ${formatNumber(values.footSpeedKmh / 3.6, 2)} m/s`;
  };
  const update = (patch: Partial<KickFormValues>): void => {
    values = { ...values, ...patch };
    showSpeedMs();
    onChange(values);
  };
  const r = KICK_INPUT_RANGES;
  const [lx, ly] = WORKING_FOOT.shape.dimensions;
  // 接触位置は接触面の内側（|s_x| < L_x/2、|s_y| < L_y/2、05 §6.2）。境界は含まないため 1 mm 内側までとする。
  const sxMax = lx * 500 - 1;
  const syMax = ly * 500 - 1;
  // 端点（±50 rad/s）を丸めずに入力できるよう、rpm の範囲は換算値のまま使い、刻みを設けない。
  const spinMax = radPerSecToRpm(r.footAngularVelocity.max);

  const speedMs = element('span', { class: 'hint' });
  const status = element('p', { class: 'status', 'data-testid': 'kick-status' });
  const modelSelect = element('select', { 'data-testid': 'foot-model' },
    element('option', { value: 'finite-mass' }, '有限質量（足の質量・慣性を考慮）'),
    element('option', { value: 'kinematic-wall' }, '無限質量（足の速度は変わらない）'));
  modelSelect.value = values.footModel;
  modelSelect.addEventListener('change', () => update({ footModel: modelSelect.value as FootModel }));

  const spinRows = (['x', 'y', 'z'] as const).map((axis, i) => slider(
    { label: `ω_A ${axis}`, unit: 'rpm', min: -spinMax, max: spinMax, step: 'any', digits: 1, testId: `foot-spin-${axis}` },
    values.footSpinRpm[i]!,
    (v) => {
      const spin = [...values.footSpinRpm] as [number, number, number];
      spin[i] = v;
      update({ footSpinRpm: spin });
    },
  ));

  const root = section('キック入力',
    slider({ label: '足の速さ', unit: 'km/h', min: msToKmh(r.footSpeed.min), max: msToKmh(r.footSpeed.max), step: 1, digits: 0, testId: 'foot-speed' },
      values.footSpeedKmh, (v) => update({ footSpeedKmh: v })),
    speedMs,
    element('p', { class: 'hint' }, '足の移動方向（接触点での足の速度 v_A^p の向き。3D ビューの矢印：緑 = ボールへ近づく、赤 = 離れる）'),
    slider({ label: '移動 方位角 ψ', unit: '°', min: radToDeg(r.footAzimuth.min), max: radToDeg(r.footAzimuth.max), step: 1, digits: 0, testId: 'foot-azimuth' },
      values.footAzimuthDeg, (v) => update({ footAzimuthDeg: v })),
    slider({ label: '移動 仰角 θ', unit: '°', min: radToDeg(r.footElevation.min), max: radToDeg(r.footElevation.max), step: 1, digits: 0, testId: 'foot-elevation' },
      values.footElevationDeg, (v) => update({ footElevationDeg: v })),
    slider({ label: '足の回転 φ', unit: '°', min: radToDeg(r.footRoll.min), max: radToDeg(r.footRoll.max), step: 1, digits: 0, testId: 'foot-roll' },
      values.footRollDeg, (v) => update({ footRollDeg: v })),
    slider({ label: '接触位置 s_x', unit: 'mm', min: -sxMax, max: sxMax, step: 1, digits: 0, testId: 'contact-x' },
      values.contactXmm, (v) => update({ contactXmm: v })),
    slider({ label: '接触位置 s_y', unit: 'mm', min: -syMax, max: syMax, step: 1, digits: 0, testId: 'contact-y' },
      values.contactYmm, (v) => update({ contactYmm: v })),
    element('label', { class: 'slider-row' }, element('span', { class: 'slider-label' }, '足モデル'), modelSelect),
    element('details', {}, element('summary', {}, '詳細：足の角速度 ω_A（ワールド座標、既定 0）'), ...spinRows),
    element('p', { class: 'hint' }, '足の速さ・方向は接触点での足の速度 v_A^p（05 §6.2）。範囲は試作用の暫定値です。'),
    status,
  );
  showSpeedMs();
  return {
    root,
    showStatus: (message, ok) => {
      status.textContent = message;
      status.className = ok ? 'status ok' : 'status error';
    },
  };
}
