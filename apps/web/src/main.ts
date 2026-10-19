// KickDynamics Lab の起動（T1.4-01〜）。
import './style.css';
import type { Vec3 } from '@kick-dynamics/physics-core';
import { toThreeVector } from './adapters/three-adapter';
import { createBallMesh } from './render/ball-mesh';
import { createContactMarker, installContactPicker } from './render/contact-picker';
import { addField } from './render/field';
import { createSceneView } from './render/scene-view';
import { createContactPanel } from './ui/contact-panel';

/**
 * 表示に使うボールの半径 m。P-02 は採用値が未決定（候補：外周 0.68–0.70 m からの換算）のため、
 * 換算した範囲 0.108–0.111 m の中ほどの値を表示用に仮置きする。パラメータセットのスタブ（T1.4-08）で置き換える。
 */
const DISPLAY_BALL_RADIUS = 0.11;

const viewport = document.querySelector<HTMLElement>('#viewport');
const panel = document.querySelector<HTMLElement>('#panel');
if (!viewport || !panel) throw new Error('#viewport or #panel element is missing');
const view = createSceneView(viewport);
addField(view.scene);
const ball = createBallMesh(DISPLAY_BALL_RADIUS);
ball.position.set(0, DISPLAY_BALL_RADIUS, 0);
view.scene.add(ball);

// 接触点（AC-02）
const marker = createContactMarker(DISPLAY_BALL_RADIUS);
ball.add(marker);
const contactPanel = createContactPanel();
panel.append(contactPanel.root);
let contactDirection: Vec3 | null = null;
installContactPicker(view.renderer.domElement, view.camera, ball, (d) => {
  contactDirection = d;
  toThreeVector(d, marker.position).multiplyScalar(DISPLAY_BALL_RADIUS);
  marker.visible = true;
  contactPanel.show(contactDirection);
});
