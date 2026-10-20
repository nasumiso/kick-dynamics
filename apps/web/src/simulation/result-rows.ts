// 測定値（05 §9、AC-09）と衝突診断（AC-12）の表示行。値の計算は Core が行い、ここでは表示単位への変換と表示名だけを決める。
// 各行は表示単位の値（km/h・度・rpm など）と、Core の内部単位（SI）の値を併記する（FR-18、AGENTS.md ルール 4）。
import type { ImpactResult, ImpactWarning, KickMetrics, KickWarning, Vec3 } from '@kick-dynamics/physics-core';
import { formatNumber } from '../ui/dom';
import { msToKmh, radPerSecToRpm, radToDeg } from '../units/units';

export interface ResultRow {
  readonly key: string;
  readonly label: string;
  /** 表示単位の値 */
  readonly display: string;
  /** Core の内部単位（SI）の値。表示単位が SI と同じ場合も併記する */
  readonly si: string;
}

const NOT_AVAILABLE = 'なし';

function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function vector(v: Vec3, digits: number): string {
  return `(${v.map((x) => formatNumber(x, digits)).join(', ')})`;
}

function row(key: string, label: string, display: string, si: string): ResultRow {
  return { key, label, display, si };
}

/** 測定値の行（05 §9 の定義どおりに Core が計算した値を、表示単位に変換する）。 */
export function metricsRows(m: KickMetrics): ResultRow[] {
  const rows: ResultRow[] = [
    row('launchSpeed', '初速', `${formatNumber(msToKmh(m.launchSpeed), 1)} km/h`, `${formatNumber(m.launchSpeed, 3)} m/s`),
    row('launchAngle', '打ち出し角（垂直）', `${formatNumber(radToDeg(m.launchAngle), 1)}°`, `${formatNumber(m.launchAngle, 4)} rad`),
    row('launchDirection', '打ち出し方向（水平、右が正）', `${formatNumber(radToDeg(m.launchDirection), 1)}°`, `${formatNumber(m.launchDirection, 4)} rad`),
    row('spinRate', 'スピン量', `${formatNumber(radPerSecToRpm(m.spinRate), 0)} rpm`, `${formatNumber(m.spinRate, 2)} rad/s`),
  ];
  const spin = m.spinComponents;
  const components: Array<[string, string, number | undefined]> = [
    ['spinBack', 'バックスピン（正）／トップスピン（負）', spin?.back],
    ['spinSide', 'サイドスピン（正：マグヌス力が進行方向の左向き）', spin?.side],
    ['spinGyro', 'ジャイロ回転（進行方向の軸まわり）', spin?.gyro],
  ];
  for (const [key, label, value] of components) {
    rows.push(value === undefined
      ? row(key, label, '定義不能（打ち出しが鉛直に近い）', '—')
      : row(key, label, `${formatNumber(radPerSecToRpm(value), 0)} rpm`, `${formatNumber(value, 2)} rad/s`));
  }
  const meters = (key: string, label: string, value: number | null, missing = '接地なし'): ResultRow =>
    value === null ? row(key, label, `${NOT_AVAILABLE}（${missing}）`, '—') : row(key, label, `${formatNumber(value, 2)} m`, `${formatNumber(value, 4)} m`);
  rows.push(
    meters('maxHeight', '最高到達点（ボール中心の高さ）', m.maxHeight),
    m.flightTime === null
      ? row('flightTime', '飛行時間', `${NOT_AVAILABLE}（接地なし）`, '—')
      : row('flightTime', '飛行時間', `${formatNumber(m.flightTime, 2)} s`, `${formatNumber(m.flightTime, 4)} s`),
    meters('carry', 'キャリー', m.carry),
    m.landingPoint === null
      ? row('landingPoint', '着地点 (x, z)', `${NOT_AVAILABLE}（接地なし）`, '—')
      : row('landingPoint', '着地点 (x, z)', `(${formatNumber(m.landingPoint[0], 2)}, ${formatNumber(m.landingPoint[1], 2)}) m`,
        `(${formatNumber(m.landingPoint[0], 4)}, ${formatNumber(m.landingPoint[1], 4)}) m`),
    meters('lateralDeviation', '横ずれ（右が正）', m.lateralDeviation),
    meters('totalDistance', '総距離（停止位置まで）', m.totalDistance, '停止しなかった'),
  );
  return rows;
}

const REGIME_LABELS: Record<ImpactResult['regime'], string> = { stick: '固着', slide: '滑り', separating: '離反（衝撃なし）' };

/** 衝突の警告の表示名（05 §6.8、§6.11）。結果は補正されていない。 */
export const WARNING_LABELS: Record<ImpactWarning, string> = {
  'tangent-direction-approximated': '滑り方向を近似した（接線速度がほぼ 0 で固着解が摩擦円錐の外）',
  'energy-increase': '衝突で運動エネルギーが増えた（ΔT > 0）',
  'slip-reversal': '衝突後に滑りの向きが反転した',
};

/**
 * ΔT = ½ J·(u⁻ + u⁺) の表示名。意味は足のモデルで変わる（05 §6.11）。
 * - 有限質量の足：足とボールの運動エネルギーの合計の変化。
 * - 無限質量の足で ω_A = 0：足とともに並進する系から見たボールの運動エネルギーの変化。
 * - 無限質量の足で ω_A ≠ 0：足に固定した系が慣性系でないため、エネルギー変化としての解釈を与えない（Core と同じく |ω_A| = 0 で判定）。
 */
function energyChangeLabel(impact: ImpactResult): string {
  if (impact.diagnostics.systemMomentum !== null) return '運動エネルギーの変化 ΔT（足とボールの合計、05 §6.11）';
  if (norm(impact.footAfter.angularVelocity) === 0) return 'ΔT（足とともに並進する系から見たボールの運動エネルギーの変化、05 §6.11）';
  return 'ΔT = ½J·(u⁻ + u⁺)（回転する無限質量の足では、エネルギー変化としての解釈はない、05 §6.11）';
}

/** 衝突診断の行（AC-12、spec §5）。 */
export function diagnosticsRows(impact: ImpactResult, warnings: readonly KickWarning[]): ResultRow[] {
  const d = impact.diagnostics;
  const rows: ResultRow[] = [
    row('impulse', '衝撃量 |J|（ボールに加わる）', `${formatNumber(norm(impact.impulse), 3)} N·s`, `${vector(impact.impulse, 3)} N·s`),
    row('regime', '接触の状態', REGIME_LABELS[impact.regime], impact.regime),
    row('ballEnergy', 'ボールの運動エネルギー（衝突前 → 後）',
      `${formatNumber(d.ballKineticEnergyBefore, 2)} → ${formatNumber(d.ballKineticEnergyAfter, 2)} J`,
      `${formatNumber(d.ballKineticEnergyBefore, 4)} → ${formatNumber(d.ballKineticEnergyAfter, 4)} J`),
    row('energyChange', energyChangeLabel(impact), `${formatNumber(d.kineticEnergyChange, 2)} J`, `${formatNumber(d.kineticEnergyChange, 4)} J`),
  ];
  if (d.systemMomentum && d.systemAngularMomentum) {
    rows.push(
      row('momentum', '全運動量 |p|（衝突前 → 後）',
        `${formatNumber(norm(d.systemMomentum.before), 3)} → ${formatNumber(norm(d.systemMomentum.after), 3)} kg·m/s`,
        `${vector(d.systemMomentum.before, 4)} → ${vector(d.systemMomentum.after, 4)} kg·m/s`),
      row('angularMomentum', '接触点まわりの全角運動量 |L|（衝突前 → 後）',
        `${formatNumber(norm(d.systemAngularMomentum.before), 4)} → ${formatNumber(norm(d.systemAngularMomentum.after), 4)} kg·m²/s`,
        `${vector(d.systemAngularMomentum.before, 5)} → ${vector(d.systemAngularMomentum.after, 5)} kg·m²/s`),
    );
  } else {
    rows.push(row('momentum', '全運動量・角運動量', '無限質量の足では定義しない', '—'));
  }
  const footV = impact.footAfter.linearVelocity;
  const footW = impact.footAfter.angularVelocity;
  rows.push(
    row('footVelocity', '衝突後の足の重心速度', `${formatNumber(msToKmh(norm(footV)), 1)} km/h`, `${vector(footV, 3)} m/s`),
    row('footSpin', '衝突後の足の角速度', `${formatNumber(radPerSecToRpm(norm(footW)), 0)} rpm`, `${vector(footW, 3)} rad/s`),
    row('warnings', '警告（結果は補正していない）',
      warnings.length === 0 ? NOT_AVAILABLE : warnings.map((w) => WARNING_LABELS[w.code]).join('／'),
      warnings.length === 0 ? '—' : warnings.map((w) => w.code).join(', ')),
  );
  return rows;
}
