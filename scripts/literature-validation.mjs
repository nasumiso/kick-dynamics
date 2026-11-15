// V1（文献による妥当性確認）の掃引と感度解析（specs/002-literature-validation、V2-01）。
//
// 使い方：node scripts/literature-validation.mjs [節の番号 ...]（省略時はすべて）
// - 依存を追加しないため、scripts/measure-kick.mjs と同じ方法（Node の型の除去と registerHooks）で Lab と Core の .ts を読み込む。
// - パラメータは Lab の既定のパラメータセット（05 §10.2 の写し）、設定は Lab の既定の計算設定を使う。
// - 入力の値は掃引のための任意の例で、物理的な根拠はない。出力はモデルの挙動の記録で、実測との比較ではない。
// - 結果は Markdown の表で標準出力に書く。
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const coreEntry = new URL('packages/physics-core/src/index.ts', root).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@kick-dynamics/physics-core') return nextResolve(coreEntry, context);
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { DEFAULT_PARAMETER_SET: P } = await import(new URL('apps/web/src/params/default-parameter-set.ts', root).href);
const { DEFAULT_SIMULATION_SETTINGS: S } = await import(new URL('apps/web/src/simulation/run-kick.ts', root).href);
const { INITIAL_KICK_STATE: K0, toKickInput } = await import(new URL('apps/web/src/kick/kick-state.ts', root).href);
const { simulateKick, boxInertia, MODEL_VERSION } = await import(coreEntry);

const deg = (x) => (x * Math.PI) / 180;
const toDeg = (x) => (x * 180) / Math.PI;
const toRpm = (w) => (w * 60) / (2 * Math.PI);
const f = (x, n = 2) => (x === null || x === undefined ? '—' : Number(x).toFixed(n));

/** ボール中心 → 接触点の向き d。az：右（+z）へのずれ（度）、el：上（+y）へのずれ（度）。0, 0 はボールの真後ろ（−x）。 */
function contactAt(az, el) {
  return [-Math.cos(deg(el)) * Math.cos(deg(az)), Math.sin(deg(el)), Math.cos(deg(el)) * Math.sin(deg(az))];
}

/** パラメータセットの 1 つの値を置き換える（確からしさ・出典は元のまま。掃引の用途に限る）。 */
function withParam(id, value, base = P) {
  return { ...base, [id]: { ...base[id], value } };
}

function run(state, params = P, settings = S) {
  const result = simulateKick(toKickInput(state), params, settings);
  return result.ok ? { ok: true, value: result.value } : { ok: false, code: result.error.code };
}

const COLUMNS = '| 球速 m/s | 球速 / 足速 | 打ち出し角 ° | 方向 ° | 回転 rpm | バック rpm | サイド rpm | キャリー m | 横ずれ m | 衝突 |';
const RULE = '|---|---|---|---|---|---|---|---|---|---|';

function cells(o, footSpeed) {
  if (!o.ok) return `| エラー：${o.code} |||||||||`;
  const m = o.value.metrics;
  const c = m.spinComponents;
  return `| ${f(m.launchSpeed)} | ${f(m.launchSpeed / footSpeed)} | ${f(toDeg(m.launchAngle), 1)} | ${f(toDeg(m.launchDirection), 1)} | ${f(toRpm(m.spinRate), 0)} | ${c ? f(toRpm(c.back), 0) : '—'} | ${c ? f(toRpm(c.side), 0) : '—'} | ${f(m.carry)} | ${f(m.lateralDeviation)} | ${o.value.impact.regime} |`;
}

function table(title, label, rows) {
  console.log(`\n### ${title}\n`);
  console.log(`| ${label} ${COLUMNS}`);
  console.log(`|---${RULE}`);
  for (const [name, state, params, settings] of rows) console.log(`| ${name} ${cells(run(state, params, settings), state.footSpeed)}`);
}

/** 接触点を右へ 20° ずらした例（spec §3、レビュー §2 の基準の条件）。 */
const SIDE20 = { ...K0, footSpeed: 25, footElevation: deg(15), contactDirection: contactAt(20, 0) };

const sections = {
  1: () => table('1. 正面の衝突と足のモデル（真後ろ、足の仰角 10°）', '条件', [
    ...[10, 20, 25, 30].flatMap((v) => [
      [`${v} m/s、有限質量`, { ...K0, footSpeed: v }],
      [`${v} m/s、無限質量`, { ...K0, footSpeed: v, footModel: 'kinematic-wall' }],
    ]),
  ]),
  2: () => table('2. 足の上の接触位置（真後ろ、25 m/s）', '(s_x, s_y) m', [
    ...[-0.12, -0.06, 0, 0.06, 0.12].flatMap((sx) => [-0.04, 0, 0.04].map((sy) => [
      `(${sx}, ${sy})`, { ...K0, footSpeed: 25, footContactLocation: [sx, sy] },
    ])),
  ]),
  3: () => {
    table('3a. 接触点を右へ 20° ずらす：摩擦係数 μ', 'μ', [0, 0.05, 0.1, 0.2, 0.3, 0.5, 1].map((mu) => [`${mu}`, SIDE20, withParam('friction', mu)]));
    table('3b. 同：反発係数 e', 'e', [0.3, 0.5, 0.7, 0.9].map((e) => [`${e}`, SIDE20, withParam('restitution', e)]));
    table('3c. 同：慣性係数 κ', 'κ', [0.4, 0.55, 2 / 3].map((k) => [f(k), SIDE20, withParam('ballInertiaCoefficient', k)]));
    table('3d. 同：法線まわりの足の回転 φ', 'φ °', [-180, -135, -90, -45, 0, 45, 90].map((ph) => [`${ph}`, { ...SIDE20, footRoll: deg(ph) }]));
  },
  4: () => table('4. 接触点の右へのずれ（25 m/s、仰角 15°、μ = 0.5）', 'ずれ °', [
    ...[0, 5, 10, 15, 20, 30, 40, 50, 55, 60, 65, 70, 75, 80].map((az) => [`${az}`, { ...SIDE20, contactDirection: contactAt(az, 0) }]),
  ]),
  5: () => table('5. 接触点を下へずらす（25 m/s、足は水平）', '下へ °', [
    ...[0, -10, -20, -30, -40, -50, -60].map((el) => [`${-el}`, { ...K0, footSpeed: 25, footElevation: 0, contactDirection: contactAt(0, el) }]),
  ]),
  6: () => {
    console.log('\n### 6. 右下を蹴る例（24 m/s）：25 m 先での打ち出しの直線からの曲がり\n');
    console.log('| 右へ ° | 下へ ° | 足の仰角 ° | 球速 m/s | 回転 rpm | 25 m 地点の時刻 s | 高さ m | 横 m | 直線なら 横 m | 曲がり m |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const [az, el, fe] of [[15, -20, 0], [20, -25, 0], [25, -25, 5], [20, -30, 0]]) {
      const o = run({ ...K0, footSpeed: 24, footElevation: deg(fe), contactDirection: contactAt(az, el) });
      if (!o.ok) { console.log(`| ${az} | ${-el} | ${fe} | エラー：${o.code} ||||||`); continue; }
      const { time, position } = o.value.trajectory;
      const m = o.value.metrics;
      let i = 0;
      while (i < time.length && position[3 * i] < 25) i++;
      if (i >= time.length) { console.log(`| ${az} | ${-el} | ${fe} | ${f(m.launchSpeed)} | ${f(toRpm(m.spinRate), 0)} | 25 m に届かない |||||`); continue; }
      const straight = 25 * Math.tan(m.launchDirection);
      const z = position[3 * i + 2];
      console.log(`| ${az} | ${-el} | ${fe} | ${f(m.launchSpeed)} | ${f(toRpm(m.spinRate), 0)} | ${f(time[i])} | ${f(position[3 * i + 1])} | ${f(z)} | ${f(straight)} | ${f(z - straight)} |`);
    }
    console.log('\n25 m 地点は、x が初めて 25 m 以上になったサンプル（Δt ごと）。補間はしていない。');
  },
  7: () => {
    const count = new Map();
    let total = 0;
    const settings = { ...S, ground: 'stop-at-first-contact', maxTime: 5 };
    for (let az = -60; az <= 60; az += 15) for (let el = -60; el <= 30; el += 15) for (const fa of [-20, 0, 20]) for (const fe of [-10, 10, 30])
      for (const ph of [-90, 0, 45]) for (const sx of [-0.1, 0, 0.1]) for (const sy of [-0.04, 0, 0.04]) {
        const state = {
          ...K0, footSpeed: 25, footAzimuth: deg(fa), footElevation: deg(fe), footRoll: deg(ph), footContactLocation: [sx, sy], contactDirection: contactAt(az, el),
        };
        const o = run(state, P, settings);
        total++;
        const key = o.ok
          ? `${o.value.impact.regime}${o.value.impact.diagnostics.warnings.length ? `（警告：${o.value.impact.diagnostics.warnings.join('、')}）` : ''}`
          : `エラー：${o.code}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    console.log('\n### 7. 入力の格子の走査（有限質量、25 m/s、最初の接地で終了）\n');
    console.log('格子：右へのずれ −60〜60°（15° 刻み）× 上下のずれ −60〜30°（15° 刻み）× 足の方位角 −20・0・20° × 足の仰角 −10・10・30° × φ −90・0・45° × s_x −0.1・0・0.1 m × s_y −0.04・0・0.04 m\n');
    console.log('| 結果 | 件数 |');
    console.log('|---|---|');
    for (const [key, n] of [...count].sort((a, b) => b[1] - a[1])) console.log(`| ${key} | ${n} |`);
    console.log(`| 合計 | ${total} |`);
  },
};

/** 足の質量を変える。慣性テンソルは同じ直方体の寸法で計算し直す（05 §5.2）。 */
function withFootMass(mass, base = P) {
  return { ...withParam('footMass', mass, base), footInertiaBody: { ...base.footInertiaBody, value: boxInertia(mass, base.footDimensions.value) } };
}

const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * VAL-01 の比べる量：球速 / 足速と、足の速度の減少率。
 * 足の速度は、衝突前は接触点の速さ |v_A^p|（入力）。衝突後は、足の重心の速さと、接触点（足に固定した点）の速さの 2 通り。
 * 文献（L-01）の足の速度は第 5 中足骨底のマーカーの速度で、モデルのどの点にあたるかは決まらない（spec §5 の対応づけの仮定）。
 */
function val01(state, params) {
  const o = run(state, params, { ...S, ground: 'stop-at-first-contact' });
  if (!o.ok) return { error: o.code };
  const { impact, metrics, input } = o.value;
  const d = input.contactDirection;
  const radius = params.ballRadius.value;
  const contact = add([0, radius, 0], [radius * d[0] / norm(d), radius * d[1] / norm(d), radius * d[2] / norm(d)]);
  const foot = impact.footAfter;
  const contactVelocityAfter = add(foot.linearVelocity, cross(foot.angularVelocity, sub(contact, foot.position)));
  const v0 = state.footSpeed;
  return {
    ratio: metrics.launchSpeed / v0,
    comReduction: 1 - norm(foot.linearVelocity) / v0,
    contactReduction: 1 - norm(contactVelocityAfter) / v0,
    regime: impact.regime,
  };
}

const pct = (x) => `${(100 * x).toFixed(1)}`;

sections[8] = () => {
  const base = { ...K0, footSpeed: 23 };
  console.log('\n### 8. VAL-01：球速 / 足速と足の速度の減少率（真後ろ、足の仰角 10°、23 m/s、足の上の接触位置 (0, 0)）\n');
  console.log('文献（L-01）のインステップ：球速 / 足速 1.41 ± 0.08・1.39 ± 0.02、足の速度の減少率 33.7 ± 2.7 %・34.2 ± 1.4 %（2 名）。');
  console.log('モデルの値は足速によらない（衝突は速度について線形）。減少率は、足の重心の速さと接触点の速さの 2 通り。\n');
  console.log('| 足のモデル | m_A kg | e | 球速 / 足速 | 減少率（重心）% | 減少率（接触点）% | 衝突 |');
  console.log('|---|---|---|---|---|---|---|');
  const line = (label, mass, e, state, params) => {
    const r = val01(state, params);
    console.log(r.error
      ? `| ${label} | ${mass} | ${e} | エラー：${r.error} |||`
      : `| ${label} | ${mass} | ${e} | ${f(r.ratio)} | ${pct(r.comReduction)} | ${pct(r.contactReduction)} | ${r.regime} |`);
  };
  for (const e of [0.3, 0.5, 0.7, 0.9]) line('無限質量', '—', e, { ...base, footModel: 'kinematic-wall' }, withParam('restitution', e));
  for (const mass of [0.8, 1.2, 2, 3, 6]) for (const e of [0.3, 0.5, 0.7, 0.9]) {
    line('有限質量', mass, e, base, withParam('restitution', e, withFootMass(mass)));
  }

  console.log('\n**足の上の接触位置の影響**（m_A = 1.2 kg、e = 0.5）\n');
  console.log('| (s_x, s_y) m | 球速 / 足速 | 減少率（重心）% | 減少率（接触点）% |');
  console.log('|---|---|---|---|');
  for (const [sx, sy] of [[0, 0], [-0.06, 0], [0.06, 0], [0, 0.03], [-0.06, 0.03]]) {
    const r = val01({ ...base, footContactLocation: [sx, sy] }, P);
    console.log(`| (${sx}, ${sy}) | ${f(r.ratio)} | ${pct(r.comReduction)} | ${pct(r.contactReduction)} |`);
  }

  // 1 次元の正面衝突（05 §6.10）で、文献の 2 つの量に合う m_A と e を逆算する（同定の参考。検証ではない）。
  // 球速 / 足速 r = (1 + e) m_A / (m_A + m_B)、減少率 q = (1 + e) m_B / (m_A + m_B) なので、m_A = m_B r / q、1 + e = r (m_A + m_B) / m_A。
  console.log('\n**参考：1 次元の正面衝突（05 §6.10）で、文献の 2 つの量に合う m_A と e**（同定の参考で、検証ではない）\n');
  console.log('| 被験者 | 球速 / 足速 r | 減少率 q | m_A = m_B r / q kg | e = r (m_A + m_B) / m_A − 1 |');
  console.log('|---|---|---|---|---|');
  const mB = P.ballMass.value;
  for (const [name, r, q] of [['A', 1.41, 0.337], ['B', 1.39, 0.342]]) {
    const mA = (mB * r) / q;
    console.log(`| ${name} | ${r} | ${q} | ${f(mA)} | ${f((r * (mA + mB)) / mA - 1)} |`);
  }
};

/**
 * VAL-02 の参考：Asai ら（2002）の FEM 計算と同じ条件。足は水平に +x へ 25 m/s、ボールの赤道上で横に当てる。
 * 当てる位置の横のずれ b（Asai らの offset distance）を、接触点の方位角 az で b = R sin(az) と対応づける（対応づけの仮定）。
 * Asai らの「右」のずれを、モデルの +z（右）へのずれとする。符号の対応は確かめていない。
 */
const RPS = (w) => w / (2 * Math.PI);

function offsetState(b, footSpeed = 25) {
  const radius = P.ballRadius.value;
  const az = toDeg(Math.asin(Math.max(-1, Math.min(1, b / radius))));
  return { ...K0, footSpeed, footElevation: 0, contactDirection: contactAt(az, 0) };
}

sections[9] = () => {
  const models = [
    ['有限質量 1.2 kg', 'finite-mass', withParam('friction', 0.4)],
    ['有限質量 4.0 kg', 'finite-mass', withParam('friction', 0.4, withFootMass(4.0))],
    ['無限質量', 'kinematic-wall', withParam('friction', 0.4)],
  ];
  console.log('\n### 9. VAL-02 の参考：当てる位置の横のずれと回転（足は水平に 25 m/s、μ = 0.4、e = 0.5）\n');
  console.log('Asai ら（2002）の FEM 計算（脚の質量 4.0 kg、μ = 0.4、足速 25 m/s）と同じ条件にそろえた。b = R sin(接触点の方位角)。回転は回転/s（r/s）。\n');
  console.log(`| b mm | 方位角 ° | ${models.map(([n]) => `${n}：球速 m/s・回転 r/s・衝突`).join(' | ')} |`);
  console.log(`|---|---|${models.map(() => '---').join('|')}|`);
  const radius = P.ballRadius.value;
  for (const bmm of [0, 20, 40, 60, 80, 100, 105]) {
    const b = bmm / 1000;
    const az = toDeg(Math.asin(Math.min(1, b / radius)));
    const cellsText = models.map(([, model, params]) => {
      const o = run({ ...offsetState(b), footModel: model }, params, { ...S, ground: 'stop-at-first-contact' });
      if (!o.ok) return `エラー：${o.code}`;
      return `${f(o.value.metrics.launchSpeed, 1)}・${f(RPS(o.value.metrics.spinRate), 1)}・${o.value.impact.regime}`;
    });
    console.log(`| ${bmm} | ${f(az, 1)} | ${cellsText.join(' | ')} |`);
  }
  console.log(`\nR = ${f(radius * 1000, 1)} mm なので、b が R に近づくと接触点は横（方位角 90°）に近づき、足の速度の法線成分が 0 に近づく。`);

  console.log('\n**摩擦係数と回転**（b = 40・80 mm、有限質量 1.2 kg と 4.0 kg）\n');
  console.log('| μ | 1.2 kg、40 mm | 1.2 kg、80 mm | 4.0 kg、40 mm | 4.0 kg、80 mm |');
  console.log('|---|---|---|---|---|');
  for (const mu of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
    const cellsText = [[P, 0.04], [P, 0.08], [withFootMass(4.0), 0.04], [withFootMass(4.0), 0.08]].map(([base, b]) => {
      const o = run(offsetState(b), withParam('friction', mu, base), { ...S, ground: 'stop-at-first-contact' });
      return o.ok ? `${f(RPS(o.value.metrics.spinRate), 1)} r/s（${o.value.impact.regime}）` : `エラー：${o.code}`;
    });
    console.log(`| ${mu} | ${cellsText.join(' | ')} |`);
  }
};

/**
 * VAL-10：空力係数（V2-04）。文献の値は research §2.2（L-04〜L-06）の記録の写しで、ここでは計算に使う式と境目の速さだけを置く。
 * - L-04 の当てはめの式（Carré ら 2005、Table 2）。Re は文献の定義（v D / ν）の値で、適用範囲は 9e4 < Re < 2.9e5、0 < S_p < 0.5。
 * - 抗力危機の速さ（実物大）：L-04 の風洞 6.1〜9.1 m/s（本文の換算）、L-06 の軌道解析 約 12.5 m/s・風洞 約 15 m/s、
 *   L-05 は「約 14 m/s 以上なら C_D を定数とみなせる」。
 */
function carreMagnus(re, sp) {
  const a = 0.35;
  const b = 2.39e-5 * re;
  const c = 12150 * Math.exp(-8.22e-5 * re);
  const d = 1.42e-4 * re;
  return a * (1 - Math.exp(-b * sp)) - c * sp * (1 - Math.exp(-d * sp));
}

const CRISIS_SPEEDS = [
  ['9.1', 9.1, 'L-04 風洞の危機の上端'],
  ['12.5', 12.5, 'L-06 軌道解析の危機'],
  ['15', 15, 'L-06 風洞の危機'],
];

/** 最初の接地までの飛翔の、速さ・S・ω の垂直成分の割合の記録。 */
function flightProfile(o) {
  const { time, linearVelocity: v, angularVelocity: w } = o.value.trajectory;
  const radius = P.ballRadius.value;
  const n = time.length;
  let vmin = Infinity;
  let smin = Infinity;
  let smax = -Infinity;
  let perpMin = Infinity;
  const below = CRISIS_SPEEDS.map(() => 0);
  for (let i = 0; i < n; i++) {
    const vi = [v[3 * i], v[3 * i + 1], v[3 * i + 2]];
    const wi = [w[3 * i], w[3 * i + 1], w[3 * i + 2]];
    const speed = norm(vi);
    const spin = norm(wi);
    vmin = Math.min(vmin, speed);
    const s = (radius * spin) / speed;
    smin = Math.min(smin, s);
    smax = Math.max(smax, s);
    if (spin > 0) perpMin = Math.min(perpMin, norm(cross(wi, vi)) / (spin * speed));
    if (i + 1 < n) {
      const dt = time[i + 1] - time[i];
      CRISIS_SPEEDS.forEach(([, threshold], k) => { if (speed < threshold) below[k] += dt; });
    }
  }
  return { duration: time[n - 1], vmin, smin, smax, perpMin: Number.isFinite(perpMin) ? perpMin : null, below };
}

/** VAL-10 の掃引に使うキックの例（任意の例で、物理的な根拠はない）。 */
const AERO_KICKS = [
  ['正面 20 m/s、仰角 10°（Lab の初期入力）', K0],
  ['下へ 20°、20 m/s、水平', { ...K0, footSpeed: 20, footElevation: 0, contactDirection: contactAt(0, -20) }],
  ['下へ 20°、25 m/s、水平', { ...K0, footSpeed: 25, footElevation: 0, contactDirection: contactAt(0, -20) }],
  ['下へ 20°、30 m/s、水平', { ...K0, footSpeed: 30, footElevation: 0, contactDirection: contactAt(0, -20) }],
  ['下へ 30°、25 m/s、水平（節 5 の例）', { ...K0, footSpeed: 25, footElevation: 0, contactDirection: contactAt(0, -30) }],
  ['下へ 40°、30 m/s、水平', { ...K0, footSpeed: 30, footElevation: 0, contactDirection: contactAt(0, -40) }],
  ['右へ 20°、25 m/s、仰角 15°（節 3 の例）', SIDE20],
  ['右へ 20°・下へ 25°、24 m/s、水平（節 6 の例）', { ...K0, footSpeed: 24, footElevation: 0, contactDirection: contactAt(20, -25) }],
];

sections[10] = () => {
  const rho = P.airDensity.value;
  const eta = P.airViscosity.value;
  const radius = P.ballRadius.value;
  const reOf = (speed) => (rho * speed * 2 * radius) / eta;
  const flight = { ...S, ground: 'stop-at-first-contact' };

  console.log('\n### 10. VAL-10：空力係数（V2-04）\n');
  console.log(`モデルの Re = ρ v (2R) / η（05 §7.6、ρ = ${rho}、η = ${eta}、R = ${f(radius, 4)} m）：1 m/s あたり Re = ${f(reOf(1), 0)}。\n`);
  console.log('**10a. 文献の境目の速さとモデルの Re**\n');
  console.log('| 速さ m/s | モデルの Re | 文献 |');
  console.log('|---|---|---|');
  for (const [speed, label] of [[6.1, 'L-04 風洞の危機の下端（Re 9.0e4、本文の換算）'], [9.1, 'L-04 風洞の危機の上端（Re 1.3e5、本文の換算）'], [12.5, 'L-06 軌道解析の危機（Re 1.7e5）'], [14, 'L-05 C_D を定数とみなせる下限の目安'], [15, 'L-06 風洞の危機（Re 2.0e5）'], [15.6, 'L-05 C_D ≈ 0.17 の下端（Re 2.23e5）'], [19.3, 'L-05 C_D ≈ 0.17 の上端（Re 2.76e5）']]) {
    console.log(`| ${speed} | ${f(reOf(speed), 0)} | ${label} |`);
  }

  console.log('\n**10b. C_L：P-13 の折れ線と L-04 の当てはめの式**（L-04 の Re は文献の定義の値。式の適用範囲は 9e4 < Re < 2.9e5、0 < S_p < 0.5）\n');
  const res = [1.3e5, 1.7e5, 2.1e5, 2.5e5, 2.9e5];
  console.log(`| S | P-13 | ${res.map((re) => `L-04 Re = ${(re / 1e5).toFixed(1)}e5`).join(' | ')} |`);
  console.log(`|---|---|${res.map(() => '---').join('|')}|`);
  const table13 = P.liftCoefficient.value.points;
  const p13 = (s) => {
    for (let i = 1; i < table13.length; i++) {
      const [s0, c0] = table13[i - 1];
      const [s1, c1] = table13[i];
      if (s <= s1) return c0 + ((c1 - c0) * (s - s0)) / (s1 - s0);
    }
    return table13[table13.length - 1][1];
  };
  for (const s of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
    console.log(`| ${s} | ${f(p13(s), 3)} | ${res.map((re) => f(carreMagnus(re, s), 3)).join(' | ')} |`);
  }
  console.log('\nL-04 の式の Re = 9.0e4 の値（S = 0.05・0.1・0.2）：' + [0.05, 0.1, 0.2].map((s) => f(carreMagnus(9e4, s), 3)).join('・') + '（低い Re では第 2 項が大きく、負になる）。');

  console.log('\n**10c. キックの例の飛翔：速さ・S の範囲と、危機より遅い時間**（最初の接地まで、既定のパラメータ）\n');
  console.log(`| 例 | 球速 m/s | 打ち出しの Re | 打ち出しの S | 飛翔中の S | min |ω⊥|/|ω| | 飛翔時間 s | 最小の速さ m/s | ${CRISIS_SPEEDS.map(([l]) => `${l} m/s 未満の時間 s`).join(' | ')} | キャリー m |`);
  console.log(`|---|---|---|---|---|---|---|---|${CRISIS_SPEEDS.map(() => '---').join('|')}|---|`);
  for (const [name, state] of AERO_KICKS) {
    const o = run(state, P, flight);
    if (!o.ok) { console.log(`| ${name} | エラー：${o.code} |`); continue; }
    const m = o.value.metrics;
    const pr = flightProfile(o);
    console.log(`| ${name} | ${f(m.launchSpeed)} | ${f(reOf(m.launchSpeed), 0)} | ${f((radius * m.spinRate) / m.launchSpeed, 3)} | ${f(pr.smin, 3)}〜${f(pr.smax, 3)} | ${pr.perpMin === null ? '—' : f(pr.perpMin, 3)} | ${f(pr.duration)} | ${f(pr.vmin)} | ${pr.below.map((t) => f(t)).join(' | ')} | ${f(m.carry)} |`);
  }
  console.log('\n|ω⊥|/|ω| は、回転のうち速度に垂直な成分の割合の飛翔中の最小値（1 なら S を |ω| と |ω⊥| のどちらで定義しても同じ、05 §7.6）。');

  console.log('\n**10d. C_D を文献の範囲で振ったときのキャリーと横ずれ**（最初の接地まで。C_D 以外は既定）\n');
  const cds = [0.17, 0.2, 0.25, 0.3];
  console.log(`| 例 | ${cds.map((cd) => `C_D = ${cd}：キャリー m・横ずれ m`).join(' | ')} |`);
  console.log(`|---|${cds.map(() => '---').join('|')}|`);
  for (const [name, state] of AERO_KICKS) {
    const cellsText = cds.map((cd) => {
      const o = run(state, withParam('dragCoefficient', cd), flight);
      return o.ok ? `${f(o.value.metrics.carry)}・${f(o.value.metrics.lateralDeviation)}` : `エラー：${o.code}`;
    });
    console.log(`| ${name} | ${cellsText.join(' | ')} |`);
  }

  console.log('\n**10e. C_L を変えたときのキャリーと横ずれ**（P-13 を一律に倍率で変えたもの、L-04 の式の折れ線。最初の接地まで）\n');
  // L-04 の式を、Re を固定して S = 0〜0.5 の 0.05 刻みの折れ線にしたもの（S > 0.5 は 0.5 の値。式の範囲の外への外挿はしない）。
  const carreTable = (re) => ({ kind: 'spin-table', points: Array.from({ length: 11 }, (_, i) => [i * 0.05, i === 0 ? 0 : carreMagnus(re, i * 0.05)]) });
  const variants = [
    ['C_L × 0.5', { kind: 'spin-table', points: table13.map(([s, c]) => [s, 0.5 * c]) }],
    ['P-13（既定）', P.liftCoefficient.value],
    ['C_L × 1.2', { kind: 'spin-table', points: table13.map(([s, c]) => [s, 1.2 * c]) }],
    ['L-04 の式、Re = 2.1e5', carreTable(2.1e5)],
    ['L-04 の式、Re = 2.9e5', carreTable(2.9e5)],
  ];
  console.log(`| 例 | ${variants.map(([n]) => `${n}：キャリー m・横ずれ m`).join(' | ')} |`);
  console.log(`|---|${variants.map(() => '---').join('|')}|`);
  for (const [name, state] of AERO_KICKS) {
    const cellsText = variants.map(([, table]) => {
      const o = run(state, withParam('liftCoefficient', table), flight);
      return o.ok ? `${f(o.value.metrics.carry)}・${f(o.value.metrics.lateralDeviation)}` : `エラー：${o.code}`;
    });
    console.log(`| ${name} | ${cellsText.join(' | ')} |`);
  }
  console.log('\nL-04 の式の折れ線は、Re を 1 つに固定した近似（飛翔中の Re の変化は入れていない）。');
};

const selected = process.argv.slice(2);
console.log(`# V1 の掃引（MODEL_VERSION ${MODEL_VERSION}、Node ${process.version}）`);
console.log('\nパラメータは Lab の既定（05 §10.2）。特記のない入力は Lab の初期入力（spec 001 §4）。球速 / 足速の足速は、接触点での足の速さ |v_A^p|。');
for (const [id, fn] of Object.entries(sections)) if (selected.length === 0 || selected.includes(id)) fn();
