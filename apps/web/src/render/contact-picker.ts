// 接触点のピッキング（AC-02、T1.4-05）。ボールのメッシュとの交点から d = (交点 − ボール中心)/|…| を求める。
// ボール以外をクリックした場合と、ドラッグ（カメラ操作）の場合は接触点を変えない。
import type { Vec3 } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { fromThreeVector } from '../adapters/three-adapter';

/** クリックとみなすポインタの移動量の上限 px（これを超えたらカメラ操作のドラッグとみなす）。 */
const CLICK_TOLERANCE_PX = 4;

/** 交点とボール中心から d を求める。交点が中心と一致する場合（ありえないが）は null。 */
export function contactDirectionFromHit(hit: Vec3, center: Vec3): Vec3 | null {
  const d: Vec3 = [hit[0] - center[0], hit[1] - center[1], hit[2] - center[2]];
  const length = Math.hypot(d[0], d[1], d[2]);
  if (!(length > 0)) return null;
  return [d[0] / length, d[1] / length, d[2] / length];
}

export function installContactPicker(
  dom: HTMLElement, camera: THREE.Camera, ball: THREE.Object3D, onPick: (d: Vec3) => void,
): void {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down: { x: number; y: number } | null = null;
  dom.addEventListener('pointerdown', (event) => {
    down = { x: event.clientX, y: event.clientY };
  });
  dom.addEventListener('pointerup', (event) => {
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_TOLERANCE_PX) return;
    down = null;
    const rect = dom.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ball, false)[0];
    if (!hit) return;
    const center = ball.getWorldPosition(new THREE.Vector3());
    const d = contactDirectionFromHit(fromThreeVector(hit.point), fromThreeVector(center));
    if (d) onPick(d);
  });
}

/** 接触点のマーカー（ボール表面の小さな球）。 */
export function createContactMarker(radius: number): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.08, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
  );
  marker.name = 'contact-marker';
  marker.visible = false;
  return marker;
}
