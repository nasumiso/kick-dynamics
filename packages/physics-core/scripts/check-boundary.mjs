// Core の依存境界の検査（docs/04-architecture.md §4、VER-S05）。
// - package.json に dependencies / peerDependencies / optionalDependencies がないこと
// - src/ 配下の import・export・動的 import・require の指定子が相対パスの文字列リテラルだけであること
//   （three、DOM 系のパッケージ、node: 組み込みモジュールなど、外部への参照をすべて禁止する）
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const errors = [];

const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  if (manifest[field] && Object.keys(manifest[field]).length > 0) {
    errors.push(`package.json: ${field} は持たない（ランタイム依存ゼロ）`);
  }
}

const staticPatterns = [
  /\b(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
];
// 動的 import と require は、文字列リテラル（引用符、または ${} を含まないテンプレートリテラル）だけを許す。
// 計算された指定子は行き先を検証できないため、それ自体を違反とする。
const callPattern = /\b(import|require)\s*\(\s*/g;
const literalAtStart = /^(?:'([^'\n]*)'|"([^"\n]*)"|`([^`$]*)`)\s*\)/;

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(?:ts|mts|cts|js|mjs)$/.test(entry.name)) yield path;
  }
}

for (const file of sourceFiles(join(packageRoot, 'src'))) {
  const text = readFileSync(file, 'utf8');
  const where = relative(packageRoot, file);
  const checkSpecifier = (specifier) => {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      errors.push(`${where}: 外部モジュール '${specifier}' を import している`);
    }
  };
  for (const pattern of staticPatterns) {
    for (const match of text.matchAll(pattern)) checkSpecifier(match[1]);
  }
  for (const match of text.matchAll(callPattern)) {
    const literal = text.slice(match.index + match[0].length).match(literalAtStart);
    if (literal) checkSpecifier(literal[1] ?? literal[2] ?? literal[3]);
    else errors.push(`${where}: ${match[1]}() の指定子が文字列リテラルではない（行き先を検証できない）`);
  }
}

if (errors.length > 0) {
  console.error('physics-core の依存境界の検査に失敗しました：');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('physics-core の依存境界の検査に合格しました。');
