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
import { addField } from './render/field';
import { createFootMesh } from './render/foot-mesh';
import { createSceneView } from './render/scene-view';
import { createVelocityArrow, velocityArrowGeometry } from './render/velocity-arrow';
import { createContactPanel } from './ui/contact-panel';
import { createKickPanel } from './ui/kick-panel';
import { createParameterPanel } from './ui/parameter-panel';
import { createPlaybackPanel } from './ui/playback-panel';
import { applyTrajectoryPose, createTrajectoryLine } from './render/trajectory-view';
import { DEFAULT_PARAMETER_SET } from './params/default-parameter-set';
import { runKick } from './simulation/run-kick';
import { summarize } from './simulation/summary';
import type { Trajectory } from '@kick-dynamics/physics-core';

const viewport = document.querySelector<HTMLElement>('#viewport');
const panel = document.querySelector<HTMLElement>('#panel');
if (!viewport || !panel) throw new Error('#viewport or #panel element is missing');
const view = createSceneView(viewport);
addField(view.scene);

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

const contactPanel = createContactPanel();
panel.append(contactPanel.root);

let kick: KickState = INITIAL_KICK_STATE;
/** スタブ軌道の再生の開始時刻。null 以外の間（再生後も「初期位置に戻す」まで）は、ボールが入力時の位置にない。 */
let playStart: number | null = null;
const kickPanel = createKickPanel(toFormValues(kick), (values) => {
  kick = applyFormValues(kick, values);
  render();
});
panel.append(kickPanel.root);
panel.append(createParameterPanel(DEFAULT_PARAMETER_SET));

/** 入力の状態を 3D ビューとパネルに反映する。 */
function render(): void {
  contactPanel.show(kick.contactDirection);
  // 足の配置（AC-03）：接触面の法線が接触法線と一致するように置く。
  const input = toKickInput(kick);
  const status = inputStatus(input, WORKING_GEOMETRY);
  kickPanel.showStatus(status.message, status.ok);
  // 再生中・再生後は、接触点と足を入力時のボール（原点で静止）を前提に置けないため表示しない。
  const atRest = playStart === null;
  toThreeVector(kick.contactDirection, marker.position).multiplyScalar(radius);
  marker.visible = atRest;
  // 足の速度 v_A^p の矢印（入力の確認用）。ボールは原点で静止している前提で接触点を求める。
  velocityArrow.update(atRest ? velocityArrowGeometry([0, radius, 0], radius, kick.contactDirection, input.footContactPointVelocity) : null);
  const pose = footPose(input, WORKING_GEOMETRY);
  foot.visible = atRest && pose.ok;
  if (pose.ok) {
    toThreeVector(pose.value.position, foot.position);
    toThreeQuaternion(pose.value.orientation, foot.quaternion);
  }
}

installContactPicker(view.renderer.domElement, view.camera, ball, (d) => {
  // 接触点はボールが初期位置で静止しているときだけ指定できる（再生後は「初期位置に戻す」で戻る）。
  if (playStart !== null) return;
  kick = { ...kick, contactDirection: d };
  render();
});
render();

// キックの実行と軌道の再生（T1.5-02）。再生時刻は描画の時計（performance.now）で進め、物理の時間刻みとは独立。
let trajectory: Trajectory | null = null;
let duration = 0;
let line: THREE.Line | null = null;
// ボールを動かすときは、カメラも同じだけ平行移動する（視点の向きと距離はユーザーの操作のまま）。
const previous = new THREE.Vector3();
function followBall(move: () => void): void {
  previous.copy(ball.position);
  move();
  const delta = ball.position.clone().sub(previous);
  view.camera.position.add(delta);
  view.controls.target.add(delta);
}
function resetBall(): void {
  playStart = null;
  if (line) line.visible = false;
  followBall(() => ball.position.set(0, radius, 0));
  ball.quaternion.identity();
  playback.showTime(0, duration);
  render();
}
const playback = createPlaybackPanel(
  () => {
    // 入力はボールが原点で静止した状態を前提にするため、再生後のキックも初期位置から計算する（入力の状態は変えない）。
    const outcome = runKick(kick, DEFAULT_PARAMETER_SET);
    if (!outcome.ok) {
      playback.showMessage(outcome.reason, false);
      return;
    }
    trajectory = outcome.result.trajectory;
    duration = trajectory.time[trajectory.time.length - 1]!;
    if (line) {
      view.scene.remove(line);
      line.geometry.dispose();
    }
    line = createTrajectoryLine(trajectory);
    view.scene.add(line);
    playback.showMessage(summarize(outcome.result), true);
    // 前回の再生の着地点などから開始位置へ移るときも、カメラを同じだけ動かす。
    const current = trajectory;
    followBall(() => applyTrajectoryPose(ball, current, 0));
    playStart = performance.now();
    foot.visible = false;
    marker.visible = false;
    velocityArrow.update(null);
  },
  resetBall,
);
panel.insertBefore(playback.root, panel.lastElementChild);
playback.showTime(0, duration);
view.onFrame(() => {
  if (playStart === null || trajectory === null) return;
  const current = trajectory;
  const t = Math.min((performance.now() - playStart) / 1000, duration);
  followBall(() => applyTrajectoryPose(ball, current, t));
  playback.showTime(t, duration);
});
