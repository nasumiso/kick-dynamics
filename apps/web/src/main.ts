// KickDynamics Lab の起動（T1.4-01〜）。
import './style.css';
import { toThreeQuaternion, toThreeVector } from './adapters/three-adapter';
import { footPose } from './kick/foot-placement';
import { INITIAL_KICK_STATE, toKickInput, type KickState } from './kick/kick-state';
import { WORKING_BALL, WORKING_FOOT, WORKING_GEOMETRY } from './params/working-values';
import { createBallMesh } from './render/ball-mesh';
import { createContactMarker, installContactPicker } from './render/contact-picker';
import { addField } from './render/field';
import { createFootMesh } from './render/foot-mesh';
import { createSceneView } from './render/scene-view';
import { createContactPanel } from './ui/contact-panel';

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

/** 入力の状態を 3D ビューとパネルに反映する。 */
function render(): void {
  toThreeVector(kick.contactDirection, marker.position).multiplyScalar(radius);
  marker.visible = true;
  contactPanel.show(kick.contactDirection);
  // 足の配置（AC-03）：接触面の法線が接触法線と一致するように置く。
  const pose = footPose(toKickInput(kick), WORKING_GEOMETRY);
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
