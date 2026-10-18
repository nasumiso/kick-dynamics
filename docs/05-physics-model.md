# 05 物理モデル（正本）

> 状態：Phase 1 モデル（PM-1）の設計初版（2026-10-18）。**未実装・未検証。**
> 本書は物理モデルの数式・記号・座標系・単位系・仮定・適用限界・パラメータ表の正本です。他の文書は本書を参照し、数式を複製しません。
> 数式は GitHub の数式記法（`$...$`）で記述しています。

## 1. 単位系

- 内部計算と Core の入出力は SI 単位：m、kg、s、N、rad、rad/s、kg·m²、N·s（衝撃量）。
- 角度は rad。表示用の単位（km/h、rpm、度、cm）への変換は表示層（`apps/web/src/units/`）でのみ行う。
  - $1\ \mathrm{m/s} = 3.6\ \mathrm{km/h}$
  - $\mathrm{rpm} = |\boldsymbol\omega| \cdot 60 / (2\pi)$（$|\boldsymbol\omega|$ は rad/s）

## 2. 座標系（暫定、[OQ-11](research/references-and-open-questions.md)）

- **ワールド座標系 W**：右手系。
  - 原点：初期のボール中心の真下の地面上の点
  - $+y$：鉛直上向き
  - $+x$：基準となる蹴り出し方向（例：ゴール方向）
  - $+z = \hat{\mathbf x} \times \hat{\mathbf y}$：$+x$ を向いて立ったときの右手側
- **地面**：平面 $y = 0$（Phase 1 は水平・平坦）。
- **物体座標系**：ボール（B）と足（A）それぞれの重心を原点とし、剛体に固定。
- **姿勢**：単位四元数 $q$ で表し、物体座標 → ワールド座標の回転を表す。対応する回転行列を $\mathbf R(q)$ とする。四元数の成分順・積の規約は M1.1 で確定する。
- **角速度**：API 上はワールド座標で表す。
- **慣性テンソル**：物体座標で定義し、ワールド座標では $\mathbf I_W = \mathbf R \mathbf I_{\text{body}} \mathbf R^{\mathsf T}$。

y 軸を上向きにする案は、Three.js の既定と一致させて変換の誤りを減らすことを狙った**暫定案**。z 軸上向きを採る場合は本書を正本として更新する。

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
| $\mathbf J,\ j_n,\ \mathbf J_t$ | ボールに加わる衝撃量とその法線・接線成分 | N·s |
| $\mathbf K$ | 衝撃量 → 相対速度変化の行列 | 1/kg |
| $e,\ \mu$ | 足–ボール間の反発係数・摩擦係数 | — |
| $e_g,\ \mu_g$ | 地面–ボール間の反発係数・摩擦係数 | — |
| $\mathbf E$ | 3×3 単位行列 | — |
| $[\mathbf a]_\times$ | 外積行列（$[\mathbf a]_\times \mathbf b = \mathbf a \times \mathbf b$） | — |
| 上付き $-$ / $+$ | 衝突直前 / 直後 | — |
| $g$ | 重力加速度の大きさ | m/s² |
| $\rho,\ \eta$ | 空気の密度・粘性係数 | kg/m³, Pa·s |
| $A = \pi R^2$ | ボールの投影面積 | m² |
| $C_D,\ C_L,\ C_M$ | 抗力係数・揚力（マグヌス）係数・空力トルク係数 | — |
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
- 幾何形状は簡略化する。候補：直方体、楕円体、カプセル、平面の接触面 ＋ 重心オフセット（[OQ-01](research/references-and-open-questions.md)）。
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
- UI 上でこれらの自由度をどう表現するかは未決定（[OQ-03](research/references-and-open-questions.md)）。
- **接触の成立条件**：$u_n^- < 0$（接触点で互いに近づいている）。$u_n^- \ge 0$ の場合、衝突は起きず衝撃量は $\mathbf 0$ とする（Core はその旨を結果で返す）。
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

1. $u_n^- \ge 0$ なら $\mathbf J = \mathbf 0$（`separating`）として終了。
2. **固着を仮定した解**：$\mathbf u^+ = -e\,u_n^-\,\mathbf n$ を満たす衝撃量
   $$
   \mathbf J^{*} = \mathbf K^{-1}\left(-e\,u_n^-\,\mathbf n - \mathbf u^-\right)
   $$
3. $j_n^{*} = \mathbf J^{*}\cdot\mathbf n \ge 0$ かつ $|\mathbf J^{*}_t| \le \mu\, j_n^{*}$ なら固着を採用する（`stick`）。
4. そうでなければ滑りとする（`slide`）。滑り方向は $\hat{\mathbf t} = \mathbf u_t^-/|\mathbf u_t^-|$。$\mathbf J = j_n(\mathbf n - \mu\hat{\mathbf t})$ として法線方向の反発条件から
   $$
   j_n = \frac{-(1+e)\,u_n^-}{\mathbf n^{\mathsf T}\mathbf K(\mathbf n - \mu\hat{\mathbf t})}
   $$
   - $|\mathbf u_t^-|$ がほぼ 0 なのに固着解が摩擦円錐を外れる場合（$\mathbf K$ の連成による）は、$\hat{\mathbf t} = -\mathbf J^{*}_t/|\mathbf J^{*}_t|$ を近似として用い、警告を出す。
   - 分母が 0 以下になる場合は解けないものとしてエラーを返す。
5. 診断：固着／滑りの別、衝突前後の運動エネルギー・運動量・角運動量を出力する。運動エネルギーの増加、滑り方向の反転（$\mathbf u_t^+\cdot\hat{\mathbf t} < 0$）を検出したら警告を出す（§6.11、§6.13）。

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
- **運動エネルギーの変化**（両モデル共通）：
  $$
  \Delta T = \tfrac12\,\mathbf J\cdot\left(\mathbf u^- + \mathbf u^+\right)
  $$
  摩擦なしの場合は $\Delta T = -\tfrac12(1-e^2)\,(u_n^-)^2 / (\mathbf n^{\mathsf T}\mathbf K\mathbf n) \le 0$。$e = 1$ なら保存される。
- **摩擦あり**：連成がない場合（§6.8 の閉形式）は $\Delta T \le 0$ が成り立つ。$\mathbf K$ が法線と接線を連成する場合、Newton 反発 ＋ Coulomb 摩擦の代数解は $\Delta T \le 0$ を保証しない構成があることが知られている。Core はこれを診断で検出し警告する（VER-C14）。
- **無限質量モデル**：ボール単体の運動量・エネルギーは保存されない。ただし $\boldsymbol\omega_A = \mathbf 0$ のとき、足とともに並進する慣性系から見たボールの運動エネルギーは増加しない（VER-C16）。

### 6.12 足の有効質量（本モデル内での定義）

$$
m_{\text{eff},n} = \frac{1}{\mathbf n^{\mathsf T}\mathbf K_A\,\mathbf n}
$$

$m_{\text{eff},n}$ は本モデルの中で、接触点・法線・足の慣性から決まる量である。研究で用いられる「有効衝突質量」は脚の関節拘束や筋の状態も含めた量であり、これとは一致しない（§11）。特定の数値を確定した物理定数として採用しない。

### 6.13 既知の限界

- 接触時間、変形、接触力の時間履歴は出力されない（Phase 2 で扱う）。
- 剛体点接触では、ボールの回転は摩擦による衝撃量からのみ生じる。実際のキックでは変形・面接触・接触中の足の回転が関与し、本モデルの回転量が実際と定量的に一致する保証はない。
- 接線方向の弾性的な反発（接触点で接線速度が反転する現象）を表現しない。候補：接線方向の反発係数の導入（[OQ-05](research/references-and-open-questions.md)）。
- 連成がある場合、代数解は衝突中の滑り方向の変化（滑りから固着への遷移など）を正確には扱えない。代替候補：衝撃量を独立変数とした衝突過程の積分、エネルギー的な反発係数の定義（[OQ-04](research/references-and-open-questions.md)）。
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

$\otimes$ は四元数の積（$\boldsymbol\omega$ はワールド座標）。四元数の微分の式の形は、M1.1 で確定する成分順・積の規約に合わせて正本を更新する。

### 7.2 重力

$\mathbf g = (0, -g, 0)$。地域による $g$ の違いは無視する。

### 7.3 空気抗力

$$
\mathbf F_D = -\tfrac12\,\rho\,A\,C_D\,|\mathbf v_r|\,\mathbf v_r,\qquad \mathbf v_r = \mathbf v - \mathbf w
$$

$\mathbf w$ は風速（Phase 1 は $\mathbf w = \mathbf 0$）。$C_D$ は定数または $Re$ などの関数として差し替え可能にする。サッカーボールでは、$C_D$ が $Re$ に強く依存する領域（いわゆる抗力危機）がキックの速度域と重なる可能性が指摘されており、定数 $C_D$ の適用範囲は調査課題とする（[OQ-07](research/references-and-open-questions.md)、R-04）。

### 7.4 マグヌス力

$$
\mathbf F_M = \tfrac12\,\rho\,A\,C_L\,|\mathbf v_r|^2\,\frac{\boldsymbol\omega\times\mathbf v_r}{|\boldsymbol\omega\times\mathbf v_r|}
\qquad(|\boldsymbol\omega\times\mathbf v_r| > \varepsilon\ \text{のとき。それ以外は}\ \mathbf F_M = \mathbf 0)
$$

- $C_L$ のモデル候補：定数、$S$ の関数、測定表の補間（[OQ-07](research/references-and-open-questions.md)）。
- この形では $\boldsymbol\omega$ の $\mathbf v_r$ に平行な成分は力の向きに寄与しない。$C_L$ を $|\boldsymbol\omega|$ と $|\boldsymbol\omega_\perp|$（$\mathbf v_r$ に垂直な成分）のどちらで評価するかは未決定。
- $\varepsilon$ はゼロ除算を避けるための閾値（値は M1.2 で決める）。
- 符号の確認：$+x$ 方向に飛ぶボールのバックスピンは $\boldsymbol\omega \parallel +\hat{\mathbf z}$ で、$\hat{\mathbf z}\times\hat{\mathbf x} = +\hat{\mathbf y}$ より上向きの力になる（VER-F10）。

### 7.5 回転減衰

候補（[OQ-08](research/references-and-open-questions.md)）：

- (a) なし：$\boldsymbol\tau_{\text{aero}} = \mathbf 0$。実装検証の基準として必ず用意する。
- (b) 線形：$\boldsymbol\tau_{\text{aero}} = -c_\omega\,\boldsymbol\omega$
- (c) 無次元トルク係数：$\boldsymbol\tau_{\text{aero}} = -\tfrac12\,\rho\,A\,R\,C_M\,|\mathbf v_r|^2\,\hat{\boldsymbol\omega}$（$C_M$ は $S$、$Re$ の関数の候補）

### 7.6 無次元数

$$
Re = \frac{\rho\,|\mathbf v_r|\,(2R)}{\eta},\qquad S = \frac{R\,|\boldsymbol\omega|}{|\mathbf v_r|}
$$

$S$ の定義に $|\boldsymbol\omega_\perp|$ を用いる流儀もあり、採用する定義は未決定（係数データの出典の定義に合わせる）。

### 7.7 数値積分

- 固定刻み $\Delta t$。候補：古典的 4 次ルンゲ＝クッタ法（主）、半陰的オイラー法（比較用）（[OQ-12](research/references-and-open-questions.md)）。
- 四元数は各ステップの後に正規化する。
- **地面イベント**：ステップ内で $y - R$ の符号が正から負に変わったら、接触時刻をステップ内で求め（線形補間、二分法などの候補）、その時刻まで積分し直してから §8.1 の処理を行う。
- 終了条件：停止（§8.2）、最大シミュレーション時間、領域外。
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
- 微小なバウンドが無限に続く問題を避けるため、衝突直前の法線速度 $|u_n^-|$ が閾値 $v_{\text{rest}}$ 以下になったら転がりへ移る（§8.2）。

### 8.2 転がりと停止（暫定・優先度は調整可、[OQ-09](research/references-and-open-questions.md)）

- 拘束：$y = R$、$v_y = 0$。
- **滑りを伴う転がり**：接触点の速度 $\mathbf u_t = \mathbf v_t + \boldsymbol\omega\times(-R\hat{\mathbf y}) \ne \mathbf 0$ の間、大きさ $\mu_g m g$ の動摩擦力が $\mathbf u_t$ と逆向きに働き、並進と回転を同時に変化させる。
- **純転がり**：$\mathbf u_t = \mathbf 0$ を保ち、転がり抵抗を候補モデル（例：大きさ $\mu_r m g$ の減速力）で与える。
- 鉛直軸まわりの回転（$\omega_y$）の減衰は未決定。
- **停止**：$|\mathbf v| < v_{\text{stop}}$ かつ $|\boldsymbol\omega| < \omega_{\text{stop}}$ で停止とする（閾値は未決定）。
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
| スピン量 | 衝突直後の $|\boldsymbol\omega^+|$。表示は rpm |
| スピン成分 | 衝突直後の速度方向に基づく正規直交基底 $\mathbf e_1 = \hat{\mathbf v}$、$\mathbf e_2 = (\hat{\mathbf v}\times\hat{\mathbf y})/|\hat{\mathbf v}\times\hat{\mathbf y}|$、$\mathbf e_3 = \mathbf e_2\times\mathbf e_1$ への射影。$\omega_{\text{gyro}} = \boldsymbol\omega\cdot\mathbf e_1$（進行方向軸まわり）、$\omega_{\text{back}} = \boldsymbol\omega\cdot\mathbf e_2$（正がバックスピン）、$\omega_{\text{side}} = \boldsymbol\omega\cdot\mathbf e_3$（正のとき、マグヌス力は進行方向に対して左向き）。$\hat{\mathbf v}$ が鉛直に近い場合は定義できないため「定義不能」とする |
| 最高到達点 | 最初の接地までのボール中心の高さ $y$ の最大値 |
| キャリー | 初期のボール中心と、最初の接地時のボール中心との水平距離 |
| 着地点 | 最初の接地時のボール中心の $(x, z)$ |
| 横ずれ | 着地点の $z$ |
| 飛行時間 | 足との衝突から最初の接地までの時間 |
| 総距離 | 停止位置までの水平距離（転がりを実装した場合） |

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
| 未決定 | 値もモデルも決まっていない |

### 10.2 パラメータ一覧（初版）

| ID | 記号 | 意味 | 単位 | 値 | 確からしさ | 出典・備考 |
|---|---|---|---|---|---|---|
| P-01 | $m_B$ | ボール質量 | kg | 候補範囲 0.41–0.45 | 規格値（一次情報未照合） | 国際サッカー評議会（IFAB）競技規則 第 2 条の 5 号球の規定とされる範囲。照合後に確定 |
| P-02 | $R$ | ボール半径 | m | 外周 0.68–0.70 m からの換算（$R = C/2\pi$） | 規格値（一次情報未照合） | 同上。外周の範囲から換算 |
| P-03 | $\kappa$ | ボール慣性係数 | — | 未決定（参照：2/5、2/3） | 未決定 | §5.1、OQ-06 |
| P-04 | $m_A$ | 足の質量 | kg | 未決定 | 未決定 | 実装時は「仮置き」とする。OQ-02 |
| P-05 | $\mathbf I_A^{\text{body}}$ | 足の慣性テンソル | kg·m² | 未決定 | 未決定 | 形状（OQ-01）と質量から一様密度で計算する案。OQ-02 |
| P-06 | — | 足形状の寸法 | m | 未決定 | 未決定 | OQ-01 |
| P-07 | $e$ | 足–ボールの反発係数 | — | 未決定 | 未決定 | 衝突速度・内圧に依存する可能性。OQ-04 |
| P-08 | $\mu$ | 足–ボールの摩擦係数 | — | 未決定 | 未決定 | 靴の材質・湿潤に依存する可能性。OQ-05 |
| P-09 | $g$ | 重力加速度 | m/s² | 9.80665 | 定義値 | 標準重力。地域差は無視 |
| P-10 | $\rho$ | 空気の密度 | kg/m³ | 候補 1.225 | 規格値（一次情報未照合） | 国際標準大気の海面値とされる値。実際の気象条件では変わる |
| P-11 | $\eta$ | 空気の粘性係数 | Pa·s | 未記入 | 規格値（予定） | 国際標準大気の値を候補とし、照合後に記入 |
| P-12 | $C_D$ | 抗力係数 | — | 未決定 | 未決定 | モデル形も未決定。OQ-07 |
| P-13 | $C_L$ | 揚力（マグヌス）係数 | — | 未決定 | 未決定 | OQ-07 |
| P-14 | $c_\omega$ / $C_M$ | 回転減衰の係数 | — | 未決定 | 未決定 | OQ-08 |
| P-15 | $e_g$ | 地面の反発係数 | — | 未決定 | 未決定 | 地面の種類に依存。OQ-09 |
| P-16 | $\mu_g$ | 地面の摩擦係数 | — | 未決定 | 未決定 | OQ-09 |
| P-17 | $\mu_r$ | 転がり抵抗係数 | — | 未決定 | 未決定 | OQ-09 |
| P-18 | $\Delta t$ | 物理の時間刻み | s | 未決定 | 未決定 | 収束試験で決める。OQ-12 |
| P-19 | $v_{\text{rest}},\ v_{\text{stop}},\ \omega_{\text{stop}}$ | 転がり移行・停止の閾値 | m/s, rad/s | 未決定 | 未決定 | OQ-09 |
| P-20 | $\mathbf w$ | 風速 | m/s | $\mathbf 0$ | 仮定 | Phase 1 は無風 |
| P-21 | $\varepsilon$ | マグヌス力の縮退判定の閾値 | m/s² 相当 | 未決定 | 未決定 | 数値上の閾値。M1.2 |

- 値を変更したら、確からしさ・出典・適用条件を同時に更新する。
- UI のデフォルト値として「仮置き」の値を使う場合も、本表に値と「仮置き」の区分を記録する。

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

本書に関係する未決定事項：OQ-01〜OQ-12、OQ-23。一覧は [research/references-and-open-questions.md](research/references-and-open-questions.md) を正本とする。
