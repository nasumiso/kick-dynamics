// A1-01：空力係数の表 C_D(Re, S)・C_L(Re, S) の案を、文献の読み取り値から組み立てる（spec 004 §3・§7）。
// 実行：node scripts/aero-tables.mjs [json]（引数 json で JSON を出す。省略時は Markdown の表）。依存パッケージなし。
//
// 入力（research §2.2）：
// - L-10（Asai ら 2007）の図の値。Codex が PDF の描画命令から取り出した値（docs/research/readings/a1-01-asai2007-codex.md）。
//   Claude Code の目視の読み取りと ±0.002 以内で一致（Fig. 9）。図の Re は 1 m/s あたり 15 172.4（凡例と 22〜30 m/s から）。
// - L-04（Carré ら 2005）の当てはめの式（Table 2）。Re は文献の定義で、実物大の換算は本文の「Re 90 000 = 6.1 m/s」から 1 m/s あたり 14 754。
//
// 決定（A0-01・A1-01、2026-11-22、人間が承認）：
// - 文献の Re は速さに換算し、モデルの Re（05 §7.6、ρ (2R) / η = 1.225 × 0.2196 / 1.789e-5 ≈ 15 037 / (m/s)）で表を引く。
// - 回転の測定の 2 rev/s の点（各系列の最小の S）は使わない（本文：低い回転数では角速度が不安定）。S = 0 と次の点の間は線形補間。
// - 22〜30 m/s の 5 系列は読み取ったまま使う（平均・平滑化しない）。
// - 回転による C_D の増加を含める。22〜30 m/s 以外の速さでは、増加量 ΔC_D(S) が速さによらないと仮定する（仮置き）。
// - 表の範囲外は端の値（外挿しない、仮置き）。
const MODEL_RE_PER_SPEED = (1.225 * 2 * 0.1098) / 1.789e-5;
const ASAI_RE_PER_SPEED = 15172.4;
const L04_RE_PER_SPEED = 90000 / 6.1;

/** S の格子（表の列）。 */
const S_GRID = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];

// L-10 Fig. 4：Roteiro（32 枚パネル、無回転）の (図の Re × 1e5, C_d)。
const ROTEIRO = [
  [1.209, 0.427], [1.36, 0.437], [1.51, 0.43], [1.661, 0.432], [1.813, 0.398], [1.963, 0.353], [2.113, 0.292], [2.265, 0.206],
  [2.417, 0.138], [2.718, 0.131], [3.018, 0.144], [3.173, 0.151], [3.32, 0.152], [3.474, 0.159], [3.626, 0.162], [3.774, 0.158],
  [3.925, 0.151], [4.075, 0.15], [4.231, 0.151], [4.379, 0.151], [4.532, 0.15], [5.282, 0.15],
];
// L-10 Fig. 9（C_s）と Fig. 8（C_d）：Teamgeist の模型の各速さの (S_p, 値)。最初の点（2 rev/s）を含めて写し、使うときに除く。
const FIG9 = {
  22: [[0.062, 0.153], [0.124, 0.249], [0.187, 0.292], [0.247, 0.307], [0.311, 0.333]],
  24: [[0.055, 0.147], [0.111, 0.265], [0.169, 0.235], [0.227, 0.298], [0.283, 0.295]],
  26: [[0.051, 0.054], [0.105, 0.204], [0.157, 0.241], [0.21, 0.283], [0.262, 0.289]],
  28: [[0.047, 0.04], [0.094, 0.22], [0.146, 0.238], [0.195, 0.269], [0.244, 0.28]],
  30: [[0.042, 0.032], [0.09, 0.175], [0.136, 0.204], [0.18, 0.228], [0.228, 0.24]],
};
const FIG8 = {
  22: [[0.063, 0.182], [0.125, 0.22], [0.188, 0.265], [0.252, 0.257], [0.315, 0.294]],
  24: [[0.048, 0.166], [0.114, 0.237], [0.172, 0.222], [0.23, 0.289], [0.288, 0.285]],
  26: [[0.052, 0.162], [0.106, 0.197], [0.159, 0.234], [0.213, 0.274], [0.265, 0.275]],
  28: [[0.044, 0.162], [0.098, 0.215], [0.146, 0.229], [0.196, 0.256], [0.247, 0.281]],
  30: [[0.045, 0.177], [0.091, 0.183], [0.138, 0.204], [0.183, 0.241], [0.23, 0.256]],
};

/** 折れ線の線形補間。範囲外は端の値。 */
function interp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

/** 無回転の C_d を速さ m/s の関数として（Roteiro）。 */
const roteiroBySpeed = ROTEIRO.map(([re, cd]) => [(re * 1e5) / ASAI_RE_PER_SPEED, cd]);
const cd0 = (speed) => interp(roteiroBySpeed, speed);

/** L-04 の当てはめの式（Re は文献の定義）。 */
function carre(re, sp) {
  const b = 2.39e-5 * re;
  const c = 12150 * Math.exp(-8.22e-5 * re);
  const d = 1.42e-4 * re;
  return 0.35 * (1 - Math.exp(-b * sp)) - c * sp * (1 - Math.exp(-d * sp));
}

const round = (x) => Math.round(x * 1000) / 1000;

// --- C_L(Re, S) ---
// 低い速さ：L-04 の式。式の範囲（Re 9e4〜2.9e5）のうち、どの S でも負にならない Re の行だけを使う。
const L04_RE_ROWS = [1.5e5, 2.0e5, 2.5e5, 2.9e5];
const liftRows = [];
for (const re of L04_RE_ROWS) {
  const speed = re / L04_RE_PER_SPEED;
  const values = S_GRID.map((s) => (s === 0 ? 0 : carre(re, Math.min(s, 0.5))));
  liftRows.push({ speed, source: `L-04 の式（Re ${re / 1e5}e5）`, values, negative: values.some((v) => v < 0) });
}
// 22〜30 m/s：L-10 Fig. 9（2 rev/s の点を除き、S = 0 で 0）。
for (const speed of [22, 24, 26, 28, 30]) {
  const points = [[0, 0], ...FIG9[speed].slice(1)];
  liftRows.push({ speed, source: 'L-10 Fig. 9', values: S_GRID.map((s) => interp(points, s)), negative: false });
}

// --- C_D(Re, S) ---
// 回転による増加 ΔC_D(S)：22〜30 m/s の Fig. 8 から、各速さで C_d(S) − C_d0(速さ) を求め、5 系列で平均する。
const deltaRows = [22, 24, 26, 28, 30].map((speed) => {
  const points = [[0, cd0(speed)], ...FIG8[speed].slice(1)];
  return S_GRID.map((s) => interp(points, s) - cd0(speed));
});
const deltaCd = S_GRID.map((_, j) => deltaRows.reduce((sum, row) => sum + row[j], 0) / deltaRows.length);
const DRAG_SPEEDS = [8, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 35];
const dragRows = DRAG_SPEEDS.map((speed) => {
  if (FIG8[speed]) {
    const points = [[0, cd0(speed)], ...FIG8[speed].slice(1)];
    return { speed, source: 'L-10 Fig. 4（S = 0）・Fig. 8', values: S_GRID.map((s) => interp(points, s)) };
  }
  return { speed, source: 'L-10 Fig. 4 ＋ ΔC_D(S)（仮置き）', values: S_GRID.map((_, j) => cd0(speed) + deltaCd[j]) };
});

const toTable = (rows) => ({
  kind: 'reynolds-spin-table',
  reynolds: rows.map((r) => Math.round(r.speed * MODEL_RE_PER_SPEED)),
  spin: S_GRID,
  values: rows.map((r) => r.values.map(round)),
});

if (process.argv[2] === 'json') {
  console.log(JSON.stringify({ drag: toTable(dragRows), lift: toTable(liftRows) }, null, 2));
} else {
  const header = `| 速さ m/s | モデルの Re | ${S_GRID.map((s) => `S=${s}`).join(' | ')} | 出典 |`;
  const sep = `|${'---|'.repeat(S_GRID.length + 3)}`;
  const line = (r) => `| ${r.speed.toFixed(1)} | ${Math.round(r.speed * MODEL_RE_PER_SPEED)} | ${r.values.map((v) => round(v).toFixed(3)).join(' | ')} | ${r.source} |`;
  console.log(`モデルの Re は 1 m/s あたり ${MODEL_RE_PER_SPEED.toFixed(0)}。\n\n**C_L(Re, S)**\n\n${header}\n${sep}\n${liftRows.map(line).join('\n')}`);
  const neg = liftRows.filter((r) => r.negative);
  if (neg.length) console.log(`\n負の値を含む行：${neg.map((r) => r.source).join('、')}`);
  console.log(`\n**C_D(Re, S)**\n\n${header}\n${sep}\n${dragRows.map(line).join('\n')}`);
  console.log(`\nΔC_D(S)（22〜30 m/s の平均）：${deltaCd.map((v) => round(v).toFixed(3)).join('、')}`);
}
