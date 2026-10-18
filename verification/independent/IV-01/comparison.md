# IV-01-C 接触ソルバーの照合

- 作成日：2026-10-18
- 担当：Codex。モデル `gpt-6.1-sol`、推論強度 `medium`（本照合の依頼で明示）。独立導出資料の作成時の `high` とは区別する。
- 対象コミット：`ed0ca2c643a75b0f08d943e7e1394fc82b1610b1`（`origin/feat/m1.3-contact`）。
- 段階：06 §9.2 手順4。コードレビューではない。実装・テスト・正本文書・tasks の修正、差異の解決は行っていない。照合担当はコミットしていない（PR化は親担当）。
- 読んだ範囲：AGENTS.md、docs/ai-workflow.md、04 §6、05 §3・§5・§6・§7.7・§8・§10、06 §3・§4.3・§4.4・§9、research/references-and-open-questions.md、tasks.md、対象の IV-01/02/05 の derivation.md、physics-core の contact/ground/bodies/math と接地の段階API・対応テスト。`apps/`・`tools/`、IV-03/04 の導出・照合資料は根拠に用いていない。
- 範囲逸脱の記録：指定された05の参照範囲は§5・§6・§8・§10だったが、照合担当は追加で§3（記号表の全体、外積行列の単位の確認）と§7.7（節全体、接地前の位置射影・残時間・小バウンド検出制約の確認）を実際に読んだ。また05全体の見出し・検索一致行（§9等）を表示し、行範囲の読み出しには§7.8（出力の一部は省略）・§14の未決定事項も含まれた。§7.8・§14は接地の周辺記述/未決定事項を表示した際の範囲指定によるもので、独立照合のための追加許可は得ていない。これらすべての範囲外の内容は補足観察として区別し、本照合の独立期待値・一致/不一致/保留の判定根拠には用いない。判定は許可された独立導出、対象仕様節、tasks、実装、および独立数値再現に基づく。
- 親担当から受領した全体検査結果：`npm run check` は型検査・依存境界検査・23ファイル186テストが全件合格。これは親担当による実行結果で、照合担当の独立数値再現とは区別する。
- 独立期待値は既存の独立導出の衝撃量収支・解析解から採り、現在の実装式を期待値として転記していない。外部文献・実測データは使用していない。

数値比較は、以下で特記しない限り 06 §3 の **仮置き TOL-A**：`|実装−期待| ≤ 1e-12 + 1e-12 |期待|`。絶対幅は各比較量の SI 単位。大きさ1程度・良条件の合成例に限って使う。分岐・エラー・警告は厳密に比較する。設定値・合成入力は実物の同定値や採用推奨値を意味しない。全体の `npm run check` は親担当のため重複実行せず、下記の独立スクリプトを Node v24.19.0 で実行した。

## 判定一覧

一致8件、不一致0件、判断保留0件。通常の適用域の式・符号・診断は独立導出と一致する。解けない入力は実在し、未試験だったエラー経路も今回通った。モデルの実物への精度、任意の悪条件入力における精度保証は本判定に含めない。

| ID | 判定 | 前提・期待値・許容誤差・根拠 |
|---|---|---|
| I01-M01 | 一致 | 有限の正質量、SPD慣性、共通接触点。`K_i=E/m_i−S(r_i)I_i⁻¹S(r_i)`、`Δu=KJ`、対称正定値。球の固有値は法線 `1/m`、接線 `(1+κ)/(κm)`。独立D §2、§5.12 と `k-matrix.ts`、`k-matrix.test.ts` を照合。下記C例の行列・固有値を再現、TOL-A。 |
| I01-M02 | 一致 | 接近 `u_n<0` だけに Newton 条件 `u_n⁺=−e u_n⁻`。固着候補は `KJ*=−e u_n n−u`、`j_n*≥0` かつ円錐内なら採用。滑りは初期接線方向の反対へ `J_t=−µj_n t`、法線式から分母を導く。D §3・§5.1〜5.6、frictionless/friction テスト。C例の固着/滑り/µ=0を独立分数で実測、TOL-A。離反・零法線速度は厳密に無更新。 |
| I01-M03 | 一致 | `|u_t|≤ε_t` で固着不成立なら `t=−J_t*/|J_t*|` と警告。D §5.14 のC例で足速度を `(0,0,1)`、µ=3/50にすると `J=(18/283,0,300/283)` と近似警告だけが返る。TOL-A/警告厳密。µ=0では滑り方向を使わない分岐で、無意味な近似警告を出さないのは適切。 |
| I01-M04 | 一致 | 解法不能時に状態を返さず `impact-unsolvable` と `u⁻,K,J*` を返す。D §5.15 の正常な面内部の直方体入力で分母 `−6149/7453` を再現（詳細は次節）。入力不変も厳密確認。SPDから滑り分母正とは導けない。`J_t*=0` で近似方向が未定義となる枝は、厳密算術の正規入力では到達しない：法線式から `j_n*=(1+e)q/(nᵀKn)>0`、したがって先に固着する。丸めや不正慣性を使ってこの枝の物理例を捏造しない。 |
| I01-M05 | 一致 | 同一接触点で ±J、位置・姿勢固定。全運動量と任意固定点まわりの軌道＋自転角運動量は保存。`ΔT=J·u⁻+JᵀKJ/2=J·(u⁻+u⁺)/2`、無摩擦なら `−(1−e²)q²/(2nᵀKn)`。D §4・§5.11、diagnostics/frictionless テスト。C例で全エネルギーの直接差と診断が一致、保存則の残差もTOL-A。法線衝撃による球回転は零。 |
| I01-M06 | 一致 | 無限質量側は逆質量・逆慣性がともに零、状態不変、系の運動量診断はnull。D §3.3・§4.4・§5.13 の閉形式・壁の仕事と一致。並進壁の `ΔT` は壁並進系の球エネルギー差。地上系の増加を警告せず、回転壁には並進慣性系の解釈を付けない。kinematic-wall テストの期待値は相対並進速度のエネルギーから独立に構成されている。 |
| I01-M07 | 一致 | 有限質量の連成では代数解のエネルギー増加・反転を許し、補正せず警告。D §5.11 の固着・滑り両例で正の散逸診断値と所定警告を再現。P-28 の2式は実装と一致し、単位もJ/速度で整合。小さい正のΔTが判定幅内なら警告しないことも実測（次節）。C18だけでなく固着側にも増加がありうる。 |
| I01-M08 | 一致 | VER-C11は非連成かつ接線等方、VER-C12は質量と慣性を同倍率に拡大し、境界・零分母から離れる場合に限定。D §3.3・§5.7・§5.9よりC11差は厳密に一次、C12は `K=K_B+K_A/λ` の逆行列展開で一般に `O(1/λ)`。現在の「100倍で差比100±10%」はこの限定域の仮置き判定として妥当。実測比は下記。非一般的な一次項零・差が丸め水準の場合に同比を要求できない。 |

## 独立数値結果と解釈

D §5.0 のC例（球 `m=R=1, κ=2/3`、足 `m=3/2,L=(2,2,2),I=E`、`n=+z,r_A=(1/2,0,1)`、足速度 `(-1/10,0,1)`、e=1）を使用した。全量SI。行列の独立固有値は `53/12,(73±√873)/24`、実数値 `4.416666666666667,1.8105594414421535,4.2727738918911795` ですべて正。

| µ | 終端枝 | 衝撃量Jの実測 `(x,y,z)` N·s | ΔT実測 J | 独立期待値 | 警告 |
|---|---|---|---|---|---|
| 1/5 | stick | `(0.1044883303411131,0,1.0707360861759423)` | 0.005224416517055364 | `J=(291/2785,0,2982/2785), ΔT=291/55700` | energy-increase |
| 1/20 | slide | `(-0.051502145922746795,0,1.0300429184549358)` | 0.013638121903148203 | `J=(-12/233,0,240/233), ΔT=3702/271445` | energy-increase, slip-reversal |
| 0 | slide | `(0,0,1.0434782608695652)` | 0 | `J=(0,0,24/23)` | なし |

各例の `u_n⁺=1`、運動量・角運動量保存、全エネルギー差も確認。独立期待値をassertした全項目の最大絶対残差は `8.881784197001252e-16`。この値は異なる物理量を混ぜた許容幅ではなく、各量別にTOL-A合格を確認した後の参考最大値。

解法不能例は `m_A=1/2,L=(1/5,8,1/2),r_A=(-1/20,15/4,1/4)`、足速度 `(-50,250,1)`、e=1、µ=`10√26/3`。法線・姿勢は +z/恒等姿勢。面内部条件 `|−1/20|<1/10,15/4<4` を満たす。極端な合成入力であり通常の足の値とは区別する。独立導出の `J*` 区間は `−4<J_x*<−3,55<J_y*<56,3<J_z*<3.1`。実測は `(-3.815229294543333,55.54902357627947,3.0024007453492967)`、円錐外。滑り分母 `−0.8250368978934652` は厳密 `−6149/7453` と一致し、エラーのdetailsには3診断量があり、衝突後状態はない。元入力のJSONも同一だった。実装テストに未収録なのは試験網羅の残項であり、本照合では正しいエラーを確認できた。

C11のW例（球同上、壁速度 `(-1,0,1)`、e=1/2、µc=4/15）では、境界相対幅 `1e-3→1e-5` の速度差比 `99.99999999991674`、µ=`1e-3→1e-5` の無摩擦との差比 `99.99999999999999`。C12では同じ壁入力でµ=0.05/1の滑り/固着を用い、足をλ=100/10000へ拡大。速度差比は `99.34437086092646 / 99.34437086090463`、角速度差比は `99.34437086078026 / 99.34437086059735`。速度・角速度を別々に比較した。実装側C12は両者のノルムをまとめているため、その絶対値に単一のSI単位は付けられないが、固定尺度での収束比の補助判定としては使える。今回の別々の測定で一方の不収束が隠れる懸念を補った。

P-28についてC例の初期接線速度を `w=1e-10/1e-7 m/s` に変更し、µ=1/5の固着を使った。前者は `ΔT=6.462907470485887e-12 J`、幅 `1.0849273949218337e-9 J`、警告なし。後者は `ΔT=6.46319416420422e-9 J`、幅 `1.0849273855621562e-9 J`、増加警告あり。反転幅 `−1e-9|u⁻|` もコードとP-28を直接照合し、滑りC例では射影 `−1467/2330 m/s` が明確に幅を超える。加えて初期接線方向を `t=(3/5,4/5,0)` とし、µ=1/20、C例の足の接触点速度を `(-3W/5,-4W/5,1)` とした。独立に `a=23/12,d=−3/10,c=649/150` なので `j_n=1200/1159`、終端接線射影は `W−3098/5795`。`W=3098/5795−1e-10` なら実測射影 `−9.999998051846148e-11 m/s`、幅 `1.1339293930255804e-9 m/s`、警告なし。`W=3098/5795−1e-7` なら射影 `−9.999999991960884e-8 m/s`、幅 `1.1339293459270433e-9 m/s`、slip-reversalあり。両者とも固着に切り替わらずslideであることをassertした。これでエネルギーと反転の両方の判定幅内/外を再現した。境界を丸めで跨ぐ入力の一律な厳密分類は主張しない。

## 仕様自体・導出時の疑義

Kはkg⁻¹、Jはkg·m/s、KJはm/s。`S(r)`はmなので `S I⁻¹ S` はkg⁻¹、追加参照した05 §3の外積行列の単位は現在「aの単位」と記載されていたが、この記載自体は判定根拠に含めない。単位の判定根拠は独立導出§2.1の次元解析である。κ・µ・e・P28は無次元。半径を変えた球のKのR相殺、一次元・弾性・無摩擦・無限質量極限、適正回転で `K′=QKQᵀ` の対称性も独立導出に整合する。`m_eff,n` は足のみの `1/(nᵀK_A n)` で二体換算質量とは異なる。

D §6の疑義Q1（壁のエネルギー）、Q2（連成境界の不連続）、Q3（終端ラベルとエネルギー増加）、Q4（エラー/閾値）、Q5（接線等方条件）、Q6（重心を通る総衝撃量）、Q7（値・単位）は現在の05/06の限定・注記によって扱われている。小さい正の分母、極端な慣性条件数、物性の現実的な有効範囲は未指定で、倍精度で任意のSPD入力に一様な精度を保証する判定はしていない。これは適用域の留保であり、今回確認した式の不一致を意味しない。

## 完全再現コード

Node 24で、リポジトリを `/workspace/kick-dynamics` に置いた状態から実行する（別の場所なら下記importの絶対パスだけ置換）。ランタイム依存の追加なし。ローダーはTypeScriptの型消去と拡張子なし内部importの解決だけを行い、物理計算を変更しない。以下2ファイルを任意の一時ディレクトリへ保存する。

`loader.mjs`:

```js
import {registerHooks, stripTypeScriptTypes} from 'node:module';
import {readFileSync, existsSync} from 'node:fs';
registerHooks({
 resolve(s,c,next){if(s.startsWith('.') && c.parentURL?.endsWith('.ts')) {const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return {url:u.href,shortCircuit:true};}return next(s,c);},
 load(u,c,next){if(u.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8')),shortCircuit:true};return next(u,c);}
});
```

`verify.mjs`:

```js
import assert from 'node:assert/strict';
import {buildImpactSetup} from '/workspace/kick-dynamics/packages/physics-core/src/contact/setup.ts';
import {solveImpact} from '/workspace/kick-dynamics/packages/physics-core/src/contact/solver.ts';
import {contactMatrix,finiteInertia,ballContactMatrix} from '/workspace/kick-dynamics/packages/physics-core/src/contact/k-matrix.ts';
import {boxInertia,ballInertia,kineticEnergy} from '/workspace/kick-dynamics/packages/physics-core/src/bodies/dynamics.ts';
const ball={mass:1,radius:1,inertiaCoefficient:2/3};
const mkFoot=(mass,dimensions)=>({mass,shape:{kind:'box',dimensions},inertiaBody:boxInertia(mass,dimensions)});
const foot=mkFoot(1.5,[2,2,2]);
const base={contactDirection:[0,0,-1],footRollAboutNormal:0,footContactLocation:[.5,0],footContactPointVelocity:[-.1,0,1],footAngularVelocity:[0,0,0],footModel:'finite-mass'};
const setup=(input=base,f=foot)=>{const r=buildImpactSetup(input,{ball,foot:f,rollReferenceThreshold:1e-6});assert(r.ok);return r.value;};
const solve=(s,mu,e=1,f=foot,model='finite-mass')=>solveImpact(s,{ball,foot:f,restitution:e,friction:mu,tangentialSpeedThreshold:1e-9},model);
let maxResidual=0;
function near(a,b){if(Array.isArray(a)){a.forEach((x,i)=>near(x,b[i]));return;}const r=Math.abs(a-b);maxResidual=Math.max(maxResidual,r);assert(r<=1e-12+1e-12*Math.abs(b),`${a} != ${b}`);}
const s=setup();
const K=contactMatrix(finiteInertia(foot.mass,foot.inertiaBody),[.5,0,1],finiteInertia(1,ballInertia(ball)),[0,0,-1]);
near(K,[25/6,0,-.5,0,53/12,0,-.5,0,23/12]);
near(ballContactMatrix(ball,[0,0,1]),[2.5,0,0,0,2.5,0,0,0,1]);
console.log('K eigenvalues',53/12,(73-Math.sqrt(873))/24,(73+Math.sqrt(873))/24);
for(const [mu,J,dE,warning] of [[.2,[291/2785,0,2982/2785],291/55700,['energy-increase']],[.05,[-12/233,0,240/233],3702/271445,['energy-increase','slip-reversal']],[0,[0,0,24/23],0,[]]]){
 const r=solve(s,mu);assert(r.ok);const a=r.value,d=a.diagnostics;
 near(a.impulse,J);near(d.kineticEnergyChange,dE);near(d.relativeVelocityAfter[2],1);assert.deepEqual(d.warnings,warning);
 near(d.systemMomentum.before,d.systemMomentum.after);near(d.systemAngularMomentum.before,d.systemAngularMomentum.after);
 const E=(b,f)=>kineticEnergy({mass:1,inertiaWorld:ballInertia(ball)},b)+kineticEnergy({mass:foot.mass,inertiaWorld:foot.inertiaBody},f);
 near(E(a.ballAfter,a.footAfter)-E(s.ball,s.foot),dE);
 console.log('C',mu,a.regime,a.impulse,d.kineticEnergyChange,d.warnings);
}
const approx=solve(setup({...base,footContactPointVelocity:[0,0,1]}),3/50);assert(approx.ok);near(approx.value.impulse,[18/283,0,300/283]);assert.deepEqual(approx.value.diagnostics.warnings,['tangent-direction-approximated']);
const ef=mkFoot(.5,[.2,8,.5]);const es=setup({...base,footContactLocation:[-.05,3.75],footContactPointVelocity:[-50,250,1]},ef);const before=JSON.stringify(es);
const error=solve(es,10*Math.sqrt(26)/3,1,ef);assert(!error.ok);assert.equal(error.error.code,'impact-unsolvable');assert.equal(JSON.stringify(es),before);console.log('error',JSON.stringify(error));
const wallSetup=setup({...base,footContactLocation:[0,0],footContactPointVelocity:[-1,0,1]});
const wall=(mu)=>{const r=solve(wallSetup,mu,.5,foot,'kinematic-wall');assert(r.ok);assert.deepEqual(r.value.footAfter,wallSetup.foot);return r.value;};
for(const mu of [.1,.5]){const r=wall(mu);near(r.impulse,[-Math.min(.4,1.5*mu),0,1.5]);near(r.diagnostics.kineticEnergyChange,-3/8-(mu<4/15?1.5*mu-2.8125*mu*mu:.2));assert.deepEqual(r.diagnostics.warnings,[]);assert.equal(r.diagnostics.systemMomentum,null);}
const dist=(a,b,key)=>Math.hypot(...a[key].map((x,i)=>x-b[key][i]));
const jump=(d)=>dist(wall((4/15)*(1-d)).ballAfter,wall((4/15)*(1+d)).ballAfter,'linearVelocity');
const zero=(mu)=>dist(wall(mu).ballAfter,wall(0).ballAfter,'linearVelocity');
console.log('C11 ratios',jump(1e-3)/jump(1e-5),zero(1e-3)/zero(1e-5));
for(const mu of [.05,1]){const w=wall(mu);const gaps=(lambda)=>{const f=mkFoot(1.5*lambda,[2,2,2]);const r=solve(wallSetup,mu,.5,f);assert(r.ok);return ['linearVelocity','angularVelocity'].map(k=>dist(r.value.ballAfter,w.ballAfter,k));};const a=gaps(100),b=gaps(10000);console.log('C12 separate velocity/spin gaps',mu,a,b,a.map((x,i)=>x/b[i]));}
for(const v of [[0,0,-1],[0,0,0]]){const changed={...s,foot:{...s.foot,linearVelocity:v}};const r=solve(changed,.2);assert(r.ok);assert.equal(r.value.regime,'separating');assert.deepEqual(r.value.impulse,[0,0,0]);assert.deepEqual(r.value.ballAfter,changed.ball);assert.deepEqual(r.value.footAfter,changed.foot);}
console.log('max TOL-A residual',maxResidual);
for(const w of [1e-10,1e-7]){const r=solve(setup({...base,footContactPointVelocity:[-w,0,1]}),.2);assert(r.ok);const d=r.value.diagnostics;const norm=x=>Math.hypot(...x);const scale=.5*norm(r.value.impulse)*(norm(d.relativeVelocityBefore)+norm(d.relativeVelocityAfter));assert.equal(d.warnings.includes('energy-increase'),d.kineticEnergyChange>1e-9*scale);console.log('P28',w,d.kineticEnergyChange,1e-9*scale,d.warnings);}
// P28の滑り射影の幅。接線t=(3/5,4/5,0)はKの固有方向ではない。
// a=23/12,d=t·b=−3/10,c=tᵀCt=649/150,µ=1/20。
// jn=1200/1159、射影零となる初期速さW0=3098/5795。
for(const target of [-1e-10,-1e-7]){const W=3098/5795+target;const r=solve(setup({...base,footContactPointVelocity:[-.6*W,-.8*W,1]}),.05);assert(r.ok);assert.equal(r.value.regime,'slide');const d=r.value.diagnostics;const projection=.6*d.relativeVelocityAfter[0]+.8*d.relativeVelocityAfter[1];near(projection,target);const width=1e-9*Math.hypot(...d.relativeVelocityBefore);assert.equal(d.warnings.includes('slip-reversal'),projection < -width);console.log('P28 reversal',target,projection,width,d.warnings);}
```

実行：`node --import ./loader.mjs ./verify.mjs`。assertが失敗しなければ上記数値を出力し終了コード0。Nodeの実験的な型消去の警告は結果に影響しない。再現物の内容はこの資料内に収録しており、一時ファイルの存続を必要としない。
