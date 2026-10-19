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
import { createContactPanel } from './ui/contact-panel';
import { createKickPanel } from './ui/kick-panel';
import { createParameterPanel } from './ui/parameter-panel';
import { createPlaybackPanel } from './ui/playback-panel';
import { stubTrajectory } from './playback/stub-trajectory';
import { applyTrajectoryPose, createTrajectoryLine } from './render/trajectory-view';
import { STUB_PARAMETER_SET } from './params/stub-parameter-set';

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

const contactPanel = createContactPanel();
panel.append(contactPanel.root);

let kick: KickState = INITIAL_KICK_STATE;
const kickPanel = createKickPanel(toFormValues(kick), (values) => {
  kick = applyFormValues(kick, values);
  render();
});
panel.append(kickPanel.root);
panel.append(createParameterPanel(STUB_PARAMETER_SET));

/** 入力の状態を 3D ビューとパネルに反映する。 */
function render(): void {
  toThreeVector(kick.contactDirection, marker.position).multiplyScalar(radius);
  marker.visible = true;
  contactPanel.show(kick.contactDirection);
  // 足の配置（AC-03）：接触面の法線が接触法線と一致するように置く。
  const input = toKickInput(kick);
  const status = inputStatus(input, WORKING_GEOMETRY);
  kickPanel.showStatus(status.message, status.ok);
  const pose = footPose(input, WORKING_GEOMETRY);
  foot.visible = pose.ok;
  if (pose.ok) {
    toThreeVector(pose.value.position, foot.position);
    toThreeQuaternion(pose.value.orientation, foot.quaternion);
  }
}

installContactPicker(view.renderer.domElement, view.camera, ball, (d) => {
  kick = { ...kick, contactDirection: d };
  render();
});
render();

// スタブ軌道の再生（T1.4-09）。再生時刻は描画の時計（performance.now）で進め、物理の時間刻みとは独立。
const stub = stubTrajectory();
if (!stub.ok) throw new Error(`stub trajectory failed: ${stub.error.message}`);
const trajectory = stub.value;
const duration = trajectory.time[trajectory.time.length - 1]!;
const line = createTrajectoryLine(trajectory);
line.visible = false;
view.scene.add(line);
let playStart: number | null = null;
// ボールを動かすときは、カメラも同じだけ平行移動する（視点の向きと距離はユーザーの操作のまま）。
const previous = new THREE.Vector3();
function followBall(move: () => void): void {
  previous.copy(ball.position);
  move();
  const delta = ball.position.clone().sub(previous);
  view.camera.position.add(delta);
  view.controls.target.add(delta);
}
const playback = createPlaybackPanel(
  () => {
    // 前回の再生の着地点などから開始位置へ移るときも、カメラを同じだけ動かす。
    followBall(() => applyTrajectoryPose(ball, trajectory, 0));
    playStart = performance.now();
    line.visible = true;
    foot.visible = false;
    marker.visible = false;
  },
  () => {
    playStart = null;
    line.visible = false;
    followBall(() => ball.position.set(0, radius, 0));
    ball.quaternion.identity();
    playback.showTime(0, duration);
    render();
  },
);
panel.insertBefore(playback.root, panel.lastElementChild);
playback.showTime(0, duration);
view.onFrame(() => {
  if (playStart === null) return;
  const t = Math.min((performance.now() - playStart) / 1000, duration);
  followBall(() => applyTrajectoryPose(ball, trajectory, t));
  playback.showTime(t, duration);
});
