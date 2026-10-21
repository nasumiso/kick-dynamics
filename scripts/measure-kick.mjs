// キック 1 回の計算時間の計測（tasks T1.5-07、OQ-18・NFR-08 の判断材料）。
//
// 使い方：node scripts/measure-kick.mjs [計測回数（既定 30）]
// - 依存を追加しないため、Node の TypeScript の型の除去（Node 24 は既定で有効）で Lab と Core の .ts を直接読み込む。
//   拡張子のない相対 import は、node:module の registerHooks で .ts に解決する。
// - パラメータは Lab の既定のパラメータセット（05 §10.2 の写し）、設定は Lab の既定の計算設定を使う。
// - 各条件について、最初の 1 回（JIT の最適化前）と、ウォームアップ 10 回の後の計測回数ぶんの中央値・95 パーセンタイル・最大を出す。
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const root = new URL('../', import.meta.url);
const { DEFAULT_PARAMETER_SET } = await import(new URL('apps/web/src/params/default-parameter-set.ts', root).href);
const { DEFAULT_SIMULATION_SETTINGS } = await import(new URL('apps/web/src/simulation/run-kick.ts', root).href);
const { INITIAL_KICK_STATE, toKickInput } = await import(new URL('apps/web/src/kick/kick-state.ts', root).href);
const { simulateKick } = await import(new URL('packages/physics-core/src/index.ts', root).href);

const deg = (x) => (x * Math.PI) / 180;
const runs = Number(process.argv[2] ?? 30);
const settings = DEFAULT_SIMULATION_SETTINGS;

/** 代表的な条件。入力の値は計測のための任意の例で、物理的な根拠はない。 */
const conditions = [
  ['A 初期入力（バウンド＋転がり、最大 20 s）', INITIAL_KICK_STATE, settings],
  ['B 浮き球（25 m/s、仰角 30°）', { ...INITIAL_KICK_STATE, footSpeed: 25, footElevation: deg(30) }, settings],
  ['C 横回転（接触点を横にずらす、25 m/s、仰角 15°）', {
    ...INITIAL_KICK_STATE, contactDirection: [-Math.cos(deg(20)), 0, Math.sin(deg(20))], footSpeed: 25, footElevation: deg(15),
  }, settings],
  ['D 初期入力（最初の接地で終了）', INITIAL_KICK_STATE, { ...settings, ground: 'stop-at-first-contact' }],
  ['E 初期入力（無限質量の足）', { ...INITIAL_KICK_STATE, footModel: 'kinematic-wall' }, settings],
  ['F 初期入力（最大時間 120 s：05 §10.3 の上限）', INITIAL_KICK_STATE, { ...settings, maxTime: 120 }],
  ['G 横回転（C と同じ、最大時間 120 s：停止しないため最も長い）', {
    ...INITIAL_KICK_STATE, contactDirection: [-Math.cos(deg(20)), 0, Math.sin(deg(20))], footSpeed: 25, footElevation: deg(15),
  }, { ...settings, maxTime: 120 }],
];

function run(state, s) {
  const result = simulateKick(toKickInput(state), DEFAULT_PARAMETER_SET, s);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}

const f = (x) => x.toFixed(2);
console.log(`Node ${process.version}、計測回数 ${runs}、Δt = ${DEFAULT_PARAMETER_SET.timeStep.value} s`);
console.log('| 条件 | サンプル数 | 終わり方 | 最初の 1 回 ms | 中央値 ms | 95% ms | 最大 ms |');
console.log('|---|---|---|---|---|---|---|');
for (const [name, state, s] of conditions) {
  const t0 = performance.now();
  const first = run(state, s);
  const cold = performance.now() - t0;
  for (let i = 0; i < 10; i++) run(state, s);
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    run(state, s);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const samples = first.trajectory.time.length;
  const end = first.trajectory.events.at(-1)?.type ?? '—';
  console.log(`| ${name} | ${samples} | ${end} | ${f(cold)} | ${f(quantile(times, 0.5))} | ${f(quantile(times, 0.95))} | ${f(times.at(-1))} |`);
}
