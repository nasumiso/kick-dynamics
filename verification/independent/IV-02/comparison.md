# IV-02-C 接触幾何の照合

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

一致4件、不一致1件、判断保留1件。通常入力の符号・回転・逆算は一致する。有限非零方向の数値端点で正規化契約を満たさない例がある。P26近傍の条件数による誤差を一律TOL-Aで扱うかは保留する。

| ID | 判定 | 前提・期待値・許容誤差・根拠 |
|---|---|---|
| I02-M01 | 一致 | 正のR、有限の通常の非零d、面内部。独立D §2.1の球面勾配から `p=x_B+Rd/|d|,n=−d/|d|`、足 `+z_b=n`。`setup.ts` の法線・位置は一致。下記通常ケースはTOL-A。 |
| I02-M02 | 一致 | 選択基準の射影が零でない。`y0=P a/|P a|,x0=y0×n`、右手回転 `yφ=cosφ y0+sinφ(n×y0)`。P26以下は+x射影、上は+y射影。D §2.2〜2.3・§4、05 §6.2と実装が一致。基準切替で同じφの姿勢が不連続なのは仕様どおり。通常角・極・境界の両側を再現（閾値直上の精度はH01）。 |
| I02-M03 | 一致 | `r_A=R_A(sx,sy,Lz/2),x_A=p−r_A,v_A=v_A^p−ω_A×r_A`。入力の速度・角速度はワールド座標。D §3から接触点速度を独立に復元し通常ケースTOL-Aで一致。質量・慣性・有限/無限質量の選択はこの運動学を変えない。 |
| I02-M04 | 一致 | 通常の有限入力、非零d、面内部、接近 `v_A^p·n>0`。面境界・外部、零方向、非有限、非接近は所定SimResultエラー、成立条件は閾値なし。D §3.3・§5、現在の05/04と一致。`fromMat3` はHamilton/物体→ワールドの能動回転、qと−qを区別せず回転基底で比較。最大四元数成分選択の式と4分岐を独立な0/180度等の行列で確認、TOL-A。 |
| I02-D01 | 不一致 | 現在の05 §6.2は有限非零dなら正規化すると規定し数値上の大きさの上限/下限はない。極大成分でRangeError、極小subnormalで非単位法線をokとして返す。数学上の方向は有効で、通常の物性・寸法・速度のまま発生。詳細次節。期待値/実測の差は丸め許容幅では吸収しない。 |
| I02-H01 | 判断保留 | `|Pŷ|` がP26直上の姿勢。独立D §1.2・§4.1は射影正規化の条件数を誤差に含める。P26も約 `εmachine/ℓ` の誤差を明記。一方06 C17の一般TOL-Aでは今回の単位法線誤差が幅を超える。精度契約/試験範囲をどう確定するかはIV-02-Rで判断。切替基準・回転符号の誤りとは扱わない。 |

## 不一致 I02-D01：方向の正規化の浮動小数点端点

**前提**：現在の05 §6.2の入力検証の原文は「入力に有限でない値がある」「dの長さが0。長さが0でなければ正規化して使う」。`KickInput`の説明も同様で、実用上の最大成分/最小長や「binary64でノルムが表現可能」の条件はない。04 §6は想定内入力エラーをSimResultとする。実装は各成分のfinite検査後に `Math.hypot` の長さを使って正規化する。

**期待値・独立根拠**：dの各成分が同符号・同じ非零値でz=0なら、数学上の単位方向は正負に応じて `(±1/√2,±1/√2,0)`。成分を同じ正数倍しても方向・姿勢・接触点は変わらない。これはD §2.1の単位法線・球面条件と、入力方向の大きさを自由に正規化する現在の仕様から得られる。

**実測**：以下の物性は再現コードの通常ケースと同じで、面内部/接近を満たす。

| d・接触点速度 m/s | 期待 | 実測 |
|---|---|---|
| `(MAX_VALUE,MAX_VALUE,0)`、`(-1,-1,0)` | `n=(-1/√2,-1/√2,0)` の有効setup。少なくとも明示的に数値定義域外とする場合はSimResultにする契約を決める必要がある | `RangeError: normalize: cannot normalize vector of length Infinity`。各成分は有限だがノルムがoverflowする |
| `(-MIN_VALUE,-MIN_VALUE,0)`、`(1,1,0)` | `n=(1/√2,1/√2,0)`、`|p−x_B|=R=1 m` | `ok:true`、`contactNormal=[1,1,0]`、`p=[−1,0,0]`。法線長も球面半径も√2倍。ノルムがsubnormalへの丸めでMIN_VALUEになる |

ここで `MAX_VALUE=1.7976931348623157e308`、`MIN_VALUE=5e-324`。極大ケースの実数ノルムは有限だがbinary64最大を超える。極小ケースは実数ノルムは非零で、単位成分はbinary64で十分表せる。

**許容誤差**：法線の誤差は `√2−1` の規模、例外有無は厳密。TOL-Aでは解消しない。重大さは入力契約の端点に限られ、通常のキック入力での不具合を示してはいない。数値的に安定な正規化を採るか、入力の数値定義域を明記・検証してSimResultにするかはR段階の判断。本C段階では実装を変更しない。

## 判断保留 I02-H01：P26直上の誤差予算

**前提**：`n=(sinθ,cosθ,0)`、φ=0、球R=1 m、足L=(2,2,2) m、面位置 `(1/2,0)`、角速度はコード記載。通常基準側の安定した独立期待値は `y0=(-cosθ,sinθ,0)`。比較対象は入力で指定したnと、返された四元数で回した+z、および位置から得たr_Aと四元数で回した物体r_A。

| θ rad | `|q e_z q*−n|` | r_A整合残差 m |
|---|---|---|
| 0 | 0 | 0 |
| 1e-7（+x射影） | 3.1403165931256555e-16 | 4.587803993421258e-16 |
| 1.001e-6（+y射影） | 9.588860767930199e-11 | 1.2684889769524017e-10 |
| 1.01e-6 | 1.8962814192653622e-11 | 2.508547067580208e-11 |
| 2e-6 | 3.1285071190140486e-11 | 4.1386252087757116e-11 |
| 1e-3 | 2.6786186333127832e-14 | 3.544671137467999e-14 |

**根拠・許容誤差**：`ŷ−(ŷ·n)n` の相殺でO(εmachine)の絶対誤差を生じ、長さℓ≈1e-6で割るためO(εmachine/ℓ)へ増幅する。P26の記載は約2e-10を想定しており、この実測はその範囲内。一律TOL-Aの単位成分の絶対＋相対幅（最大約2e-12）は超えるが、Dが要求する条件数込みの幅は正式に確定していない。このため直ちに物理幾何の符号ミスとせず判断保留とする。setup.test.tsの「上側」はθ=1e-3で、この直上の誤差規模を試験していない。正式な許容幅/対象域または安定な基底構成の選択をR段階に残す。

## 通常ケースと仕様自体の確認

下記の通常ケースではd=(0,0,−2)、φ=0,±π/2,π。期待基底は `(cosφ,sinφ,0),(-sinφ,cosφ,0),(0,0,1)` であり、面位置・速度逆算もこの基底から直接求めた。`fromMat3` は恒等/各軸180度/+z90度を入力し、全基底像を比較した。通常ケース全体の最大絶対残差 `2.220446049250313e-16`、各量別TOL-A合格。エラー8ケースはすべて所定コード。

φはrad、r_A/x_A/pはm、ω×r_Aはm/s、P26は無次元。右手系の `x=y×n` と回転の正方向、法線の両面の符号、q/−q同値性はDと現在の仕様に整合する。質量・形状を無関係に一般化せず、一様直方体の+z面内部を対象とした。D §6のQ1〜Q5は現在の05 §6.2の切替・不連続・四元数同値・入力検証・非接近エラーの規定で具体化されている。Q6の条件数と許容幅はH01に残る。辺角接触・足と地面の干渉は今回のモデルに加えていない。

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
import {boxInertia} from '/workspace/kick-dynamics/packages/physics-core/src/bodies/dynamics.ts';
import {fromMat3,rotate} from '/workspace/kick-dynamics/packages/physics-core/src/math/quat.ts';
const ball={mass:1,radius:1,inertiaCoefficient:2/3}, dimensions=[2,2,2];
const foot={mass:1.5,inertiaBody:boxInertia(1.5,dimensions),shape:{kind:'box',dimensions}};
const params={ball,foot,rollReferenceThreshold:1e-6};
const base={contactDirection:[0,0,-2],footRollAboutNormal:0,footContactLocation:[.5,.25],footContactPointVelocity:[1,2,3],footAngularVelocity:[2,-1,3],footModel:'finite-mass'};
let maxResidual=0;
const near=(a,b)=>a.forEach((x,i)=>{const d=Math.abs(x-b[i]);maxResidual=Math.max(maxResidual,d);assert(d<=1e-12+1e-12*Math.abs(b[i]));});
const add=(a,b)=>a.map((x,i)=>x+b[i]);const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
for(const phi of [0,Math.PI/2,Math.PI,-Math.PI/2]){const r=buildImpactSetup({...base,footRollAboutNormal:phi},params);assert(r.ok);const s=r.value,c=Math.cos(phi),t=Math.sin(phi);near(rotate(s.foot.orientation,[1,0,0]),[c,t,0]);near(rotate(s.foot.orientation,[0,1,0]),[-t,c,0]);near(s.contactNormal,[0,0,1]);const arm=[.5*c-.25*t,.5*t+.25*c,1];near(s.foot.position,[-arm[0],1-arm[1],-1-arm[2]]);near(add(s.foot.linearVelocity,cross(base.footAngularVelocity,arm)),base.footContactPointVelocity);}
// fromMat3 の4成分分岐。期待行列は90度/180度の能動回転の基底像から。
for(const m of [[1,0,0,0,1,0,0,0,1],[1,0,0,0,-1,0,0,0,-1],[-1,0,0,0,1,0,0,0,-1],[-1,0,0,0,-1,0,0,0,1],[0,-1,0,1,0,0,0,0,1]]){const q=fromMat3(m);for(let j=0;j<3;j++)near(rotate(q,[+(j===0),+(j===1),+(j===2)]),[m[j],m[3+j],m[6+j]]);}
for(const [patch,code] of [[{contactDirection:[0,0,0]},'invalid-input'],[{contactDirection:[NaN,0,0]},'invalid-input'],[{footRollAboutNormal:Infinity},'invalid-input'],[{footContactLocation:[1,0]},'invalid-input'],[{footContactLocation:[0,-1]},'invalid-input'],[{footAngularVelocity:[0,NaN,0]},'invalid-input'],[{footContactPointVelocity:[0,1,0]},'separating-input'],[{footContactPointVelocity:[0,0,-1]},'separating-input']]){const r=buildImpactSetup({...base,...patch},params);assert(!r.ok);assert.equal(r.error.code,code);}
for(const theta of [0,1e-7,1.001e-6,1.01e-6,2e-6,1e-3]){const n=[Math.sin(theta),Math.cos(theta),0];const r=buildImpactSetup({...base,footContactLocation:[.5,0],contactDirection:n.map(x=>-x),footRollAboutNormal:0,footContactPointVelocity:n.map(x=>10*x)},params);assert(r.ok);const s=r.value;const z=rotate(s.foot.orientation,[0,0,1]);const y=rotate(s.foot.orientation,[0,1,0]);const expectedY=theta<=1e-6?[Math.cos(theta),-Math.sin(theta),0]:[-Math.cos(theta),Math.sin(theta),0];const norm=x=>Math.hypot(...x);console.log('pole',theta,'normal',norm(z.map((x,i)=>x-n[i])),'y',norm(y.map((x,i)=>x-expectedY[i])),'arm',norm(rotate(s.foot.orientation,[.5,0,1]).map((x,i)=>x-(s.contactPoint[i]-s.foot.position[i]))));}
for(const d of [[Number.MAX_VALUE,Number.MAX_VALUE,0],[-Number.MIN_VALUE,-Number.MIN_VALUE,0]]){try{const r=buildImpactSetup({...base,contactDirection:d,footContactPointVelocity:d[0]>0?[-1,-1,0]:[1,1,0]},params);console.log('finite d edge',d,JSON.stringify(r));}catch(e){console.log('finite d edge',d,String(e));}}
console.log('ordinary max residual',maxResidual);
```

実行：`node --import ./loader.mjs ./verify.mjs`。assertが失敗しなければ上記数値を出力し終了コード0。Nodeの実験的な型消去の警告は結果に影響しない。再現物の内容はこの資料内に収録しており、一時ファイルの存続を必要としない。
