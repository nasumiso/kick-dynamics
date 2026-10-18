# IV-05-C 接地（バウンド・転がり・停止）の照合

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

一致4件、不一致0件、判断保留1件。バウンドと開始時下向き処理は独立期待値と一致する。転がり/停止を未実装として扱う記載は妥当で、その機能の物理的正しさを承認するものではない。

| ID | 判定 | 前提・期待値・許容誤差・根拠 |
|---|---|---|
| I05-M01 | 一致 | 水平静止地面、球中心y=R、正のm,R,κ、接近。`n=+y,r_B=−Ry`、`u_t=(vx+Rωz,0,vz−Rωx)`、`j_n=(1+e_g)m|v_y|`、固着は `J_t=−κm u_t/(1+κ)`、円錐外なら初期滑り方向の反対へ上限摩擦。D §1〜2・§6.2とbounce/共通solverを照合。B01〜09/B13の10独立例で状態・散逸を実測、各量TOL-A。 |
| I05-M02 | 一致 | 静止地面で `ΔE=−m(1−e²)b²/2+J_t·u_t+(1+κ)|J_t|²/(2κm)≤0`、ωy不変、接触点まわり角運動量保存。D §2.2より符号と単位を独立確認。トップスピンで重心水平速度が増えても全エネルギーは減る。µ=0・e=1極限も整合。離反/零法線速度は無衝撃（継続接触は別問題）。 |
| I05-M03 | 一致 | 05 §8.3：キック後の地面上でvy<0なら開始直後にバウンド。初期B02状態から開始時刻0のstart-on-groundと直後 `(v,ω)=((5/7,1,0),(0,0,−5/7))` を独立分数と比較、TOL-A/イベント厳密。既存テストがbounce自身を期待値にしている点は、この別の独立期待値で補った。 |
| I05-M04 | 一致 | T1.3-08未実装の間は転がり閾値が使われず、小バウンドを見落としうる、という許可範囲のtasks T1.3-07の制約記載。D §5.2の放物線から独立にT=2w/gを導き、T<dtで端点検出が失敗する実例を再現。次節参照。これは明記済み制約で、新たなバウンド閉形式の不一致とはしない。 |
| I05-H01 | 判断保留 | 転がり、停止、移行（VER-G03〜06）はT1.3-08未実装、係数・閾値未決定。`groundBounceHandler`も常にバウンドと明記。モデル形は現在05 §8.2とOQ09に決定済みで、待ちは値であるとの記載は妥当。実装がないためD §3〜4の解析解との数値照合は未実施・承認保留。 |

## 数値結果

D §6.1〜6.2の合成入力 `m=R=1,κ=2/5,e_g=1/2,µ_g=1/5`、位置 `(0,1,0)` を使用した。状態の独立分数は再現コードの表に全成分を収録する。

| ケース | 終端枝 | ΔE期待値 J | ΔE実測 J |
|---|---|---|---|
| B01 純鉛直 | stick | −3/2 | −1.5000000000000004 |
| B02 無回転斜入射 | stick | −23/14 | −1.6428571428571432 |
| B03 高速水平 | slide | −327/100 | −3.27 |
| B04 バックスピン | stick | −29/14 | −2.071428571428572 |
| B05 バックスピン | slide | −267/100 | −2.67 |
| B06 強トップスピン | slide | −267/100 | −2.67 |
| B07 初期純転がり速度 | stick | −3/2 | −1.5000000000000004 |
| B08 3D接線＋鉛直スピン | slide | −387/100 | −3.8700000000000006 |
| B09 円錐境界 | stick | −213/100 | −2.1300000000000003 |
| B13 トップスピン固着 | stick | −23/14 | −1.6428571428571432 |

状態・散逸の各量をTOL-Aで比較した最大絶対残差は `4.440892098500626e-16`。警告は全例なし。非接近vy=0/1の無衝撃も厳密確認した。B01がstickラベルとなるのは終端接線速度零を表し、地面に留まる意味ではない。

開始時下向きB02を真空g=10で飛翔APIへ渡した実測先頭イベントは `{"type":"start-on-ground","time":0,"sampleIndex":0,"projectionEnergy":0,"response":"continue"}`。同時刻の次サンプルをB02の独立分数に照合した。

小バウンドは初期 `h=0,w=0.1 m/s,g=10 m/s²,dt=0.1 s`。独立式 `h(t)=0.1t−5t²` の再接地は `0.02 s`、次の格子点で `h(0.1)=−0.04 m`。ステップ開始h=0のため下降交差の端点条件を満たさず、実測イベントは `max-time` のみ、最終 `t=0.2 s,h=−0.18000000000000005 m`（maxTime=0.15を跨ぐ格子終端）。今回は最大時間処理の照合を目的とせず、再接地なし・貫入という明記済み制約だけを確認した。最大時間を短くするのは該当する小バウンドに至る前までという意味であり、任意入力に対する一般保証ではない。

## 未実装範囲と仕様自体の確認

Dの転がり抵抗Q01は現在「重心の力＋純転がり拘束」へ具体化され、独立導出の減速度 `µ_r g/(1+κ)` と整合する。必要静止摩擦が `κµ_r mg/(1+κ)` で上限超過なら滑りへ戻す方針、ωyを減衰しない方針、停止を保証しない方針、移行をe_g=0の衝突で解いてy=R/vy=0へ置く方針、ステップ終了で厳密不等号の停止を判定する方針は現在の05/06に明記されている。ただし実装がないので、本照合はこれらの実装一致を主張しない。

D §5.3の「二分法右端の貫入残差を補正しない」反例の前提について、許可範囲のtasks T1.2-07と04 §6には現在バウンド前のy=Rへの射影と位置エネルギー診断が記録されている。その旧前提を現実装の不一致として再掲しない。追加参照した05 §7.7も同じ記載だったが、その追加節は判定根拠には含めない。射影後h=0で、重力のみ・e_g>0・閾値が使用されるなら `e_g v_rest ≥ g dt/2` は未省略バウンドのT≥dtの十分条件となる。空力や積分誤差を含む一般保証ではない。現在は閾値自体が未使用なのでM04の制約が残る。

G01「鉛直バウンド」は水平速度零の入射として既存テストも実行している。回転なしでも水平速度非零なら摩擦で水平速度・回転が変わるので、「回転なし」だけを前提に水平成分不変とは一般化しない。単位・極限・符号・回転対称性（水平面内の回転）、Rの相殺は独立Dに整合。e_g=0の継続接触、転がり閾値の値、滑り終了の数値局在化・接地中の空力等の実装判断は未実装範囲であり、無条件の停止保証を追加していない。

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
import {solveGroundBounce,groundBounceHandler} from '/workspace/kick-dynamics/packages/physics-core/src/ground/bounce.ts';
import {simulateFlight,stateAt} from '/workspace/kick-dynamics/packages/physics-core/src/flight/trajectory.ts';
const ball={mass:1,radius:1,inertiaCoefficient:2/5};
const state=(v,w=[0,0,0])=>({position:[0,1,0],orientation:[0,0,0,1],linearVelocity:v,angularVelocity:w});
const coeff={restitution:.5,friction:.2,tangentialSpeedThreshold:1e-9};
let maxResidual=0;
function near(a,b){if(Array.isArray(a)){a.forEach((x,i)=>near(x,b[i]));return;}maxResidual=Math.max(maxResidual,Math.abs(a-b));assert(Math.abs(a-b)<=1e-12+1e-12*Math.abs(b));}
const cases=[
 ['B01',[0,-2,0],[0,0,0],[0,1,0],[0,0,0],-1.5],
 ['B02',[1,-2,0],[0,0,0],[5/7,1,0],[0,0,-5/7],-23/14],
 ['B03',[4,-2,0],[0,0,0],[17/5,1,0],[0,0,-1.5],-327/100],
 ['B04',[1,-2,0],[0,0,1],[3/7,1,0],[0,0,-3/7],-29/14],
 ['B05',[1,-2,0],[0,0,2],[2/5,1,0],[0,0,.5],-267/100],
 ['B06',[1,-2,0],[0,0,-4],[8/5,1,0],[0,0,-2.5],-267/100],
 ['B07',[1,-2,0],[0,0,-1],[1,1,0],[0,0,-1],-1.5],
 ['B08',[3,-2,4],[0,7,0],[66/25,1,88/25],[6/5,7,-9/10],-3.87],
 ['B09',[2.1,-2,0],[0,0,0],[1.5,1,0],[0,0,-1.5],-2.13],
 ['B13',[1,-2,0],[0,0,-2],[9/7,1,0],[0,0,-9/7],-23/14],
];
for(const [id,v,w,ev,ew,dE] of cases){const r=solveGroundBounce(state(v,w),ball,coeff);assert(r.ok);near(r.value.ballAfter.linearVelocity,ev);near(r.value.ballAfter.angularVelocity,ew);near(r.value.diagnostics.kineticEnergyChange,dE);assert.deepEqual(r.value.diagnostics.warnings,[]);console.log(id,r.value.regime,r.value.diagnostics.kineticEnergyChange);}
for(const vy of [0,1]){const r=solveGroundBounce(state([1,vy,0],[0,0,2]),ball,coeff);assert(r.ok);assert.equal(r.value.regime,'separating');assert.deepEqual(r.value.impulse,[0,0,0]);}
const environment={gravity:10,airDensity:1,airViscosity:1,wind:[0,0,0]};
const settings={timeStep:.1,maxTime:.15,eventTimeTolerance:1e-9,forces:{gravity:true,drag:{enabled:false,coefficient:{kind:'constant',value:0}},magnus:{enabled:false,coefficient:{kind:'constant',value:0}},spinDecay:{kind:'none'}},thresholds:{magnus:1e-9,zeroSpeed:1e-6,zeroSpin:1e-6}};
// 05 §8.3 の初回は独立なB02の期待値を直接比較（実装のbounceを期待値に使わない）。
const run=simulateFlight(state([1,-2,0]),ball,environment,settings,groundBounceHandler(ball,coeff));assert(run.ok);const first=run.value.events[0];assert.equal(first.type,'start-on-ground');assert.equal(first.time,0);near(stateAt(run.value,first.sampleIndex+1).linearVelocity,[5/7,1,0]);near(stateAt(run.value,first.sampleIndex+1).angularVelocity,[0,0,-5/7]);console.log('start event',JSON.stringify(first));
// h=0,w=.1,g=10なら滞空時間.02s<dt=.1s。次の格子でh=-.04m。
const small=simulateFlight(state([0,.1,0]),ball,environment,settings,groundBounceHandler(ball,coeff));assert(small.ok);const last=stateAt(small.value,small.value.time.length-1);console.log('short bounce',JSON.stringify(small.value.events),'final height',last.position[1]-1);assert(!small.value.events.some(e=>e.type==='ground-contact'));assert(last.position[1]<1);
console.log('max TOL-A residual',maxResidual);
```

実行：`node --import ./loader.mjs ./verify.mjs`。assertが失敗しなければ上記数値を出力し終了コード0。Nodeの実験的な型消去の警告は結果に影響しない。再現物の内容はこの資料内に収録しており、一時ファイルの存続を必要としない。
