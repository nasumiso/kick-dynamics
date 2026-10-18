# IV-03-C 飛翔の力モデルの照合結果

- 実施日：2026-10-18
- 担当：Codex、**gpt-6.1-sol / medium**（docs/ai-workflow.md §2 の指定）
- 対象コミット：`43fa5c81331f67aea4732fe0f8004b67c9a62887`
- 独立基準：[derivation.md](derivation.md) 第2版（`83a79ea` 基準、独立導出時は high）。本書は [06 §9.2](../../../docs/06-validation.md) 手順4であり、手順5の修正・承認ではない。
- 変更は本書と [IV-04 の照合結果](../IV-04/comparison.md) のみ。実装・テスト・正本文書は変更していない。対象外 IV-01/02/05、apps/、tools/ は閲覧していない。

## 1. 結論と判定方法

有効枝の力・トルク、符号、単位、縮退の優先順位、解析解に対する滑らかな区間の収束は一致した。不一致は **F-D01、F-D02 の2件**、判断保留は **F-H01〜F-H06 の6件**。F-D01 は既知限界を採用した判断ではなく、その説明の一般化に対する指摘である。実物の軌道への妥当性（VAL）は実測データ未収集のため評価していない。

以下の A は06 §3 の仮置き `abs=rel=1e-12` を量ごとの単位で適用する。B は位置 m、速度 m/s、角速度 rad/s、四元数の誤差を別々に測り、`p=log2(E_h/E_(h/2))` を使う。正本の `4±0.5` は仮置きのまま扱い、ここで確定しない。分岐、呼出しの有無、軸上の符号は厳密。閾値を横切る区間に通常の4次を要求しない。

## 2. 一致した項目

| ID・判定 | 前提条件・期待値 | 許容誤差 | 根拠と照合結果 |
|---|---|---|---|
| F-A01 一致：重力・抗力 | 有限の物理入力、m,R,I>0、ρ≥0、η>0、CD≥0。Fgは−y、FDは相対速度に反対、FD·u=−(ρA CD/2)U³≤0 | 軸の符号は厳密、力・仕事率はA | 導出§2、05§7.2–7.3。`forces.ts:39–42,95,104–114`。独立T01で合力(−15,16,0) N。FDの kg/m×(m/s)² はN |
| F-A02 一致：マグヌス力 | 有効枝でFM∝ω×u、FM·u=FM·ω=0。+x飛翔、+z/+y/−z回転で+y/−z/−y | 軸の符号・ゼロ成分は厳密、非ゼロ値と直交性はA | 導出§3.1、05§7.4、`forces.ts:54–60`。独立T02は(0,9,0),(0,0,−9),(0,−9,0) N。通常向きはCL>0の場合 |
| F-A03 一致：三種の縮退 | U≤εvではCD/CL/CM、Re/Sを評価しない。重力と線形減衰は残る。K≤εだけでFM=0、W≤εωだけで(c)トルク=0。平行でも抗力とトルクは残る | 分岐・ゼロ・係数呼出しなしは厳密 | 導出§5表、05§7.3–7.5。`forces.ts:56,80,97–108`。独立試験でε=.1 m/s²、εv=.2 m/s、εω=.3 rad/sと異なる値を用いた。K=.1でFM=0、.1001で(0,1,0) N、W=.3でトルク0、.3001で(0,0,−1) N m。K>εかつW≤εωでもFMは残る。低速3ケースでpoison係数の呼出し0 |
| F-A04 一致：Re/Sと係数契約 | Re=ρU(2R)/η、S=RW/U、いずれも無次元。全スピンSの使用、有限負CLの許容は暫定仕様。CD/CM/cωの負値・非有限値はSimResultエラー | 式はA、分岐は厳密 | 導出§4.2・S05、04§6、OQ-07/08、`forces.ts:19–30,65–68,110–114`。有効な関数の定義域・例外契約はF-H04 |
| F-A05 一致：抗力の解析解 | 抗力のみ、k=1 m⁻¹、u0=±1 m/s、T=1 sでu=±.5、x−x0=±ln2。鉛直落下ではg=4、k=1で終端速さ2 m/s、初期下向き速さ1/2/3からの閉形式 | B、平衡の速度はA。静止開始の閾値差はF-H03 | 導出§6.1–6.2、IV-04導出§2.3。独立系列は§4。正負方向で同一の誤差、平衡速さ2は誤差0。上側からの減速も4次 |
| F-A06 一致：マグヌス円運動 | 無風・CL=1>0・ω⊥v、他力なし。B=m=1、V=3、T=π/6で半径1 m、変位(1,1,0)、速度(0,3,0) | B | 導出§6.4、06 F05、`magnus.test.ts` の半径式。独立試験で位置・速度の次数が4へ接近。実装テストの円運動は異なる物性値・20 sを使い、解析根拠は同じODEから独立に得られる |
| F-A07 一致：回転モデル | (a)ω一定、(b)ω=ω0 exp(−cωt/I)、(c)定数CMの切替前はW=W0−a_ct。CM=Sは一定Uの有効枝で指数減衰率BR²U/I | (a)A、(b)(c)B。定数トルクは打切り誤差がゼロとなり次数を主張しない | 導出§4.1・6.5、05§7.5、`integrator.ts` のτ/I。T08/T09/T10実測は§4。線形減衰の専用VER-F13が追加され、導出S06の不足の一部は解決済み |
| F-A08 一致：鏡映・保存と散逸の範囲 | 位置/速度/風はP=diag(1,1,−1)、角速度/トルクはQ=diag(−1,−1,1)。無トルクで回転エネルギー一定、cω,CM≥0で瞬時τ·ω≤0。無風でFMは無仕事 | 代数A、同じ離散写像の対称性はA、解析解の軌道精度はB | 導出§7.3、06 F07/F09、`magnus.test.ts`・`rotation.test.ts`。T12の全力と(c)トルクを鏡映し残差ともに0。ωを極性ベクトル扱いする誤りなし。風があればFM·v=FM·wであり、ワールド系の無仕事へ一般化しない |
| F-A09 一致：定数CMの既知限界 | a_cΔt/W0=1.51、切替付近を大刻みで横切るとRK4段が反転。これは連続モデルの軸反転ではない | 符号は厳密。4次の要求対象外 | 05§7.5(c)、導出§6.5(c)・S02。W0=2、a_c=9でW1=−.013333333333333197 rad/s（比−.0066666667）を再現。検証用として限界を明示し補正をしないという人間の判断は本書で覆さない。実球例 m=.43,R=.11,κ=2/3,ρ=1.225,CM=.01,U=30,Δt=.005 のa_cΔtは.03322645 rad/sで、記載の「約.03」程度という見積もりと整合 |

## 3. 不一致と判断保留

### F-D01 不一致：CM→0だけでは数値的な反転を防げない

**前提条件**：05§7.5(c)の既知限界末尾は「|ω|→0でCM→0となるモデル（例：Sに比例）では起きない」と述べる。一般の関数係数を許す04§6・`CoefficientModel`の有効入力として、検証用の人工的な値 m=R=1、κ=.5（I=.5）、ρ=2/π、η=1、U=3、W0=2、無風・他力なし、CM=S^0.1、εω=1e-6を使った。実物の球の推奨値ではない。

**期待値・実測**：この係数は非負・有限で、W→0ならCM→0。連続有効枝はW′=−aW^0.1、a=18/3^0.1で、正軸のまま `.1285651262110144 s` に閾値へ到達する。Δt=`.20827594879848213 s` の実装1ステップは `ωz=−.04272942391265966 rad/s`。CM→0という極限条件だけで反転しないとする一般命題に反例がある。刻み条件と係数の滑らかさが別途必要であり、定数CMの限界を受け入れた判断とは区別する。CM=Sの線形・一定U・閾値非交差の解析ケースT10は一致している。

**許容誤差・根拠**：軸の符号は厳密。これは滑らかな領域の4次収束への不合格でも、粗い刻みに新しい精度契約を課すものでもなく、正本の無条件の説明との不一致。式の分離積分と実際のRK4段を根拠とする。再現コードは§6。

### F-D02 不一致：VER-F05の円半径の前提にCL>0が不足

**前提条件**：06§4.2 F05は「定数CL」を前提とし、半径 `r=2m/(ρA CL)` を期待する。一方05§7.4および実装は暫定的に有限負CLを許す。

**期待値・差異**：CL<0では半径は正の `2m/(ρA|CL|)`、旋回向きが逆。CL=0なら円ではなく直線で、記載式はゼロ除算になる。ρ>0、CL>0、非ゼロの有効速度・横スピンという前提で既存のF05実装テストは一致しているが、正本の前提はその適用域を述べていない。実装の負CL許容を誤りと判定するものではない。

**許容誤差・根拠**：半径の符号、CL=0の極限は厳密。導出§6.4の向心加速度、05§7.4の係数契約、`magnusForce`の符号付き係数。負係数の最終的な物理採用はF-H02で保留する。

| ID・判定 | 前提条件・期待値・残る差異 | 許容誤差と根拠 |
|---|---|---|
| F-H01 判断保留：閾値と運用域 | P-21/23/24は正・単位別の仮置きとして実装に一致する。ただし係数の上限・速度域・許容する切捨て量が未確定。定数CLやCMでは閾値直上の力/トルクは小さいとは限らず、εvの抗力だけの見積もりで全空力の切捨て誤差は保証できない | 導出S01/S02、05§10、OQ-07/08/13。直接のゼロ分岐は厳密一致、閾値横断の精度契約は未決定 |
| F-H02 判断保留：全スピンCLと物理同定 | CL∝S（全スピン）なら無回転極限は改善するが、W固定でω∥uへ近づく場合の力の不連続は残る。負CLの採用・係数・適用域は未決定 | 導出§3.2/S04、05§7.4/7.6、OQ-07。次元整合だけでモデルを選定できない。VAL-10/D-09未実施、TOL-D未決定 |
| F-H03 判断保留：F04静止開始と有限閾値 | 有限εvでは初めは重力のみ、t_c=εv/g以後に有効枝へ接続する。実装テストのtanh閉形式は無閾値式。通常の小εvでは差が非常に小さいが、厳密解という説明と一致しない。さらに終端速さ>εvが必要 | 導出§6.2/S03、06 F04は評価をU>εvに限定しているので、F04そのものを不合格にはしない。TOL-Bの既存測定域では一致。閾値を拡大した場合の試験契約は未確定 |
| F-H04 判断保留：入力・関数の契約 | 係数の有限性・非負性は実装済み。関数がthrowする場合、Re/Sのオーバーフロー、m/R/η/閾値の無効値、異常に大きい刻みに対する返却契約は段階APIでは完備していない | 導出S05、04§6の入口検証方針。今回の有限・有効域で異常なし。パイプライン前提の入口を確定せず、無効入力の全拒否を勝手に要求しない |
| F-H05 判断保留：積分された散逸の一般保証 | 06 F03は各ステップの増加をTOL-A以下とする。抗力の瞬時散逸は厳密だが、明示RK4は任意の刻み・係数でエネルギー単調性を保証しない。現行の.01s試験は良好だが一般保証ではない。`drag.test.ts` の「仕事」は独立の仕事積分ではなく閉形式から算出したエネルギーで、F03の仕事積分の比較は直接は試験していない | 導出S07、06 F03/§3。瞬時値Aと軌道Bを区別。運用の安定刻み・仕事積分の契約を保留。単に不連続を横切って4次を失うことを不一致とはしない |
| F-H06 判断保留：誤閲覧による独立性の完全な確認 | tasks IV-03-D/IV-04-Dにテスト表・疑義の一部の露出が記録されている。現行`forces/drag/magnus/rotation.test.ts`には導出の固有入力 m=R=1,ρ=2/π、T03のv0=4,T=.25、T06のV=3,T=π/6、T08の2/e、T09の1/9、T10のln2/6を写したケースは見当たらない。一般式の一致は物理根拠がある | 06§9.2–9.3、tasksの記録。露出した全行・時刻・思考過程の証跡はなく、コピー不在の証明はできない。露出を無かったことにせず、今回初めて実装へ接続した§6の数値試験を別根拠とする |

## 4. 独立した数値検証の実測

Node `v24.19.0`、IEEE 754倍精度。基本入力は導出§7.1と同じ m=R=1、κ=.5、ρ=2/π、g=4、無風。η=1はReの係数を使用しない試験の任意値。位置初期値は(0,10,0)。トルク定数はCM=.5、他の係数は各行に指定。以下は採用物性値・運用刻みではない。

| ケース | 刻み系列・測定誤差 | 実測した次数・解釈 |
|---|---|---|
| 抗力のみ、u0=±1、T=1 | h=1/4,1/8,1/16,1/32,1/64。位置誤差 7.53983131e-5,4.03400128e-6,2.31634657e-7,1.38543871e-8,8.46756665e-10 m。速度誤差1.00173074e-5,7.17151715e-7,4.60052252e-8,2.89214164e-9,1.81009097e-10 m/s | 位置p=4.22425,4.12229,4.06344,4.03225、速度p=3.80407,3.96241,3.99159,3.99800。導出IV-04§2.3の独自高精度計算とも整合 |
| 下向き速さs0=1、T=.5 | h=.05,.025,.0125,.00625。位置誤差1.30332868e-7,6.10777917e-9,3.21383808e-10,1.82502902e-11 m | 位置p=4.41541,4.24828,4.13831、速度p=4.09459,4.04719,4.02357 |
| s0=2（終端平衡）、s0=3（上側）、T=.5 | 同じ刻み。s0=2の速度誤差は全て0、位置は3.6e-15〜5.7e-14 m。s0=3の位置誤差3.48640980e-6→7.10119963e-10 m | 平衡で次数は定義しない。s0=3は位置p=4.14817,4.07529,4.03794、速度p=4.13148,4.06646,4.03338 |
| 円運動T06 | T=π/6、h=T/8,T/16,T/32,T/64。位置誤差6.35059243e-5,4.38643459e-6,2.86574545e-7,1.82865177e-8 m | 位置p=3.85577,3.93607,3.97006、速度p=3.98831,3.99969,4.00125 |
| 線形減衰T08 | W0=2,U=0,cω=1,T=.5、h=T/8…T/64。角速度誤差1.66150102e-6,9.85622572e-8,6.00161743e-9,3.70245834e-10 rad/s | p=4.07531,4.03761,4.01880 |
| 定数CMT09 | U=3,W0=2,CM=.5,T=1/9、h=T/8…T/64 | 全てωz=1、誤差0。切替前の一次解を厳密に再現 |
| CM=SのT10 | U=3,W0=2,T=ln2/6、h=T/8…T/64、期待ωz=1 | 誤差3.49925553e-7,2.10937039e-8,1.29475519e-9,8.01945177e-11 rad/s、p=4.05216,4.02606,4.01303 |

位置と速度を単位の異なるまま加えた既存`convergence.test.ts`・`drag.test.ts`のノルムは今回の次数根拠に使わず、上の成分別誤差で補強した。3次元の細刻み参照1本だけを独立な真値とは扱わない。親担当から、同一コミットで `npm run check`（型検査・依存境界・16ファイル106テスト）が合格したとの実行結果を受けた。自動テスト合格は本照合の代替ではない。

## 5. 導出資料の不足・疑義の対応

導出S01/S02はF-A03・F-H01とF-D01、S03はF-H03、S04はF-H02、S05はF-A04・F-H04、S06はF-A07（F13追加、一方(c)の切替後は限界あり）、S07はF-H05、S08はF-A08に対応する。独立導出にあった未決定事項のうち、Sの暫定定義・負CLの扱い・閾値の仮置きは現行正本で明示された。導出T13の閾値到達後の区分解を滑らかな4次の保証に置き換えてはいない。

## 6. 再現手順と完全な検証コード

リポジトリルートで次を実行する。生成物と検証コードは `/tmp` にだけ置く。コードは実装側テストをimportせず、上記の独立解析式を期待値にする。出力には [IV-04](../IV-04/comparison.md) の測定も含む。`name`が各結果を識別し、ゼロ誤差の次数はJSONではnullになる。

```sh
node_modules/.bin/tsc --ignoreConfig packages/physics-core/src/flight/forces.ts packages/physics-core/src/flight/integrator.ts packages/physics-core/src/flight/ground-events.ts packages/physics-core/src/flight/trajectory.ts packages/physics-core/src/metrics/flight-metrics.ts --outDir /tmp/kick-iv-build --module commonjs --target es2022 --strict --skipLibCheck
# 以下のJavaScriptを /tmp/kick-iv-check.cjs に保存して実行
node /tmp/kick-iv-check.cjs
```

```js
const {computeForces}=require('/tmp/kick-iv-build/flight/forces.js');
const {integrateFixedSteps,rk4Step}=require('/tmp/kick-iv-build/flight/integrator.js');
const {simulateFlightRun}=require('/tmp/kick-iv-build/flight/ground-events.js');
const {simulateFlight}=require('/tmp/kick-iv-build/flight/trajectory.js');
const {computeFlightMetrics}=require('/tmp/kick-iv-build/metrics/flight-metrics.js');
const ball={mass:1,radius:1,inertiaCoefficient:.5}; // I=.5
const env={gravity:4,airDensity:2/Math.PI,airViscosity:1,wind:[0,0,0]}; // B=1
const off={gravity:false,drag:{enabled:false,coefficient:{kind:'constant',value:1}},magnus:{enabled:false,coefficient:{kind:'constant',value:1}},spinDecay:{kind:'none'}};
const thresholds={magnus:1e-9,zeroSpeed:1e-6,zeroSpin:1e-6};
const c=value=>({kind:'constant',value});
const body=(v=[0,0,0],w=[0,0,0],p=[0,10,0],q=[0,0,0,1])=>({position:p,linearVelocity:v,angularVelocity:w,orientation:q});
const set=(forces={},dt=.01,extra={})=>({forces:{...off,...forces},thresholds,timeStep:dt,...extra});
const val=r=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value};
const last=(s,T,h,f,b=ball,e=env)=>val(integrateFixedSteps(s,Math.round(T/h),b,e,set(f,h))).at(-1);
const load=(s,f,th=thresholds)=>val(computeForces(s,ball,env,{...off,...f},th));
const err=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const orders=a=>a.slice(1).map((x,i)=>Math.log2(a[i]/x));
const out=(name,result)=>console.log(JSON.stringify({name,...result}));
out('T01',{loads:load(body([3,-4,0]),{gravity:true,drag:{enabled:true,coefficient:c(1)}})});
out('T02',{forces:[[0,0,2],[0,2,0],[0,0,-2]].map(w=>load(body([3,0,0],w),{magnus:{enabled:true,coefficient:c(1)}}).force)});
{
 const s=body([3,4,5],[1,2,3]),f={drag:{enabled:true,coefficient:c(1)},magnus:{enabled:true,coefficient:c(1)},spinDecay:{kind:'torque-coefficient',coefficient:c(.5)}};
 const P=v=>[v[0],v[1],-v[2]],Q=v=>[-v[0],-v[1],v[2]],a=load(s,f),b=load(body(P(s.linearVelocity),Q(s.angularVelocity)),f);
 out('T12-mirror',{loads:a,forceResidual:err(b.force,P(a.force)),torqueResidual:err(b.torque,Q(a.torque))});
}
for(const sign of [1,-1]){
 const h=[.25,.125,.0625,.03125,.015625],T=1;
 const runs=h.map(dt=>last(body([sign,0,0]),T,dt,{drag:{enabled:true,coefficient:c(1)}}));
 const x=runs.map(s=>Math.abs(s.position[0]-sign*Math.log(2))),v=runs.map(s=>Math.abs(s.linearVelocity[0]-sign*.5));
 out('drag-log-'+sign,{h,x,v,px:orders(x),pv:orders(v)});
}
for(const s0 of [0,1,2,3]){
 const T=.5,h=[.05,.025,.0125,.00625],t=Math.tanh(1),exactV=-2*(s0+2*t)/(2+s0*t),exactY=10-Math.log(Math.cosh(1)+s0/2*Math.sinh(1));
 const runs=h.map(dt=>last(body([0,-s0,0]),T,dt,{gravity:true,drag:{enabled:true,coefficient:c(1)}}));
 const y=runs.map(s=>Math.abs(s.position[1]-exactY)),v=runs.map(s=>Math.abs(s.linearVelocity[1]-exactV));
 out('fall-'+s0,{y,v,py:orders(y),pv:orders(v)});
}
{
 const T=Math.PI/6,h=[T/8,T/16,T/32,T/64],runs=h.map(dt=>last(body([3,0,0],[0,0,2]),T,dt,{magnus:{enabled:true,coefficient:c(1)}}));
 const p=runs.map(s=>err(s.position,[1,11,0])),v=runs.map(s=>err(s.linearVelocity,[0,3,0]));out('T06',{p,v,pp:orders(p),pv:orders(v)});
}
for(const [name,T,f,exact] of [
 ['T08',.5,{spinDecay:{kind:'linear',coefficient:1}},2/Math.E],
 ['T09',1/9,{spinDecay:{kind:'torque-coefficient',coefficient:c(.5)}},1],
 ['T10',Math.log(2)/6,{spinDecay:{kind:'torque-coefficient',coefficient:{kind:'function',evaluate:(_r,s)=>s}}},1],
]){const h=[T/8,T/16,T/32,T/64],e=h.map(dt=>Math.abs(last(body([name==='T08'?0:3,0,0],[0,0,2]),T,dt,f).angularVelocity[2]-exact));out(name,{e,p:orders(e)});}
{
 const th={magnus:.1,zeroSpeed:.2,zeroSpin:.3};
 let calls=0;const poison={kind:'function',evaluate:()=>{calls++;return NaN}};
 const f={gravity:true,drag:{enabled:true,coefficient:poison},magnus:{enabled:true,coefficient:poison},spinDecay:{kind:'torque-coefficient',coefficient:poison}};
 out('low-speed',{loads:[0,.1,.2].map(u=>load(body([u,0,0],[0,0,1]),f,th)),calls});
 const f2={magnus:{enabled:true,coefficient:c(1)},spinDecay:{kind:'torque-coefficient',coefficient:c(1)}};
 out('separate-thresholds',{at:load(body([1,0,0],[0,0,.1]),f2,th),above:load(body([1,0,0],[0,0,.1001]),f2,th),spinAt:load(body([1,0,0],[0,0,.3]),f2,th),spinAbove:load(body([1,0,0],[0,0,.3001]),f2,th),parallel:load(body([1,0,0],[1,0,0]),{...f2,drag:{enabled:true,coefficient:c(1)}},th)});
}
// Known constant torque overshoot, a_c=9, a_c*h/W0=1.51.
const W0=2,hOvershoot=1.51*W0/9;
out('constant-CM-overshoot',{h:hOvershoot,omega:val(rk4Step(body([3,0,0],[0,0,W0]),hOvershoot,ball,env,set({spinDecay:{kind:'torque-coefficient',coefficient:c(.5)}}))).angularVelocity});
// CM=S^2 -> W'=-2 W |W| for U=3,R=1,I=.5; exact W=2/(1+4h).
for(const h of [.1,.2,.3,1])out('vanishing-CM',{h,exact:2/(1+4*h),omega:val(rk4Step(body([3,0,0],[0,0,2]),h,ball,env,set({spinDecay:{kind:'torque-coefficient',coefficient:{kind:'function',evaluate:(_r,s)=>s*s}}}))).angularVelocity});
const vanishingRate=9*(2/3)**.1,vanishingH=1.8/vanishingRate;
out('vanishing-CM-reversal',{h:vanishingH,stopTime:(1-(1e-6/2)**.9)/(.9*vanishingRate),omega:val(rk4Step(body([3,0,0],[0,0,2]),vanishingH,ball,env,set({spinDecay:{kind:'torque-coefficient',coefficient:{kind:'function',evaluate:(_r,s)=>s**.1}}}))).angularVelocity});
// Physical constants in PR estimate.
const realBall={mass:.43,radius:.11,inertiaCoefficient:2/3},realEnv={...env,airDensity:1.225};
out('PR-scale',{deltaOmega:.005*.5*1.225*Math.PI*.11**3*.01*30**2/((2/3)*.43*.11**2)});
// Independent quaternion exact product, componentwise expression independent of quat helpers.
const q0=[0,.6,0,.8],omega=[2,0,0],T=1;
const exactQ=[.8*Math.sin(1),.6*Math.cos(1),.6*Math.sin(1),.8*Math.cos(1)];
{const h=[.2,.1,.05,.025],runs=h.map(dt=>last(body([0,0,0],omega,[0,10,0],q0),T,dt,{})),e=runs.map(s=>Math.min(err(s.orientation,exactQ),err(s.orientation,exactQ.map(x=>-x))));out('quaternion',{e,p:orders(e),exactQ});}
{
 const T=1,h=[.1,.05,.025,.0125],f={spinDecay:{kind:'linear',coefficient:1}},theta=(1-Math.exp(-2))/2;
 const exact=[.8*Math.sin(theta),.6*Math.cos(theta),.6*Math.sin(theta),.8*Math.cos(theta)];
 const e=h.map(dt=>err(last(body([0,0,0],omega,[0,10,0],q0),T,dt,f).orientation,exact));out('decaying-quaternion',{e,p:orders(e)});
}
const gb={mass:.5,radius:.125,inertiaCoefficient:.5},ge={...env,gravity:1};
const grun=(s,h,maxTime,delta=2**-20,handler,b=gb,e=ge)=>val(simulateFlightRun(s,b,e,set({gravity:true},h,{maxTime,eventTimeTolerance:delta}),handler));
const reflect=c=>({ok:true,value:{kind:'continue',state:{...c.state,linearVelocity:[c.state.linearVelocity[0],-c.state.linearVelocity[1],c.state.linearVelocity[2]]}}});
{
 const r=grun(body([2,0,-1],[0,0,0],[0,1.125,0]),1,3);out('G1',{events:r.events,last:r.samples.at(-1),exact:Math.SQRT2,timeError:r.events[0].time-Math.SQRT2});
}
{
 const r=grun(body([1,0,0],[0,0,0],[0,1.125,0]),1,3,2**-20,undefined,gb,{...ge,gravity:2});out('G3',{events:r.events,last:r.samples.at(-1)});
}
for(const vy of [-1,0,1]){let calls=[];const r=grun(body([1,vy,0],[0,0,0],[0,.125,0]),.25,3,2**-20,c=>{calls.push(c);return {ok:true,value:{kind:'terminate'}}},gb,{...ge,gravity:2});out('start-'+vy,{events:r.events,calls});}
// Same-step return at start h=0 and total flight time exactly one step.
{const r=grun(body([0,1,0],[0,0,0],[0,.125,0]),1,2,2**-20,undefined,gb,{...ge,gravity:2});out('one-step-return',{events:r.events,samples:r.samples});}
{
 const r=grun(body([2,2,-1],[0,0,0],[0,.125,0]),.25,5,2**-20,reflect);out('bounce',{events:r.events,offGrid:r.samples.filter(s=>!r.events.some(e=>e.time===s.time)&&s.time/.25!==Math.round(s.time/.25)).length});
}
// Nonvacuum analytic landing: vertical fall from rest, H=1,g=4,k=1.
{const exact=Math.acosh(Math.exp(1))/2,h=[.1,.05,.025,.0125],e=h.map(dt=>{const r=val(simulateFlightRun(body([0,0,0],[0,0,0],[0,2,0]),ball,env,set({gravity:true,drag:{enabled:true,coefficient:c(1)}},dt,{maxTime:2,eventTimeTolerance:1e-12})));return r.events[0].time-exact;});out('drag-ground',{exact,e,p:orders(e.map(Math.abs))});}
{
 const r=val(simulateFlight(body([2,-1,-1],[0,0,0],[0,.125,0]),gb,{...ge,gravity:2},set({gravity:true},.125,{maxTime:2,eventTimeTolerance:2**-20}),reflect));out('start-metrics',{metrics:computeFlightMetrics(r,{verticalLaunchThreshold:1e-6}),events:r.events});
}
{
 const maxTime=1+5e-10,r=val(simulateFlightRun(body(),ball,env,set({},1,{maxTime,eventTimeTolerance:1e-9})));
 out('max-time-grid',{maxTime,last:r.events.at(-1),expectedTime:2});
}
```
