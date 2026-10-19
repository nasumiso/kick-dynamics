# 05 物理モデル（正本）

> 状態：Phase 1 モデル（PM-1）の設計初版（2026-10-18）。**未実装・未検証。**
> 本書は物理モデルの数式・記号・座標系・単位系・仮定・適用限界・パラメータ表の正本です。他の文書は本書を参照し、数式を複製しません。
> 数式は GitHub の数式記法（`$...$`）で記述しています。

## 1. 単位系

- 内部計算と Core の入出力は SI 単位：m、kg、s、N、rad、rad/s、kg·m²、N·s（衝撃量）。
- 角度は rad。表示用の単位（km/h、rpm、度、cm）への変換は表示層（`apps/web/src/units/`）でのみ行う。
  - $1\ \mathrm{m/s} = 3.6\ \mathrm{km/h}$
  - $\mathrm{rpm} = |\boldsymbol\omega| \cdot 60 / (2\pi)$（$|\boldsymbol\omega|$ は rad/s）

## 2. 座標系（決定：[ADR-0005](decisions/0005-coordinate-and-quaternion-conventions.md)）

- **ワールド座標系 W**：右手系。
  - 原点：初期のボール中心の真下の地面上の点
  - $+y$：鉛直上向き
  - $+x$：基準となる蹴り出し方向（例：ゴール方向）
  - $+z = \hat{\mathbf x} \times \hat{\mathbf y}$：$+x$ を向いて立ったときの右手側
- **地面**：平面 $y = 0$（Phase 1 は水平・平坦）。
- **物体座標系**：ボール（B）と足（A）それぞれの重心を原点とし、剛体に固定。
- **姿勢**：単位四元数 $q$ で表し、物体座標 → ワールド座標の回転（能動回転）を表す：$\mathbf v_W = q\otimes\mathbf v_B\otimes q^{*}$。対応する回転行列を $\mathbf R(q)$ とする。
  - 積 $\otimes$ は Hamilton の定義に従う。
  - 成分の並びは $q = [x, y, z, w]$（ベクトル部が先、スカラー部 $w$ が最後。Three.js と同じ）。
- **角速度**：API 上はワールド座標で表す。
- **慣性テンソル**：物体座標で定義し、ワールド座標では $\mathbf I_W = \mathbf R \mathbf I_{\text{body}} \mathbf R^{\mathsf T}$。

y 軸を上向きとし、四元数の成分順を Three.js に合わせたのは、描画との変換の誤りを減らすため。物理の文献で多い z 上向きや $[w, x, y, z]$ の順の式を参照するときは、読み替えに注意する（ADR-0005）。

## 3. 記号

| 記号 | 意味 | 単位 |
|---|---|---|
| $m_B,\ R,\ \kappa$ | ボールの質量・半径・慣性係数 | kg, m, — |
| $\mathbf I_B$ | ボールの慣性テンソル | kg·m² |
| $m_A,\ \mathbf I_A$ | 足の質量・慣性テンソル | kg, kg·m² |
| $\mathbf x_i,\ \mathbf v_i,\ \boldsymbol\omega_i,\ q_i$ | 物体 $i \in \{A, B\}$ の重心位置・速度・角速度・姿勢 | m, m/s, rad/s, — |
| $\mathbf p$ | 接触点 | m |
| $\mathbf n$ | 接触法線（足 → ボールの向きの単位ベクトル） | — |
| $\mathbf d$ | ボール中心 → 接触点の単位ベクトル（$\mathbf d = -\mathbf n$） | — |
| $\mathbf r_A,\ \mathbf r_B$ | 各重心 → 接触点のベクトル | m |
| $\mathbf u,\ u_n,\ \mathbf u_t$ | 接触点での相対速度（ボール − 足）とその法線・接線成分 | m/s |
| $\mathbf v_A^{p}$ | 接触点での足の速度（キック入力の「足の速度」） | m/s |
| $L_x,\ L_y,\ L_z$ | 足（直方体）の寸法（物体座標の各軸方向の長さ） | m |
| $\phi$ | 接触法線まわりの足の回転角 | rad |
| $(s_x,\ s_y)$ | 足の接触面上の接触位置 | m |
| $\mathbf J,\ j_n,\ \mathbf J_t$ | ボールに加わる衝撃量とその法線・接線成分 | N·s |
| $\mathbf K$ | 衝撃量 → 相対速度変化の行列 | 1/kg |
| $e,\ \mu$ | 足–ボール間の反発係数・摩擦係数 | — |
| $e_g,\ \mu_g$ | 地面–ボール間の反発係数・摩擦係数 | — |
| $\mathbf E$ | 3×3 単位行列 | — |
| $[\mathbf a]_\times$ | 外積行列（$[\mathbf a]_\times \mathbf b = \mathbf a \times \mathbf b$） | $\mathbf a$ の単位 |
| 上付き $-$ / $+$ | 衝突直前 / 直後 | — |
| $g$ | 重力加速度の大きさ | m/s² |
| $\rho,\ \eta$ | 空気の密度・粘性係数 | kg/m³, Pa·s |
| $A = \pi R^2$ | ボールの投影面積 | m² |
| $C_D,\ C_L,\ C_M$ | 抗力係数・揚力（マグヌス）係数・空力トルク係数 | — |
| $c_\omega$ | 線形の回転減衰係数（§7.5 (b)） | kg·m²/s |
| $\varepsilon,\ \varepsilon_v,\ \varepsilon_\omega$ | 縮退判定の閾値（$\lvert\boldsymbol\omega\times\mathbf v_r\rvert$、$\lvert\mathbf v_r\rvert$、$\lvert\boldsymbol\omega\rvert$ に対するもの。§7.3〜7.5） | m/s², m/s, rad/s |
| $\varepsilon_t,\ \varepsilon_\phi$ | 接線速度がほぼ 0 とみなす閾値（§6.8）、$\phi$ の基準軸を切り替える閾値（§6.2） | m/s, — |
| $h$ | 地面イベントの判定量 $h = y - R$（§7.7） | m |
| $Re,\ S$ | レイノルズ数・スピンパラメータ | — |
| $\Delta t$ | 物理の時間刻み | s |

## 4. 計算の流れ

1. キック入力から、物理的に整合した衝突直前の状態を構築する（§6.2）。
2. 瞬間衝突として衝撃量 $\mathbf J$ を求め、足とボールの速度・角速度を更新する（§6）。
3. 衝突直後のボールの状態を初期値として飛翔を時間積分する（§7）。
4. 地面に達したらバウンドを処理し（§8.1）、必要に応じて転がり・停止へ移る（§8.2）。

Phase 1 では、衝突前の足の運動（スイング）は計算せず、衝突直前の足の状態を入力として与える。衝突後の足は、有限質量モデルで更新された速度・角速度を診断値として出力するだけで、その後の足の運動や二度目の接触は計算しない。

ボールの初期状態は「地面上で静止」とする：$\mathbf x_B = (0, R, 0)$、$q_B$ = 単位四元数、$\mathbf v_B = \boldsymbol\omega_B = \mathbf 0$。浮いたボールや転がっているボールを扱うかは未決定（[OQ-23](research/references-and-open-questions.md)）。

## 5. 剛体

### 5.1 ボール

- Phase 1 では剛体球とし、質量分布を慣性係数 $\kappa$ で表す：$\mathbf I_B = \kappa\, m_B R^2\, \mathbf E$。
- $\kappa$ の参照値：一様な中実球なら $2/5$、薄肉の中空球なら $2/3$（いずれも数学的な結果）。実際のボールは中空の膜構造であり、どちらにも厳密には一致しない。採用値は未決定（P-03、[OQ-06](research/references-and-open-questions.md)）。「一様な剛体球」を字義どおりに採る場合は $\kappa = 2/5$ となるが、本書では $\kappa$ を独立したパラメータとして扱う。
- 球は等方的なので、ボールの慣性テンソルは姿勢によらない。ボールの姿勢 $q_B$ は回転の可視化のためにだけ積分する（§7.1）。

### 5.2 足

- 有限質量の 3D 剛体：質量 $m_A$、物体座標での慣性テンソル $\mathbf I_A^{\text{body}}$（3×3 対称正定値）、姿勢 $q_A$、重心位置 $\mathbf x_A$、速度 $\mathbf v_A$、角速度 $\boldsymbol\omega_A$。
- 幾何形状は**一様密度の直方体**とする（決定：[OQ-01](research/references-and-open-questions.md)、2026-10-18）。
  - 物体座標の原点は直方体の中心（＝重心）、軸 $x_b, y_b, z_b$ は直方体の辺に平行。寸法を $L_x, L_y, L_z$ とする。
  - 物体座標での慣性テンソル：
    $$
    \mathbf I_A^{\text{body}} = \frac{m_A}{12}\,\mathrm{diag}\!\left(L_y^2 + L_z^2,\ L_x^2 + L_z^2,\ L_x^2 + L_y^2\right)
    $$
  - **接触面は $+z_b$ 面に固定する**。どの面が足のどの部位（足甲・内側など）に当たるかは定めない（Phase 3 で扱う）。
  - **表示上の仮の対応**（2026-10-19、人間が承認。物理の計算には使わない）：$+z_b$（接触面）= 足の甲、$-z_b$ = 足の裏、$+x_b$ = つま先、$-x_b$ = かかと。$\pm y_b$（内側・外側）は右足・左足で入れ替わるため定めない。この対応で自然に表せるのはインステップキックだけで、インサイドキックなどの部位の使い分けは Phase 3 で扱う（§12）。
  - 接触は $+z_b$ 面の内部で起こるものとし、辺・角での接触は Phase 1 の対象外とする。
  - 質量・寸法の値（仮置き）は M1.3 開始前に決める（[OQ-02](research/references-and-open-questions.md)、tasks T0-08）。
- Phase 1 の接触計算に必要なのは、接触点での足表面の法線、接触点の位置（$\mathbf r_A$）、質量、慣性テンソルだけである。形状の詳細（曲率など）は Phase 3 で扱う。
- 足首・膝・股関節の拘束、筋力、関節剛性は扱わない（§11）。

## 6. 接触モデル（瞬間点接触）

### 6.1 仮定

1. **瞬間衝突**：衝突の間、位置と姿勢は変化しない。重力・空気力・地面反力など有限の力による衝撃は無視する。
2. **単一点接触**：足とボールは 1 点で接触する。
3. **剛体**：足もボールも変形しない。このモデルは接触時間・変形・圧力分布を**出力しない**。
4. 法線方向は **Newton の反発係数**（速度比）、接線方向は **Coulomb 摩擦**とする。
5. 足の表面は接触点の近傍で滑らかで、法線が一意に定まる。

### 6.2 接触幾何

- ボール表面上の接触点を、ボール中心から接触点への単位ベクトル $\mathbf d$ で表す：$\mathbf p = \mathbf x_B + R\,\mathbf d$。
- 球は滑らかなので、接触法線（足 → ボール）は $\mathbf n = -\mathbf d$。
- 接触点で、足の接触面の外向き法線は $\mathbf n$ と一致しなければならない。したがって、平面（または滑らかな凸面）の接触面を仮定する限り、**ボール上の接触点の指定と、足の接触面の向きの指定は同じ 2 自由度であり、独立には与えられない**。足の姿勢に残る自由度は、
  - 法線 $\mathbf n$ まわりの回転（1 自由度）
  - 足の表面上のどこで接触するか（2 自由度。$\mathbf r_A$ を決める）
- 足の重心位置は $\mathbf x_A = \mathbf p - \mathbf r_A$ で決まる。

**キック入力の自由度**（決定：[OQ-03](research/references-and-open-questions.md) のパラメータ化、2026-10-18。UI での表現は M1.4 の試作で決める）：

| 入力 | 自由度 | 定義 |
|---|---|---|
| 接触方向 $\mathbf d$ | 2 | ボール中心 → 接触点の単位ベクトル。$\mathbf n = -\mathbf d$ |
| 法線まわりの回転角 $\phi$ | 1 | 足の接触面（$+z_b$ 面）の外向き法線を $\mathbf n$ に合わせた上での、$\mathbf n$ まわりの回転。$\phi = 0$ は「$y_b$ が、ワールドの $+\hat{\mathbf y}$ を接触平面（$\mathbf n$ に垂直な平面）へ射影した向きと一致する」姿勢。$\mathbf n$ が $\hat{\mathbf y}$ とほぼ平行な場合は、$+\hat{\mathbf x}$ の射影を基準に使う。回転の正の向きは $\mathbf n$ まわりの右ねじの向き。基準の切り替え：$\hat{\mathbf y}$ の射影の長さ $\lvert\hat{\mathbf y} - (\hat{\mathbf y}\cdot\mathbf n)\mathbf n\rvert$ が閾値 $\varepsilon_\phi$ 以下なら $+\hat{\mathbf x}$ の射影を使う（$\varepsilon_\phi$ の値は未決定、P-26）。切り替えの境界の前後で、同じ $\phi$ に対する足の姿勢は不連続に変わる（基準軸が変わるため。物理的な不連続ではなく入力の座標の特異点） |
| 接触面上の接触位置 $(s_x, s_y)$ | 2 | $+z_b$ 面の中心を原点とした、$x_b$・$y_b$ 方向の位置。既定は $(0, 0)$。$\vert s_x\vert  < L_x/2$、$\vert s_y\vert  < L_y/2$。物体座標では $\mathbf r_A^{\text{body}} = (s_x,\ s_y,\ L_z/2)$ |
| 接触点での足の速度 $\mathbf v_A^{p}$ | 3 | 衝突直前に、足の接触点が動いている速度（ワールド座標） |
| 足の角速度 $\boldsymbol\omega_A$ | 3 | ワールド座標。既定は $\mathbf 0$ |

- 足の重心速度は $\mathbf v_A = \mathbf v_A^{p} - \boldsymbol\omega_A\times\mathbf r_A$ で求める（$\boldsymbol\omega_A = \mathbf 0$ なら $\mathbf v_A = \mathbf v_A^{p}$）。
- 足の姿勢 $q_A$ は、$\mathbf n$ と $\phi$ から回転として一意に決まる。四元数としては $q_A$ と $-q_A$ が同じ回転を表すため、符号は定めない（テストは回転行列、または変換したベクトルで比較する）。
- **接触の成立条件**：$u_n^- < 0$（接触点で互いに近づいている）。ボールが静止している Phase 1 の初期状態では、$\mathbf v_A^{p}\cdot\mathbf n > 0$ と同値。判定は閾値なしで行う（$u_n^-$ がわずかでも負なら、小さな衝撃量の衝突として解く）。
- **入力の検証**（`buildImpactSetup`）：次の場合は `SimResult` のエラーを返し、衝突直前状態を作らない。
  - 入力に有限でない値がある。
  - $\mathbf d$ の長さが 0。長さが 0 でなければ正規化して使う。
  - $(s_x, s_y)$ が接触面の外（$\lvert s_x\rvert \ge L_x/2$ または $\lvert s_y\rvert \ge L_y/2$）。
  - $u_n^- \ge 0$（離反または接線方向だけの運動。キックの入力としては誤り）。
- `solveImpact` を直接呼ぶ場合（テスト・地面との衝突）は、$u_n^- \ge 0$ を `separating` として扱い、衝撃量 $\mathbf 0$・状態の変化なしの結果を返す（§6.8 の手順 1）。
- 足とボール・地面との幾何学的な干渉（めり込み）は、Phase 1 では物理計算で扱わない（表示上の警告は候補）。

### 6.3 接触点の相対速度

$$
\mathbf v_A^{p} = \mathbf v_A + \boldsymbol\omega_A \times \mathbf r_A,\qquad
\mathbf v_B^{p} = \mathbf v_B + \boldsymbol\omega_B \times \mathbf r_B,\qquad
\mathbf r_B = \mathbf p - \mathbf x_B = -R\,\mathbf n
$$

$$
\mathbf u = \mathbf v_B^{p} - \mathbf v_A^{p},\qquad u_n = \mathbf u \cdot \mathbf n,\qquad \mathbf u_t = \mathbf u - u_n \mathbf n
$$

### 6.4 衝撃量による状態更新

ボールに $+\mathbf J$、足に $-\mathbf J$ が加わる（作用・反作用）。

$$
\Delta\mathbf v_B = \frac{\mathbf J}{m_B},\quad
\Delta\boldsymbol\omega_B = \mathbf I_B^{-1}(\mathbf r_B \times \mathbf J),\qquad
\Delta\mathbf v_A = -\frac{\mathbf J}{m_A},\quad
\Delta\boldsymbol\omega_A = -\mathbf I_A^{-1}(\mathbf r_A \times \mathbf J)
$$

慣性テンソルはワールド座標のもの（§2）を使う。

### 6.5 行列 K

接触点の相対速度の変化は $\Delta\mathbf u = \mathbf K \mathbf J$ と書ける。

$$
\mathbf K = \mathbf K_A + \mathbf K_B,\qquad
\mathbf K_A = \frac{1}{m_A}\mathbf E - [\mathbf r_A]_\times \mathbf I_A^{-1} [\mathbf r_A]_\times,\qquad
\mathbf K_B = \frac{1}{m_B}\mathbf E - [\mathbf r_B]_\times \mathbf I_B^{-1} [\mathbf r_B]_\times
$$

- $\mathbf K$ は対称で、少なくとも一方の物体が有限質量なら正定値。
- ボールについては $[\mathbf a]_\times[\mathbf a]_\times = \mathbf a\mathbf a^{\mathsf T} - |\mathbf a|^2\mathbf E$ と $\mathbf r_B = -R\mathbf n$ から、
  $$
  \mathbf K_B = \frac{1}{m_B}\mathbf E + \frac{1}{\kappa\, m_B}\left(\mathbf E - \mathbf n\mathbf n^{\mathsf T}\right)
  $$
  つまり法線方向の成分は $1/m_B$、接線方向の成分は $(1+\kappa)/(\kappa\, m_B)$ で、両者は連成しない。
- 足側の $\mathbf K_A$ は、$\mathbf r_A$ が $\mathbf n$ と平行でなければ一般に法線と接線を連成させる。

### 6.6 反発（法線方向）

$$
u_n^+ = -e\, u_n^-,\qquad 0 \le e \le 1
$$

Phase 1 では Newton の定義（速度比）を暫定採用する。他の定義（Poisson の定義、エネルギー的な定義）との比較は [OQ-04](research/references-and-open-questions.md)。

### 6.7 摩擦（接線方向）

$$
\mathbf J = j_n \mathbf n + \mathbf J_t,\qquad j_n \ge 0,\qquad |\mathbf J_t| \le \mu\, j_n
$$

- **固着（stick）**：衝突終了時に接線方向の相対速度が 0（$\mathbf u_t^+ = \mathbf 0$）。
- **滑り（slide）**：$\mathbf J_t = -\mu\, j_n \hat{\mathbf t}$。$\hat{\mathbf t}$ は滑り方向の単位ベクトル。
- 静止摩擦と動摩擦を区別しない（Phase 1 暫定）。

### 6.8 解法（Phase 1 の候補）

1. $u_n^- \ge 0$ なら $\mathbf J = \mathbf 0$（`separating`）として終了。状態は変化しない。
2. **固着を仮定した解**：$\mathbf u^+ = -e\,u_n^-\,\mathbf n$ を満たす衝撃量
   $$
   \mathbf J^{*} = \mathbf K^{-1}\left(-e\,u_n^-\,\mathbf n - \mathbf u^-\right)
   $$
3. $j_n^{*} = \mathbf J^{*}\cdot\mathbf n \ge 0$ かつ $|\mathbf J^{*}_t| \le \mu\, j_n^{*}$ なら固着を採用する（`stick`）。
4. そうでなければ滑りとする（`slide`）。滑り方向は $\hat{\mathbf t} = \mathbf u_t^-/|\mathbf u_t^-|$。$\mathbf J = j_n(\mathbf n - \mu\hat{\mathbf t})$ として法線方向の反発条件から
   $$
   j_n = \frac{-(1+e)\,u_n^-}{\mathbf n^{\mathsf T}\mathbf K(\mathbf n - \mu\hat{\mathbf t})}
   $$
   - $\lvert\mathbf u_t^-\rvert \le \varepsilon_t$（接線速度がほぼ 0。閾値 $\varepsilon_t$ の値は未決定、P-25）なのに固着解が摩擦円錐を外れる場合（$\mathbf K$ の連成による）は、$\hat{\mathbf t} = -\mathbf J^{*}_t/\lvert\mathbf J^{*}_t\rvert$ を近似として用い、警告を出す。$\mathbf J^{*}_t = \mathbf 0$ でこの近似も使えない場合は、解けないものとして扱う。
   - 分母が 0 以下になる場合や、上の近似が使えない場合は、解けないものとして `SimResult` のエラーを返す。このとき衝突後の状態は返さず（状態を更新しない）、エラーには $\mathbf u^-$、$\mathbf K$、固着解 $\mathbf J^{*}$ を診断値として含める。正常な入力でもこの場合は起こりうる（Newton ＋ Coulomb の代数解の限界、§6.13）。
5. 診断：固着／滑りの別、衝突前後の運動エネルギー・運動量・角運動量を出力する。`stick`・`slide` は**衝突終了時**の状態を表すラベルであり、衝突中ずっと固着（滑り）していたことを意味しない（代数解は衝突中の遷移を追わない、§6.13）。運動エネルギーの増加、滑り方向の反転（$\mathbf u_t^+\cdot\hat{\mathbf t} < 0$）を検出したら警告を出す（§6.11、§6.13）。

**連成がない場合の閉形式**（無限質量モデルで $\boldsymbol\omega_A = \mathbf 0$ のとき、および地面との衝突）：$\mathbf K = \mathbf K_B$ なので

$$
j_n = -(1+e)\,m_B\,u_n^-,\qquad
\mathbf J_t =
\begin{cases}
-\dfrac{\kappa\, m_B}{1+\kappa}\,\mathbf u_t^- & \left(|\mathbf u_t^-| \le \mu(1+e)\dfrac{1+\kappa}{\kappa}|u_n^-| \text{ のとき：固着}\right)\\[2ex]
-\mu\, j_n\, \hat{\mathbf t} & (\text{それ以外：滑り})
\end{cases}
$$

この場合は衝突中に滑り方向が変わらないため、上記の代数解は Newton 反発 ＋ Coulomb 摩擦の仮定のもとで厳密である。

### 6.9 無限質量の動く壁モデル（比較・検証用）

- $1/m_A \to 0$、$\mathbf I_A^{-1} \to \mathbf 0$ とし、$\mathbf K_A = \mathbf 0$。足の速度・角速度は衝突で変化しない。
- 足は外部から駆動される運動学的な境界であり、足とボールだけの閉じた系を表さない。この系では全運動量は保存されない（駆動側が衝撃を供給する）。
- 有限質量モデルの結果を解釈するための基準として、常に切り替えて比較できるようにする。

### 6.10 1 次元の参考式

次の前提をすべて満たすとき、§6.8 の解は 1 次元の式に帰着する：ボールは静止、足は並進のみ（$\boldsymbol\omega_A = \mathbf 0$）、足の速度 $\mathbf v_A$ が $\mathbf n$ と平行、$\mathbf r_A$ が $\mathbf n$ と平行（法線が両方の重心を通る）、接線方向の相対速度が 0。

- 無限質量の足：$v_{\text{ball}}^+ = (1+e)\,v_{\text{foot}}^-$
- 有限質量の足：$v_{\text{ball}}^+ = \dfrac{(1+e)\,m_A}{m_A + m_B}\,v_{\text{foot}}^-$

これらは正面衝突・摩擦なしを前提とする説明用の式であり、3D ソルバーの代わりにはならない。テスト（VER-C01、C02）の基準値として使う。

### 6.11 保存則と散逸

前提：瞬間衝突（§6.1）で、有限の外力の衝撃を無視する。

- **有限質量モデル**
  - 全運動量 $m_A\mathbf v_A + m_B\mathbf v_B$ は保存される。
  - 任意の固定点 $\mathbf o$ まわりの全角運動量 $\mathbf L = \sum_i \left[(\mathbf x_i - \mathbf o)\times m_i\mathbf v_i + \mathbf I_i\boldsymbol\omega_i\right]$ は保存される（作用・反作用の衝撃量が同じ点 $\mathbf p$ に働くため）。
- **運動エネルギーの変化**（有限質量モデルでは足とボールの並進・回転の運動エネルギーの合計の変化。無限質量モデルでの意味は下記）：
  $$
  \Delta T = \tfrac12\,\mathbf J\cdot\left(\mathbf u^- + \mathbf u^+\right)
  $$
  摩擦なしの場合は $\Delta T = -\tfrac12(1-e^2)\,(u_n^-)^2 / (\mathbf n^{\mathsf T}\mathbf K\mathbf n) \le 0$。$e = 1$ なら保存される。
- **摩擦あり**：連成がない場合（§6.8 の閉形式）は $\Delta T \le 0$ が成り立つ。$\mathbf K$ が法線と接線を連成する場合、Newton 反発 ＋ Coulomb 摩擦の代数解は $\Delta T \le 0$ を保証しない構成があることが知られている。Core はこれを診断で検出し警告する（VER-C14）。
- **無限質量モデル**：ボール単体の運動量・エネルギーは保存されない（駆動された壁が仕事をする）。
  - 診断の $\Delta T = \tfrac12\mathbf J\cdot(\mathbf u^- + \mathbf u^+)$ は、$\boldsymbol\omega_A = \mathbf 0$ のとき、足とともに並進する慣性系から見たボールの運動エネルギー（並進＋回転）の変化に等しい。この値が増加しないことを確かめる（VER-C16）。
  - 診断には、地上系でのボールの運動エネルギーの前後も別に出力する。その差と $\Delta T$ の差が、壁がボールにした仕事にあたる。警告の対象は $\Delta T > 0$ だけとし、地上系でのボールのエネルギー増加（キックでは当然起こる）は警告しない。
  - $\boldsymbol\omega_A \ne \mathbf 0$ の場合、足に固定した系は慣性系ではないため、$\Delta T$ にこの解釈は与えない（値は出力するが、警告の判定に使わない）。
- **エネルギーが増加した場合の扱い**：結果は返し、警告を付ける（補正・エラー化はしない）。検証は、エネルギーが増えないことが保証される条件での散逸の試験（VER-C14）と、増加を検出して警告することの試験（VER-C18）に分ける。

### 6.12 足の有効質量（本モデル内での定義）

$$
m_{\text{eff},n} = \frac{1}{\mathbf n^{\mathsf T}\mathbf K_A\,\mathbf n}
$$

$m_{\text{eff},n}$ は本モデルの中で、接触点・法線・足の慣性から決まる量である。研究で用いられる「有効衝突質量」は脚の関節拘束や筋の状態も含めた量であり、これとは一致しない（§11）。特定の数値を確定した物理定数として採用しない。

### 6.13 既知の限界

- 接触時間、変形、接触力の時間履歴は出力されない（Phase 2 で扱う）。
- 剛体点接触では、ボールの回転は摩擦による衝撃量からのみ生じる。実際のキックでは変形・面接触・接触中の足の回転が関与し、本モデルの回転量が実際と定量的に一致する保証はない。
- 接線方向の弾性的な反発（接触点で接線速度が反転する現象）を表現しない。候補：接線方向の反発係数の導入（[OQ-05](research/references-and-open-questions.md)）。
- 連成がある場合、代数解は衝突中の滑り方向の変化（滑りから固着への遷移など）を正確には扱えない。固着解と滑り解の切り替えの境界で、結果は一般に不連続になる（連続性の検証 VER-C11 は、非連成で接線方向に等方的な場合に限る）。代替候補：衝撃量を独立変数とした衝突過程の積分、エネルギー的な反発係数の定義（[OQ-04](research/references-and-open-questions.md)）。
- 足・ボール・地面の同時多点接触は扱わない（§8.3）。
- $e$ と $\mu$ は定数とし、衝突速度・内圧・表面状態・湿潤への依存を無視する。

## 7. 飛翔モデル

### 7.1 運動方程式

状態 $(\mathbf x, \mathbf v, q, \boldsymbol\omega)$（ボール。添字 $B$ を省略）について

$$
\dot{\mathbf x} = \mathbf v,\qquad
m\,\dot{\mathbf v} = m\mathbf g + \mathbf F_D + \mathbf F_M,\qquad
\mathbf I\,\dot{\boldsymbol\omega} = \boldsymbol\tau_{\text{aero}},\qquad
\dot q = \tfrac12\,(0, \boldsymbol\omega)\otimes q
$$

$\otimes$ は Hamilton の四元数積、$(0, \boldsymbol\omega)$ は純虚四元数で、成分順 $[x, y, z, w]$ では $\hat{\boldsymbol\omega} = [\omega_x, \omega_y, \omega_z, 0]$ と書く（$\boldsymbol\omega$ はワールド座標、§2）。

### 7.2 重力

$\mathbf g = (0, -g, 0)$。地域による $g$ の違いは無視する。

### 7.3 空気抗力

$$
\mathbf F_D = -\tfrac12\,\rho\,A\,C_D\,|\mathbf v_r|\,\mathbf v_r,\qquad \mathbf v_r = \mathbf v - \mathbf w
$$

$\mathbf w$ は風速（Phase 1 は $\mathbf w = \mathbf 0$）。$C_D$ は定数または $Re$ などの関数として差し替え可能にする。サッカーボールでは、$C_D$ が $Re$ に強く依存する領域（いわゆる抗力危機）がキックの速度域と重なる可能性が指摘されており、定数 $C_D$ の適用範囲は調査課題とする（[OQ-07](research/references-and-open-questions.md)、R-04）。

- 係数は $C_D \ge 0$ とする（負の値はエネルギーを供給するため、入力の検証で拒否する）。
- **ゼロ速度**：$\lvert\mathbf v_r\rvert \le \varepsilon_v$ のときは、抗力・マグヌス力・§7.5 (c) のトルクをすべて $\mathbf 0$ とし、$Re$・$S$ と係数を評価しない（$S$ はこのとき定義されない）。$\varepsilon_v > 0$、値は M1.2 で決める（P-23）。

### 7.4 マグヌス力

$$
\mathbf F_M = \tfrac12\,\rho\,A\,C_L\,|\mathbf v_r|^2\,\frac{\boldsymbol\omega\times\mathbf v_r}{|\boldsymbol\omega\times\mathbf v_r|}
\qquad(|\boldsymbol\omega\times\mathbf v_r| > \varepsilon\ \text{のとき。それ以外は}\ \mathbf F_M = \mathbf 0)
$$

- $C_L$ のモデル候補：定数、$S$ の関数、測定表の補間（[OQ-07](research/references-and-open-questions.md)）。
- この形では $\boldsymbol\omega$ の $\mathbf v_r$ に平行な成分は力の向きに寄与しない。$C_L$ を $|\boldsymbol\omega|$ と $|\boldsymbol\omega_\perp|$（$\mathbf v_r$ に垂直な成分）のどちらで評価するかは未決定。実装は暫定で、§7.6 の $S$（$|\boldsymbol\omega|$ による定義）を係数の関数に渡す（T1.2-05。係数データの出典が決まったら、その定義に合わせる、OQ-07）。
- $\varepsilon$ はゼロ除算を避けるための閾値で、$\varepsilon > 0$（値は M1.2 で決める、P-21）。$\lvert\mathbf v_r\rvert \le \varepsilon_v$ の場合は §7.3 の規則が先に適用される。
- **定数 $C_L$ の制約**：$C_L$ を定数（$\neq 0$）とすると、$\lvert\boldsymbol\omega\rvert$ が小さくても力の大きさは $\tfrac12\rho A C_L\lvert\mathbf v_r\rvert^2$ のままで、$\boldsymbol\omega \to \mathbf 0$ や $\boldsymbol\omega \parallel \mathbf v_r$ に近づいても小さくならず、閾値 $\varepsilon$ の境界で不連続に 0 へ跳ぶ。このため、定数 $C_L$ は検証用（VER-F05、F10 など）と位置づけ、キックの計算には $\boldsymbol\omega \to \mathbf 0$ で $C_L \to 0$ となるモデル（例：$S$ に比例する形。係数の値と適用範囲は未決定、OQ-07）を候補とする。
- **$S$ の折れ線のモデル**（決定、2026-10-19、人間が承認）：$C_L$ を点 $(S_i, C_i)$ の列で与える。
  - 点は $S$ の昇順（狭義単調増加）に並べ、最初の点は $S = 0$ とする。
  - 点の間は線形補間する。最後の点より大きい $S$ では最後の値を使う。
  - 表が空、値が有限でない、最初の $S$ が 0 でない、$S$ が増加しない場合は `invalid-coefficient` を返す。
  - $C_L(0) = 0$ とすれば、$\boldsymbol\omega \to \mathbf 0$ で力が連続に 0 へ近づき、上の定数 $C_L$ の制約を避けられる。
  - 関数を含まない素のデータなので、一括計算（`simulateKick`）でも使える（[04 §9](04-architecture.md)）。
  - 値は §10.2 の P-13 を参照。根拠のある文献（Goff & Carré 2009）の測定は、$\boldsymbol\omega \perp \mathbf v$ のトップスピンの例である。この例では $\lvert\boldsymbol\omega\rvert = \lvert\boldsymbol\omega_\perp\rvert$ なので、$S$ の定義の違い（§7.6）は区別されない。
- 係数の符号：通常向きの揚力を $C_L > 0$ と定義する。負の $C_L$ を許すかは未決定。実装は暫定で、有限であれば符号を制限しない（マグヌス力は符号によらず仕事をしないため、エネルギーを供給しない。T1.2-05）。
- 符号の確認：$+x$ 方向に飛ぶボールのバックスピンは $\boldsymbol\omega \parallel +\hat{\mathbf z}$ で、$\hat{\mathbf z}\times\hat{\mathbf x} = +\hat{\mathbf y}$ より上向きの力になる（VER-F10）。

### 7.5 回転減衰

候補（[OQ-08](research/references-and-open-questions.md)）：

- (a) なし：$\boldsymbol\tau_{\text{aero}} = \mathbf 0$。実装検証の基準として必ず用意する。
- (b) 線形：$\boldsymbol\tau_{\text{aero}} = -c_\omega\,\boldsymbol\omega$。$c_\omega$ は有次元（kg·m²/s）で、$c_\omega \ge 0$。
- (c) 無次元トルク係数：$\boldsymbol\tau_{\text{aero}} = -\tfrac12\,\rho\,A\,R\,C_M\,|\mathbf v_r|^2\,\hat{\boldsymbol\omega}$（$C_M \ge 0$、無次元。$S$、$Re$ の関数の候補）。$\hat{\boldsymbol\omega} = \boldsymbol\omega/\lvert\boldsymbol\omega\rvert$ は $\lvert\boldsymbol\omega\rvert > \varepsilon_\omega$ のときだけ評価し、$\lvert\boldsymbol\omega\rvert \le \varepsilon_\omega$ または $\lvert\mathbf v_r\rvert \le \varepsilon_v$ のときは $\boldsymbol\tau_{\text{aero}} = \mathbf 0$ とする。$\varepsilon_\omega > 0$、値は M1.2 で決める（P-24）
  - **既知の限界**（定数 $C_M$、2026-10-18）：トルクの大きさが $\lvert\boldsymbol\omega\rvert$ によらないため、1 ステップでの減速量 $\sim \Delta t\,\lvert\boldsymbol\tau\rvert/I_B$ と同程度まで $\lvert\boldsymbol\omega\rvert$ が小さくなると、RK4 の中間段で $\hat{\boldsymbol\omega}$ の向きが反転し、更新後の $\boldsymbol\omega$ がわずかに逆向きになりうる（連続系では回転軸は反転しない）。逆向きの残りは、その減速量の程度以下。例えば $C_M = 0.01$、$\lvert\mathbf v_r\rvert = 30$ m/s、$\Delta t = 0.005$ s では約 0.03 rad/s 以下（見積もり）。補正はせず、定数 $C_M$ は §7.4 の定数 $C_L$ と同じく検証用と位置づける。$C_M$ が $S$ に比例する場合は、$\lvert\mathbf v_r\rvert$ が一定ならトルクが $\boldsymbol\omega$ に比例し（§7.5 (b) と同じ形）、RK4 の 1 ステップの増幅率 $1 - z + z^2/2 - z^3/6 + z^4/24$（$z$ は減衰率 × Δt）は実数の $z$ で常に正なので反転しない。一般の $C_M(S)$ では、$\lvert\boldsymbol\omega\rvert \to 0$ で $C_M \to 0$ となるだけでは反転しないとは限らず（反例：$C_M = S^{0.1}$ で刻みが大きい場合、IV-03-C の F-D01）、刻みが十分小さいことが必要である（Codex のレビュー指摘、人間の判断により既知の限界として記録。記述は IV-03-R で修正、2026-10-18）

### 7.6 無次元数

$$
Re = \frac{\rho\,|\mathbf v_r|\,(2R)}{\eta},\qquad S = \frac{R\,|\boldsymbol\omega|}{|\mathbf v_r|}
$$

$S$ の定義に $|\boldsymbol\omega_\perp|$ を用いる流儀もあり、採用する定義は未決定（係数データの出典の定義に合わせる）。$\lvert\mathbf v_r\rvert \le \varepsilon_v$ のときは $Re$・$S$ を評価しない（§7.3）。

### 7.7 数値積分

- 固定刻み $\Delta t$。候補：古典的 4 次ルンゲ＝クッタ法（主）、半陰的オイラー法（比較用）（[OQ-12](research/references-and-open-questions.md)）。
- 四元数は各ステップの後に正規化する。
- **地面イベント**（暫定、M1.2 で確定）：判定量を $h = y - R$ とする。
  - 検出：ステップの開始で $h > 0$、終了で $h \le 0$ のとき、そのステップ内に接地があったとみなす。終了でちょうど $h = 0$ の場合も含む（このときはステップの終了時刻を接地時刻とする）。
  - 接地時刻：**二分法**で求める。ステップの開始状態から部分刻み $\tau$ だけ同じ積分法で積分し直した $h(\tau)$ を評価し、区間幅が打ち切り幅 $\delta_t$ 以下になったら終了する。接地時刻には区間の右端（$h \le 0$ 側）を採る。$\delta_t$ の値は TOL-C とともに決める。線形補間は比較用とする（時刻の精度は通常 2 次にとどまり、積分法の次数を引き継がない）。
  - 二分法の反復回数の上限は $\lceil\log_2(\Delta t/\delta_t)\rceil$ とし、区間幅の条件を満たさなくても上限で終了する（浮動小数点の精度で区間が縮まなくなる場合への備え）。$\delta_t$ は、時刻の浮動小数点の分解能より十分大きく取る。
  - その時刻の状態で §8.1 の処理を行う。区間の右端を採るため、ボールは最大で $\lvert v_y\rvert\,\delta_t$ 程度地面に食い込む。バウンドの計算の前に、位置の $y$ 成分だけを $R$ に戻す（$x$・$z$、速度、姿勢、角速度は変えない）。この射影による位置エネルギーの変化 $m g (R - y)$（$\le m g \lvert v_y\rvert\,\delta_t$）は診断値として記録する。射影により、バウンド後の状態は $h = 0$ から始まる。
  - 残り時間：ステップの開始時刻を $t_k = k\Delta t$、接地時刻を $t^{*}$ とすると、バウンド処理の後に残り時間 $t_{k+1} - t^{*}$ を 1 回積分して $t_{k+1}$ に戻り、以降は元の刻み $t_k = k\Delta t$ に従う（結果の再現性と収束試験のため、時刻の格子をずらさない）。
  - 初期状態：飛翔の開始時に $h \le 0$ の場合（衝突直後の地面上のボールなど）は、開始時刻を接地イベントとして扱わない。$v_y < 0$ なら §8.3、$v_y = 0$ なら §8.2 の処理になる。
  - 重複の防止：バウンド処理後の状態は $h \le 0$ から始まるため、次のステップの開始で $h > 0$ という条件を満たさず、同じ接地を二重に検出しない。
  - 制約：判定はステップの両端だけで行うため、最初の接触を捉えられると保証できるのは、ステップ内で $h$ の符号が 1 回だけ変わる場合に限る。1 ステップの間に $h$ が負になって正に戻る（地面をかすめる）場合や、複数回交差する場合は検出できないか、最初の接触にならないことがある。$\Delta t$ を決める際に、この見落としが起こりうる速度域を確認する。
  - 離地と再接地が同じステップ内で起きる場合（ごく小さなバウンド）の見落としを避けるため、転がりへの移行の閾値 $v_{\text{rest}}$（§8.1）に $e_g\,v_{\text{rest}} \ge g\,\Delta t/2$ という条件を課す（$e_g > 0$ の場合）。これにより、転がりへ移らずにバウンドしたボールの滞空時間は、重力だけの近似で $\Delta t$ 以上になる。
- 終了条件：停止（§8.2）、最大シミュレーション時間、領域外（領域の定義は未決定、[OQ-25](research/references-and-open-questions.md)。決まるまでは実装しない）。
- $\Delta t$ は描画 FPS と独立に、収束試験（VER-F02）の結果から決める。

### 7.8 適用限界

- 空力は剛体球としての合力（抗力・揚力）とトルクのみで表す。パネル形状・縫い目・表面性状の影響は係数に集約する。
- 大気は一様で無風。気温・気圧・高度による密度の変化は扱わない。
- 無回転に近いボールの不規則な挙動（いわゆる無回転シュート）は再現対象外（Phase 4）。
- 空力係数は未同定であり、軌道の定量的な妥当性は保証しない。

## 8. 接地モデル

### 8.1 バウンド

- 地面を、無限質量で静止した剛体として §6 のソルバーを適用する：$\mathbf n = +\hat{\mathbf y}$、$\mathbf r_B = -R\,\hat{\mathbf y}$、地面の速度 $\mathbf 0$、係数は $e_g$、$\mu_g$。
- 連成がないため §6.8 の閉形式が使える。回転するボールのバウンドで、摩擦によってスピンと並進速度が変化する。
- 微小なバウンドが無限に続く問題を避けるため、衝突直前の法線速度 $|u_n^-|$ が閾値 $v_{\text{rest}}$ 以下になったら転がりへ移る（§8.2）。移行の瞬間は、$e_g = 0$ とした地面との衝突として同じソルバーで解き（接線方向の摩擦の衝撃を含む）、その後 $y = R$、$v_y = 0$ として転がりの状態に入る。$e_g = 0$ の場合は、バウンドの結果が移行と同じ（$v_y^+ = 0$）になるため、$|u_n^-|$ によらず常に転がりへ移る（T1.3-08、2026-10-19）。地面は静止し $\mathbf n = \hat{\mathbf y}$、$\mathbf r_B \parallel \mathbf n$ なので、$u_n^- = v_y$ である。

### 8.2 転がりと停止（暫定・優先度は調整可、[OQ-09](research/references-and-open-questions.md)）

- 拘束：$y = R$、$v_y = 0$。
- **滑りを伴う転がり**：接触点の速度 $\mathbf u_t = \mathbf v_t + \boldsymbol\omega\times(-R\hat{\mathbf y}) \ne \mathbf 0$ の間、大きさ $\mu_g m g$ の動摩擦力が $\mathbf u_t$ と逆向きに働き、並進と回転を同時に変化させる。
- **純転がり**：$\mathbf u_t = \mathbf 0$ を保つ。転がり抵抗は、重心に働く大きさ $\mu_r m g$ の力（水平速度と逆向き）とし、接触点の静止摩擦力が純転がりの拘束を保つ拘束力として働くものとする。このとき並進と回転は同時に減速し、減速度の大きさは $\mu_r g/(1+\kappa)$ になる。必要な静止摩擦力の大きさ $\kappa\,\mu_r m g/(1+\kappa)$ が $\mu_g m g$ を超える場合は、滑りを伴う転がりとして扱う。
- 鉛直軸まわりの回転（$\omega_y$）は減衰させない（Phase 1 の決定、2026-10-18）。
- **停止**：各ステップの終了時に $|\mathbf v| < v_{\text{stop}}$ かつ $|\boldsymbol\omega| < \omega_{\text{stop}}$ を判定し、最初に満たしたステップの終了時刻を停止イベントの時刻とする（ステップ内の時刻は求めない。閾値は未決定）。
- **停止の保証はしない**：$\omega_y \ne 0$ が残る場合や $\mu_r = 0$ の場合は、停止条件を満たさないことがある。その場合は最大シミュレーション時間で終了し、`max-time` イベントとして記録する。
- **転がりの間の空力**：転がりの間は空力（抗力・マグヌス力・§7.5 の回転減衰）を無視し、接地の力（動摩擦・転がり抵抗・純転がりの拘束力）だけを扱う（決定、2026-10-19）。根拠：上の減速度 $\mu_r g/(1+\kappa)$ と整合し、マグヌス力の鉛直成分による離地を扱わずに済む。転がりの速度域で抗力が無視できるかは未確認で、Phase 1 の適用限界とする。
- **滑りの間の転がり抵抗**：滑りを伴う転がりの間は、動摩擦力だけが働き、転がり抵抗は加えない（上の記述どおり、決定 2026-10-19）。このとき $\mathbf u_t$ の向きは変わらず、大きさは $\mu_g g\,(1 + 1/\kappa)$ の割合で減る（$d\mathbf u_t/dt = -\mu_g g\,(1+1/\kappa)\,\hat{\mathbf u}_t$）。
- **純転がりを保てない係数**：$\kappa\,\mu_r/(1+\kappa) > \mu_g$ の構成は扱わず、パラメータの範囲外（`invalid-parameter`）とする（決定、2026-10-19）。上の「滑りを伴う転がりとして扱う」は、この構成を許す場合の記述で、Phase 1 では使わない。$\mathbf u_t = \mathbf 0$ から滑りへ移るときの向きが、滑りの間に転がり抵抗を加えない上のモデルでは決まらないため。
- **積分**（T1.3-08）：滑り・純転がりの間はどちらも加速度と角加速度が一定なので、各ステップを、滑り → 純転がり → 静止の区間に分けて閉形式で進める（区間の切り替わりの時刻はステップ内で正確に求める。§7.7 の RK4 は使わない）。純転がりに入るときは、水平の角速度を拘束 $\mathbf u_t = \mathbf 0$ から $\omega_x = v_z/R$、$\omega_z = -v_x/R$ と定める。静止した後は水平の速度と回転を 0 とし、$\omega_y$ だけを残す。姿勢は力学に影響しないため、閉形式の $\boldsymbol\omega(t)$ を使って区間ごとに RK4 で積分し、正規化する。
- 芝の変形・芝目・人工芝の挙動は扱わない。

### 8.3 キックの瞬間の地面

- ボールは初期に地面の上で静止している。キックの衝突中に地面から受ける反力の衝撃は無視する（§6.1 の単一点接触の仮定）。
- 衝突後の速度が地面へ向かう成分を持つ場合（$v_y^+ < 0$）は、飛翔の開始直後に §8.1 のバウンドとして処理する。
- 実際には足・ボール・地面が同時に接触しうる。この扱いは Phase 2 以降で再検討する（[OQ-10](research/references-and-open-questions.md)）。

## 9. 測定値の定義

| 測定値 | 定義 |
|---|---|
| 初速 | 足との衝突直後のボール速度 $\mathbf v^+$ の大きさ |
| 打ち出し角（垂直） | $\theta = \operatorname{atan2}\!\left(v_y^+, \sqrt{(v_x^+)^2 + (v_z^+)^2}\right)$ |
| 打ち出し方向（水平） | $\psi = \operatorname{atan2}(v_z^+, v_x^+)$（右が正） |
| スピン量 | 衝突直後の $\vert \boldsymbol\omega^+\vert $。表示は rpm |
| スピン成分 | 衝突直後の速度方向に基づく正規直交基底 $\mathbf e_1 = \hat{\mathbf v}$、$\mathbf e_2 = (\hat{\mathbf v}\times\hat{\mathbf y})/\vert \hat{\mathbf v}\times\hat{\mathbf y}\vert $、$\mathbf e_3 = \mathbf e_2\times\mathbf e_1$ への射影。$\omega_{\text{gyro}} = \boldsymbol\omega\cdot\mathbf e_1$（進行方向軸まわり）、$\omega_{\text{back}} = \boldsymbol\omega\cdot\mathbf e_2$（正がバックスピン）、$\omega_{\text{side}} = \boldsymbol\omega\cdot\mathbf e_3$（正のとき、マグヌス力は進行方向に対して左向き）。$\hat{\mathbf v}$ が鉛直に近い場合は定義できないため「定義不能」とする（判定：$\lvert\hat{\mathbf v}\times\hat{\mathbf y}\rvert \le \varepsilon_{\text{vert}}$、または $\mathbf v^+ = \mathbf 0$。$\varepsilon_{\text{vert}}$ は P-27、仮置き、T1.2-09） |
| 最高到達点 | 最初の接地までのボール中心の高さ $y$ の最大値 |
| キャリー | 初期のボール中心と、最初の接地時のボール中心との水平距離 |
| 着地点 | 最初の接地時のボール中心の $(x, z)$ |
| 横ずれ | 着地点の $z$ |
| 飛行時間 | 足との衝突から最初の接地までの時間 |
| 総距離 | 初期のボール中心と、停止イベントの時刻のボール中心との水平距離（キャリーと同じ基準）。停止イベントがない場合（最大シミュレーション時間で終了した場合を含む）は定義しない（T1.3-08、2026-10-19） |

実装（暫定、T1.2-09、`packages/physics-core/src/metrics/flight-metrics.ts`）：衝突直後の状態は軌道の最初のサンプルとする（VER-S02）。最高到達点は、サンプルの最大値に加えて、$v_y$ が正から 0 以下に変わる区間を位置と速度の 3 次エルミート補間で補って求める（誤差は $O(\Delta t^4)$、真空中の放物運動では厳密）。「最初の接地」には飛翔の開始時刻の地面上の処理（§7.7 の「初期状態」。イベント種別は `start-on-ground`）を含めない（決定、2026-10-18）。接地がない場合（最大時間で終了）は、飛行時間・着地点・キャリー・横ずれを「なし」とし、最高到達点は軌道の終わりまでの最大値とする。

表示名（「左回転」など）や表示単位は UI で決める。定義そのものは本表を正本とする。

## 10. パラメータ表

### 10.1 確からしさの区分

| 区分 | 意味 |
|---|---|
| 定義値 | 定義によって決まる値 |
| 規格値 | 規格・規則で定められた値や範囲。本表では一次情報との照合状況を併記する |
| 文献値 | 一次情報を確認した文献の値。適用条件を併記する |
| 実測同定 | 本プロジェクトの実測から同定した値 |
| 仮置き | 動作確認のための暫定値。物理的根拠がないか弱い |
| 仮定 | 対象範囲の決定として置く値（例：Phase 1 は無風）。測定や文献の値ではない |
| 未決定 | 値もモデルも決まっていない |

### 10.2 パラメータ一覧（初版）

| ID | 記号 | 意味 | 単位 | 値 | 確からしさ | 出典・備考 |
|---|---|---|---|---|---|---|
| P-01 | $m_B$ | ボール質量 | kg | 0.43（規格の範囲 0.41–0.45 の中央） | 仮置き（範囲は規格値・照合済み） | 範囲は IFAB 競技規則 第 2 条 1 項（theifab.com の最新版、2026-10-19 照合）：試合開始時に 410–450 g。中央の値を選んだのは仮置き（2026-10-19、人間が承認） |
| P-02 | $R$ | ボール半径 | m | $0.69/2\pi \approx 0.1098$（外周の範囲 0.68–0.70 m の中央から換算、$R = C/2\pi$） | 仮置き（範囲は規格値・照合済み） | 範囲は IFAB 競技規則 第 2 条 1 項（theifab.com の最新版、2026-10-19 照合）：外周 68–70 cm。中央の値を選んだのは仮置き（2026-10-19、人間が承認） |
| P-03 | $\kappa$ | ボール慣性係数 | — | 2/3 | 仮置き | 出典なし（2026-10-19、人間が承認）。薄い球殻の式 $\tfrac23 mR^2$ を当てはめた値。実測値は見つかっていない。実際の殻は厚みを持つため、2/3 よりやや小さい可能性がある。OQ-06 |
| P-04 | $m_A$ | 足の質量 | kg | 1.2 | 仮置き | 出典なし（2026-10-18、T0-08、人間が承認）。成人の足と靴を合わせたおおよその質量として置いた動作確認用の値。一次情報で確認した文献値ではない。脚の関節拘束を含む「有効衝突質量」（§11）とは別の量。OQ-02 |
| P-05 | $\mathbf I_A^{\text{body}}$ | 足の慣性テンソル | kg·m² | P-04・P-06 から §5.2 の直方体の式で計算：$\mathrm{diag}(0.00164,\ 0.0074,\ 0.00776)$ | 仮置き | 一様密度の仮定。P-04・P-06 が仮置きのため仮置き。OQ-02 |
| P-06 | $L_x,\ L_y,\ L_z$ | 足（直方体）の寸法 | m | $(0.26,\ 0.10,\ 0.08)$ | 仮置き | 出典なし（2026-10-18、T0-08、人間が承認）。$L_x$ を足の長さ、$L_y$ を幅、$L_z$ を厚さとみなした、靴を含むおおよその大きさ。接触面（$+z_b$ 面）は $L_x \times L_y$。一次情報で確認した値ではない。OQ-02 |
| P-07 | $e$ | 足–ボールの反発係数 | — | 0.5 | 仮置き | 出典なし（2026-10-19、人間が承認）。二次情報に蹴りの反発係数 0.46–0.68 の記載があるが、一次情報は未照合。また、その値は足の「有効質量」を使う定義で、本モデルの自由剛体どうしの $e$ とは別の量（§11）。衝突速度・内圧に依存する可能性。OQ-04 |
| P-08 | $\mu$ | 足–ボールの摩擦係数 | — | 0.5 | 仮置き | 出典なし（2026-10-19、人間が承認）。靴の材質・湿潤に依存する可能性。OQ-05 |
| P-09 | $g$ | 重力加速度 | m/s² | 9.80665 | 定義値 | 標準重力。地域差は無視 |
| P-10 | $\rho$ | 空気の密度 | kg/m³ | 1.225 | 規格値（一次情報未照合） | 国際標準大気の海面値（15 °C、101 325 Pa）とされる値。二次情報（大学の教材の表）で確認。実際の気象条件では変わる |
| P-11 | $\eta$ | 空気の粘性係数 | Pa·s | $1.789\times10^{-5}$ | 規格値（一次情報未照合） | 国際標準大気の海面値とされる値。二次情報で、P-10 との比が動粘性係数 $1.460\times10^{-5}$ m²/s と整合することを確認。$Re$ を使う係数モデルでだけ使う（一括計算では使わない、04 §6） |
| P-12 | $C_D$ | 抗力係数 | — | 0.2（定数） | 文献値 | Goff, J. E. & Carré, M. J., "Trajectory analysis of a soccer ball", Am. J. Phys. 77(11), 1020–1027 (2009), doi:10.1119/1.3197187。発射装置による無回転の軌道の到達距離から同定（32 枚パネルの 5 号球、初速約 18 m/s、$Re \approx 2.6\times10^5$）。同じ論文の最高速度（$2.23$–$2.76\times10^5$）では 0.17。適用条件：抗力危機より高い $Re$、無回転。回転による $C_D$ の増加と抗力危機は表さない（2026-10-19、人間が承認）。OQ-07 |
| P-13 | $C_L$ | 揚力（マグヌス）係数 | — | $S$ の折れ線 $(0, 0)$、$(0.25, 0.3)$、$(1, 0.3)$（§7.4） | 仮置き（値の水準は文献値） | 値の水準は Goff, J. E. & Carré, M. J., "Trajectory analysis of a soccer ball", Am. J. Phys. 77(11), 1020–1027 (2009), doi:10.1119/1.3197187 の Fig. 14：トップスピンの 4 例で $\lvert C_L\rvert$ 0.27–0.31（$S$ 0.24–0.71、$Re$ 2.6–3.1 × 10⁵）。$S$ = 0 で 0、$S \le 0.25$ を直線で結ぶ形と、$S > 0.71$ で一定とする形は仮定（2026-10-19、人間が承認）。OQ-07 |
| P-14 | $c_\omega$ | 線形の回転減衰係数（§7.5 (b)） | kg·m²/s | 未決定 | 未決定 | $c_\omega \ge 0$。OQ-08 |
| P-15 | $e_g$ | 地面の反発係数 | — | 0.6 | 仮置き | 出典なし（2026-10-19、人間が承認）。FIFA の人工芝の品質基準に垂直反発 60–100 cm の範囲がある（試験法 FIFA 01）が、落下の高さを一次情報で確認していないため換算していない。地面の種類に依存。OQ-09 |
| P-16 | $\mu_g$ | 地面の摩擦係数 | — | 0.6 | 仮置き | 出典なし（2026-10-19、人間が承認）。OQ-09 |
| P-17 | $\mu_r$ | 転がり抵抗係数 | — | 0.05 | 仮置き | 出典なし（2026-10-19、人間が承認）。$\kappa\,\mu_r/(1+\kappa) \le \mu_g$ の条件あり（§8.2。P-03・P-16 の仮置きでは 0.02 ≤ 0.6）。OQ-09 |
| P-18 | $\Delta t$ | 物理の時間刻み | s | 候補 0.005 | 仮置き | 収束試験（VER-F02、06 §4.2 の記録）で精度は制約にならないことを確認し、他の制約に余裕を持たせた暫定の候補（T1.2-04）。確定は OQ-12 |
| P-19 | $v_{\text{rest}},\ v_{\text{stop}},\ \omega_{\text{stop}}$ | 転がり移行・停止の閾値 | m/s, rad/s | 0.1、0.05、0.5 | 仮置き | 数値上の閾値で、出典なし（2026-10-19、人間が承認）。$e_g v_{\text{rest}} \ge g\Delta t/2$ の条件あり（§7.7、接地のたびに確認し、満たさなければ `invalid-parameter`。P-15・P-18 の仮置きでは 0.06 ≥ 0.0245）。$v_{\text{stop}},\ \omega_{\text{stop}} > 0$（停止の判定が厳密な不等号のため、0 では静止しても停止しない）。OQ-09 |
| P-20 | $\mathbf w$ | 風速 | m/s | $\mathbf 0$ | 仮定 | Phase 1 は無風 |
| P-21 | $\varepsilon$ | マグヌス力の縮退判定の閾値（$\lvert\boldsymbol\omega\times\mathbf v_r\rvert$ に対する） | m/s² 相当 | $10^{-9}$ | 仮置き | 数値上の閾値、$\varepsilon > 0$（T1.2-05）。根拠：$\boldsymbol\omega \parallel \mathbf v_r$ のときの外積の丸め誤差は $\lvert\boldsymbol\omega\rvert\lvert\mathbf v_r\rvert$ の機械イプシロン（約 $2.2\times10^{-16}$）倍の数倍で、$\lvert\boldsymbol\omega\rvert \le 10^3$ rad/s・$\lvert\mathbf v_r\rvert \le 10^2$ m/s の範囲では $10^{-10}$ 未満。これより大きく、力の向きの計算に意味がある最小の大きさとして選んだ。物理的な根拠はない |
| P-22 | $C_M$ | 空力トルク係数（§7.5 (c)） | — | 未決定 | 未決定 | $C_M \ge 0$。OQ-08 |
| P-23 | $\varepsilon_v$ | ゼロ速度の判定閾値（$\lvert\mathbf v_r\rvert$ に対する） | m/s | $10^{-6}$ | 仮置き | 数値上の閾値、$\varepsilon_v > 0$（T1.2-05）。根拠：抗力は $\lvert\mathbf v_r\rvert^2$ に比例し 0 で連続なので、閾値以下で 0 とすることによる力の差は $\tfrac12\rho A C_D\varepsilon_v^2$（$C_D \le 1$ で約 $2\times10^{-14}$ N）で無視できる。$S$ の分母が 0 に近づくことを避ける目的だけの値。物理的な根拠はない |
| P-25 | $\varepsilon_t$ | 接線速度がほぼ 0 とみなす閾値（$\lvert\mathbf u_t^-\rvert$ に対する、§6.8） | m/s | $10^{-9}$ | 仮置き | 数値上の閾値（T1.3-03）。根拠：$\mathbf u_t^-$ の計算に残る丸め誤差は $\lvert\mathbf u^-\rvert$ の機械イプシロン倍の数倍で、$\lvert\mathbf u^-\rvert \le 100$ m/s では $10^{-13}$ 程度。これより十分大きく、滑り方向 $\mathbf u_t^-/\lvert\mathbf u_t^-\rvert$ が丸め誤差で決まる状況を避ける目的だけの値。物理的な根拠はない |
| P-26 | $\varepsilon_\phi$ | $\phi$ の基準軸を切り替える閾値（$\hat{\mathbf y}$ の射影の長さに対する、§6.2） | — | $10^{-6}$ | 仮置き | 数値上の閾値（T1.3-06）。根拠：射影の長さ $\ell$ で正規化した基準軸の相対誤差は機械イプシロン $/\ell$ 程度で、$\ell = 10^{-6}$ でも約 $2\times10^{-10}$。$\mathbf n$ と $\hat{\mathbf y}$ のなす角が約 $6\times10^{-5}$ 度以内のときだけ切り替わる。物理的な根拠はない |
| P-24 | $\varepsilon_\omega$ | 無回転の判定閾値（$\lvert\boldsymbol\omega\rvert$ に対する、§7.5 (c)） | rad/s | $10^{-6}$ | 仮置き | 数値上の閾値、$\varepsilon_\omega > 0$（T1.2-06）。根拠：$\hat{\boldsymbol\omega}$ の正規化でのゼロ除算を避ける目的だけの値。$10^{-6}$ rad/s は約 $10^{-5}$ rpm で、表示・測定値に影響しない。定数 $C_M$ では閾値の境界でトルクが不連続に 0 になる（§7.4 の定数 $C_L$ と同じ性質）。物理的な根拠はない |
| P-27 | $\varepsilon_{\text{vert}}$ | スピン成分を定義不能とする閾値（$\lvert\hat{\mathbf v}\times\hat{\mathbf y}\rvert$ に対する、§9） | — | $10^{-6}$ | 仮置き | 数値上の閾値（T1.2-09）。根拠：$\lvert\hat{\mathbf v}\times\hat{\mathbf y}\rvert = \cos\theta$ で、$10^{-6}$ は打ち出し角が鉛直から約 $6\times10^{-5}$ 度以内。基底 $\mathbf e_2$ の正規化の分母が丸め誤差の水準まで小さくなることを避ける目的だけの値。物理的な根拠はない。§9 に閾値の記載がなかったため追加した（追加と値の仮置きを承認、2026-10-18） |
| P-28 | $\tau_{\text{diag}}$ | 衝突診断の警告の相対的な判定幅（§6.8 の手順 5、§6.11） | — | $10^{-9}$ | 仮置き | 数値上の閾値（T1.3-05）。衝突の係数 `diagnosticRelativeTolerance` として渡す（Core は既定値を持たない。PR #12 のレビューで、ソルバーの固定値から変更、2026-10-20）。エネルギー増加は $\Delta T > \tau_{\text{diag}} \cdot \tfrac12\lvert\mathbf J\rvert(\lvert\mathbf u^-\rvert + \lvert\mathbf u^+\rvert)$、滑り方向の反転は $\mathbf u_t^+\cdot\hat{\mathbf t} < -\tau_{\text{diag}}\lvert\mathbf u^-\rvert$ のとき警告する。根拠：$\Delta T$ の各項の大きさに対する丸め誤差は機械イプシロンの数十倍程度で、それより十分大きく、物理的に意味のある増加（探索で見つかった例は $10^{-2}$ J 以上）より十分小さい。物理的な根拠はない |

- 値を変更したら、確からしさ・出典・適用条件を同時に更新する。
- UI のデフォルト値として「仮置き」の値を使う場合も、本表に値と「仮置き」の区分を記録する。

### 10.3 一括計算の入口で受け付ける範囲（仮置き）

`simulateKick`（[04 §6](04-architecture.md)）は、入力・物性値・設定が次の範囲にあることを入口でまとめて確かめ、範囲外なら補正や切り詰めをせずにエラーを返す（`packages/physics-core/src/pipeline/ranges.ts`）。

- **区分：仮置き**（2026-10-19、人間が承認）。
- **目的**：極端な値による桁あふれと、入力の誤りを防ぐことだけ。範囲は現実のキックで想定される値に数倍から 1 桁の余裕を持たせた。
- **意味しないこと**：現実の値の範囲でも、モデルの適用範囲でもない。
- 個々の関数は極端な値の組み合わせを扱わない（`packages/physics-core/AGENTS.md`）。

| 対象 | 範囲 | エラーの種別 |
|---|---|---|
| 接触点での足の速さ $\lvert\mathbf v_A^p\rvert$ | $\le 60$ m/s | `invalid-input` |
| 足の角速度の大きさ $\lvert\boldsymbol\omega_A\rvert$ | $\le 200$ rad/s | `invalid-input` |
| $m_B$（P-01） | 0.1–2 kg | `invalid-parameter` |
| $R$（P-02） | 0.05–0.3 m | 同上 |
| $\kappa$（P-03） | $0 < \kappa \le 1$ | 同上 |
| $m_A$（P-04） | 0.1–50 kg | 同上 |
| $L_x,\ L_y,\ L_z$（P-06） | 各 0.01–1 m | 同上 |
| $e$（P-07）、$e_g$（P-15） | 0–1 | 同上 |
| $\mu$（P-08）、$\mu_g$（P-16） | 0–2 | 同上 |
| $\mu_r$（P-17） | 0–1 | 同上 |
| $C_D$（P-12） | 0–2 | 同上 |
| $C_L$（P-13） | $-2$–2 | 同上 |
| $C_M$（P-22） | 0–1 | 同上 |
| $c_\omega$（P-14） | 0–1 kg·m²/s | 同上 |
| $g$（P-09） | 1–30 m/s² | 同上 |
| $\rho$（P-10） | 0–2 kg/m³ | 同上 |
| $\lvert\mathbf w\rvert$（P-20） | $\le 50$ m/s | 同上 |
| $\Delta t$（P-18） | $10^{-5}$–0.05 s | 同上 |
| 最大シミュレーション時間 | $0 <$ maxTime $\le 120$ s | `invalid-setting` |
| ステップ数 maxTime / $\Delta t$ | $\le 10^6$ | 同上 |

- 範囲は、計算に使うパラメータだけに適用する。たとえば抗力が OFF なら $C_D$ は確かめず、最初の接地で終了する設定なら地面の係数は確かめず、無限質量の足なら $m_A$ は確かめない。
- 閾値（P-19、P-21、P-23〜P-28）には範囲を設けず、各段階の検証（正の有限値など）だけを行う。縮退判定の閾値（P-21・P-23・P-24）は、対応する力項を使うときだけ要求する。P-27 は未決定でもよい（スピン成分を定義不能とする）。
- 計算に使うパラメータの値が未決定（値なし）なら、該当する ID をまとめて `invalid-parameter` で返す。Core は既定値を持たない。

## 11. 理論上の注意

- **有限質量の自由剛体の足は、実際の蹴り脚の完全なモデルではない。** 実際の足は足首・膝・股関節の拘束、筋力、関節剛性の影響を受ける。
- 研究で用いられる「有効衝突質量」は足単体の質量と同じではなく、接触位置・方向・姿勢・関節拘束に依存する。任意の数値を確定した物理定数として採用しない。
- 無限質量の動く壁は、外部から駆動される運動学的境界としての近似であり、足とボールだけの閉じた系を表さない。
- **接触時間は瞬間衝突モデルの出力ではない。** Phase 1 のモデルで接触時間・変形・圧力分布を再現できるかのように記述・表示しない。
- 保存則を検証するときは、外力、反発係数、摩擦、非弾性による散逸、拘束条件などの前提を明記する（[06](06-validation.md)）。

## 12. キック種別の扱い

- Phase 1 では、キック種別は**入力条件の組**（接触点、足の移動方向、足の姿勢、足上の接触位置）として近似的に表現するに留まる。
- キック種別ごとの出力補正（「インサイドなら一定のスピンを付与する」など）は行わない。
- 足の部位による形状・硬さ・曲率の違いは Phase 3 で、足形状と面接触として扱う。

## 13. 将来モデルへの拡張方針

| Phase | 拡張 | 候補手法 | Phase 1 との整合 |
|---|---|---|---|
| 2 | 有限時間接触・簡易変形 | 接触力モデル（線形ばね–ダンパ、非線形ばね＋減衰、ボールの膜・内圧モデルなど）を時間積分し、接触中の力・速度・姿勢変化を計算 | 剛体極限（硬いばね）で瞬間衝突モデルの速度変化と一致することを検証項目にする |
| 3 | 面接触・足形状 | 足形状の解析形状またはメッシュ、接触領域の算出、圧力・せん断分布、局所的な滑り／固着 | 接触領域を点に縮めた極限で点接触モデルと一致すること |
| 4 | 関節拘束・高精度化 | 関節拘束付き多剛体の脚、関節剛性・筋力、FEM などの変形モデル、速度・回転・表面性状に依存する空力 | 拘束を外した極限で自由剛体の足と一致すること |

- 接触ソルバーは「衝突直前状態 → 衝突直後状態（＋将来は時系列）」のインタフェースで差し替える（[04 §1](04-architecture.md)）。
- 研究・実験データとの照合を通じてモデルを改良する（[06](06-validation.md)、[research](research/references-and-open-questions.md)）。

## 14. 未決定事項

本書に関係する未決定事項：OQ-02、OQ-03（UI での表現）、OQ-04〜OQ-10、OQ-12、OQ-23、OQ-25。OQ-01（足の形状）と OQ-11（座標系）は決定済み。一覧は [research/references-and-open-questions.md](research/references-and-open-questions.md) を正本とする。
