// KickDynamics Lab の起動（T1.4-01〜）。
import './style.css';
import * as THREE from 'three';
import { toThreeQuaternion, toThreeVector } from './adapters/three-adapter';
import { footPose } from './kick/foot-placement';
import { inputStatus } from './kick/input-status';
import { applyFormValues, toFormValues } from './kick/kick-form';
import { INITIAL_KICK_STATE, toKickInput, type KickState } from './kick/kick-state';
import { WORKING_BALL, WORKING_FOOT, WORKING_GEOMETRY } from './params/working-values';
import { createBallMesh } from './render/ball-mesh';
import { createContactMarker, installContactPicker } from './render/contact-picker';
import { addField, followSun } from './render/field';
import { createFootMesh } from './render/foot-mesh';
import { createDisplayPanel, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from './ui/display-panel';
import { createSceneView } from './render/scene-view';
import { createVelocityArrow, velocityArrowGeometry } from './render/velocity-arrow';
import { createDirectionHandles } from './render/direction-handles';
import { behindView } from './render/camera-presets';
import { clampHitToRange, directionFromHit, directionTowardContact, hitOffset, limitDirection, onPadSide, padFrame, selectableHit } from './kick/contact-frame';
import { KICK_INPUT_RANGES } from './kick/kick-state';
import { createHitPad, createNotice } from './ui/hit-pad';
import type { DirectionAngles } from './units/direction';
import { createContactPanel } from './ui/contact-panel';
import { createKickPanel } from './ui/kick-panel';
import { createParameterPanel } from './ui/parameter-panel';
import { createPlaybackPanel } from './ui/playback-panel';
import { applyTrajectoryPose, createTrajectoryView, type TrajectoryView } from './render/trajectory-view';
import { PLAYBACK_SPEEDS, PlaybackClock } from './playback/playback-clock';
import { DEFAULT_PARAMETER_SET } from './params/default-parameter-set';
import { DEFAULT_SIMULATION_SETTINGS, runKick } from './simulation/run-kick';
import { createSettingsPanel } from './ui/settings-panel';
import type { KickSimulationResult, SimulationSettings } from '@kick-dynamics/physics-core';
import { downloadResult } from './export/result-json';
import { summarize } from './simulation/summary';
import { createResultPanel } from './ui/result-panel';
import type { Trajectory } from '@kick-dynamics/physics-core';

const viewport = document.querySelector<HTMLElement>('#viewport');
const panel = document.querySelector<HTMLElement>('#panel');
if (!viewport || !panel) throw new Error('#viewport or #panel element is missing');
const elevationRange = KICK_INPUT_RANGES.footElevation;
const footAngles = (state: KickState): DirectionAngles => ({ azimuth: state.footAzimuth, elevation: state.footElevation });
const view = createSceneView(viewport);
const sun = addField(view.scene);

const radius = WORKING_BALL.radius;
const ball = createBallMesh(radius);
ball.position.set(0, radius, 0);
view.scene.add(ball);

const marker = createContactMarker(radius);
ball.add(marker);
const foot = createFootMesh(WORKING_FOOT);
view.scene.add(foot);
const velocityArrow = createVelocityArrow();
view.scene.add(velocityArrow.object);
// 方向のハンドル（spec 003 §4）。接触点のピッキングより先に登録し、掴んだときはクリックとカメラ操作に渡さない。
const directionHandles = createDirectionHandles({
  dom: view.renderer.domElement, camera: view.camera, elevationRange, onDrag: (requested) => setDirection(requested),
});
view.scene.add(directionHandles.object);
view.onFrame(() => directionHandles.fitToScreen()); // 画面上で一定の大きさに保つ
// 打点パッドと知らせ（3D ビューの右下・上に重ねる）
const notice = createNotice();
/** 打点パッドの視点の水平の向き（カメラから注視点への向きの方位角）。カメラが真上にあるときは前の値を使う。 */
let padAzimuth = 0;
function cameraAzimuth(): number {
  const x = view.controls.target.x - view.camera.position.x;
  const z = view.controls.target.z - view.camera.position.z;
  return Math.hypot(x, z) > 1e-6 ? Math.atan2(z, x) : padAzimuth;
}
const hitPad = createHitPad(radius, ([a, b]) => {
  if (clock !== null) return;
  const angles = footAngles(kick);
  const front = onPadSide(kick.contactDirection, padAzimuth);
  const from = front ? hitOffset(kick.contactDirection, padFrame(padAzimuth)) : null;
  const hit = clampHitToRange(a, b, padAzimuth, angles, from);
  if (!hit) return;
  kick = { ...kick, contactDirection: directionFromHit(hit[0], hit[1], padFrame(padAzimuth)) };
  render();
});
/** 打点パッドの表示：カメラの水平の向きから見た今の接触点と、今の足の移動方向で選べる範囲。 */
function showHitPad(enabled: boolean): void {
  const angles = footAngles(kick);
  const az = padAzimuth;
  hitPad.show(hitOffset(kick.contactDirection, padFrame(az)), onPadSide(kick.contactDirection, az), enabled,
    (a, b) => selectableHit(a, b, az, angles));
}
// カメラを回したら、打点パッドの視点も合わせる。
view.onFrame(() => {
  const az = cameraAzimuth();
  if (Math.abs(az - padAzimuth) < 1e-4) return;
  padAzimuth = az;
  showHitPad(clock === null);
});
padAzimuth = cameraAzimuth();
viewport.append(notice.root, hitPad.root);

const contactPanel = createContactPanel();
panel.append(contactPanel.root);

let kick: KickState = INITIAL_KICK_STATE;
/** 計算の設定（力項の ON/OFF、AC-11）。変更は次のキックから反映する。 */
let settings: SimulationSettings = DEFAULT_SIMULATION_SETTINGS;
/** 軌道の再生クロック。null 以外の間（再生後も「初期位置に戻す」まで）は、ボールが入力時の位置にない。 */
let clock: PlaybackClock | null = null;
let speed: number = PLAYBACK_SPEEDS[0];
/** 足の移動方向を変える（spec 003 §4）。接触点は動かさず、打点が上限を超える向きへは範囲の端で止める。 */
function setDirection(requested: DirectionAngles): void {
  const limited = limitDirection(footAngles(kick), requested, kick.contactDirection, elevationRange);
  kick = { ...kick, footAzimuth: limited.azimuth, footElevation: limited.elevation };
  kickPanel.setValues(toFormValues(kick));
  render();
}
const kickPanel = createKickPanel(toFormValues(kick), (values) => {
  const next = applyFormValues(kick, values);
  const requested = footAngles(next);
  kick = { ...next, footAzimuth: kick.footAzimuth, footElevation: kick.footElevation };
  setDirection(requested);
});
panel.append(kickPanel.root);
/** 表示の設定（表示専用）。変更はすぐに反映する。 */
let display: DisplaySettings = DEFAULT_DISPLAY_SETTINGS;
// 足の移動方向の水平成分の真後ろから見る視点（V キー、spec 003 §4）。ボールが動いた後は、今のボールの位置を基準にする。
function viewBehindFoot(): void {
  const { position, target } = behindView([ball.position.x, ball.position.y, ball.position.z], kick.footAzimuth);
  view.camera.position.set(...position);
  view.controls.target.set(...target);
  view.controls.update();
}
panel.append(createDisplayPanel(display, (next) => { display = next; render(); }, viewBehindFoot));
panel.append(createSettingsPanel(settings, DEFAULT_PARAMETER_SET, (next) => { settings = next; }));
panel.append(createParameterPanel(DEFAULT_PARAMETER_SET));

/** 入力の状態を 3D ビューとパネルに反映する。 */
function render(): void {
  contactPanel.show(kick.contactDirection);
  // 足の配置（AC-03）：接触面の法線が接触法線と一致するように置く。
  const input = toKickInput(kick);
  const status = inputStatus(input, WORKING_GEOMETRY);
  kickPanel.showStatus(status.message, status.ok);
  // 再生中・再生後は、接触点と足を入力時のボール（原点で静止）を前提に置けないため表示しない。
  const atRest = clock === null;
  toThreeVector(kick.contactDirection, marker.position).multiplyScalar(radius);
  marker.visible = atRest;
  // 足の速度 v_A^p の矢印（入力の確認用）。ボールは原点で静止している前提で接触点を求める。
  const arrow = atRest ? velocityArrowGeometry([0, radius, 0], radius, kick.contactDirection, input.footContactPointVelocity) : null;
  velocityArrow.update(arrow);
  directionHandles.update(arrow ? { contact: arrow.origin, d: kick.contactDirection, angles: footAngles(kick) } : null);
  showHitPad(atRest);
  const pose = footPose(input, WORKING_GEOMETRY);
  foot.visible = display.foot && atRest && pose.ok;
  if (pose.ok) {
    toThreeVector(pose.value.position, foot.position);
    toThreeQuaternion(pose.value.orientation, foot.quaternion);
  }
}

installContactPicker(view.renderer.domElement, view.camera, ball, (d) => {
  // 接触点はボールが初期位置で静止しているときだけ指定できる（再生後は「初期位置に戻す」で戻る）。
  if (clock !== null) return;
  // 接触点を優先し、打点が上限を超える向きなら方向を範囲内へ寄せる（spec 003 §4）。
  const angles = directionTowardContact(d, footAngles(kick), elevationRange);
  if (angles.azimuth !== kick.footAzimuth || angles.elevation !== kick.footElevation) {
    notice.show('この接触点では今の足の向きが範囲外のため、足の移動方向を範囲の端へ寄せました。');
  }
  kick = { ...kick, contactDirection: d, footAzimuth: angles.azimuth, footElevation: angles.elevation };
  kickPanel.setValues(toFormValues(kick));
  render();
});
render();

// キックの実行と軌道の再生（T1.5-02）。再生時刻は描画の時計（performance.now）で進め、物理の時間刻みとは独立。
let trajectory: Trajectory | null = null;
/** 直前のキックの結果（保存用、T1.5-06） */
let lastResult: KickSimulationResult | null = null;
/** 直前の描画フレームの時刻 ms。再生・再開・リプレイのときは現在時刻に戻し、操作前の経過時間（計算時間を含む）を再生時刻に加えない。 */
let lastFrame = performance.now();
let duration = 0;
let trajectoryView: TrajectoryView | null = null;
// ボールを動かすときは、カメラも同じだけ平行移動する（視点の向きと距離はユーザーの操作のまま）。
const previous = new THREE.Vector3();
function followBall(move: () => void): void {
  previous.copy(ball.position);
  move();
  followSun(sun, ball.position);
  const delta = ball.position.clone().sub(previous);
  view.camera.position.add(delta);
  view.controls.target.add(delta);
}
function resetBall(): void {
  clock = null;
  playback.showPlaying(null);
  if (trajectoryView) trajectoryView.object.visible = false;
  followBall(() => ball.position.set(0, radius, 0));
  ball.quaternion.identity();
  playback.showTime(0, duration);
  render();
}
const playback = createPlaybackPanel(
  () => {
    // 入力はボールが原点で静止した状態を前提にするため、再生後のキックも初期位置から計算する（入力の状態は変えない）。
    const outcome = runKick(kick, DEFAULT_PARAMETER_SET, settings);
    if (!outcome.ok) {
      playback.showMessage(outcome.reason, false);
      resultPanel.show(null);
      lastResult = null;
      playback.showSavable(false);
      return;
    }
    resultPanel.show(outcome.result);
    lastResult = outcome.result;
    playback.showSavable(true);
    trajectory = outcome.result.trajectory;
    duration = trajectory.time[trajectory.time.length - 1]!;
    if (trajectoryView) {
      view.scene.remove(trajectoryView.object);
      trajectoryView.dispose(); // createTrajectoryView はキックごとに新しいジオメトリとマテリアルを作る
    }
    trajectoryView = createTrajectoryView(trajectory);
    view.scene.add(trajectoryView.object);
    playback.showMessage(summarize(outcome.result), true);
    // 前回の再生の着地点などから開始位置へ移るときも、カメラを同じだけ動かす。
    const current = trajectory;
    followBall(() => applyTrajectoryPose(ball, current, 0));
    trajectoryView.update(0, ball.position);
    clock = new PlaybackClock(duration);
    clock.setSpeed(speed);
    clock.play();
    lastFrame = performance.now();
    playback.showPlaying(true);
    foot.visible = false;
    marker.visible = false;
    velocityArrow.update(null);
    directionHandles.update(null);
    showHitPad(false);
  },
  resetBall,
  {
    // 一時停止・再開（終わりまで再生した後の「再開」は最初から）
    togglePause: () => {
      if (!clock) return;
      if (clock.playing) clock.pause();
      else {
        clock.play();
        lastFrame = performance.now();
      }
      playback.showPlaying(clock.playing);
    },
    // リプレイ：同じ軌道を最初から再生する（計算し直さない、AC-08）
    replay: () => {
      if (!clock) return;
      clock.replay();
      lastFrame = performance.now();
      playback.showPlaying(true);
    },
    // 再生速度：再生時刻の進め方だけを変える（計算結果は変わらない、AC-07）
    save: () => {
      if (lastResult) downloadResult(lastResult);
    },
    setSpeed: (value) => {
      speed = value;
      clock?.setSpeed(value);
    },
  },
);
panel.insertBefore(playback.root, panel.lastElementChild);
const resultPanel = createResultPanel();
panel.insertBefore(resultPanel.root, panel.lastElementChild);
playback.showTime(0, duration);
view.onFrame(() => {
  const now = performance.now();
  const frameSeconds = (now - lastFrame) / 1000;
  lastFrame = now;
  if (clock === null || trajectory === null) return;
  const wasPlaying = clock.playing;
  clock.tick(frameSeconds);
  if (wasPlaying && !clock.playing) playback.showPlaying(false);
  const current = trajectory;
  const t = clock.t;
  followBall(() => applyTrajectoryPose(ball, current, t));
  trajectoryView?.update(t, ball.position);
  playback.showTime(t, duration);
});
