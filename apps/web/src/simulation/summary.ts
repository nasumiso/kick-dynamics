// キックの結果の短い要約（T1.5-02）。測定値と衝突診断の詳しい表示は T1.5-04。
import type { KickSimulationResult } from '@kick-dynamics/physics-core';
import { msToKmh } from '../units/units';
import { formatNumber } from '../ui/dom';

const END_LABELS: Record<string, string> = { stop: '停止', 'max-time': '最大時間に到達', 'ground-contact': '接地' };

export function summarize(result: KickSimulationResult): string {
  const { metrics, trajectory } = result;
  const contacts = trajectory.events.filter((e) => e.type === 'ground-contact').length;
  const last = trajectory.events.at(-1);
  const end = last ? (END_LABELS[last.type] ?? last.type) : '—';
  const carry = metrics.carry === null ? '—' : `${formatNumber(metrics.carry, 1)} m`;
  return `初速 ${formatNumber(msToKmh(metrics.launchSpeed), 1)} km/h、キャリー ${carry}、接地 ${contacts} 回、終了：${end}。`
    + (result.warnings.length > 0 ? ` 警告：${result.warnings.map((w) => w.code).join(', ')}` : '');
}
