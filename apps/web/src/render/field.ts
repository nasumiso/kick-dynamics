// 地面・ライト・座標軸の目印。地面は y = 0 の水平面（ADR-0005：y 上向きの右手系、+x が基準の蹴り出し方向）。
import * as THREE from 'three';

export function addField(scene: THREE.Scene): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80),
    new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.95 }),
  );
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2; // 平面の法線 +z を +y に向ける
  ground.position.x = 40;
  ground.receiveShadow = true;
  scene.add(ground);

  // 1 m 間隔の格子（ボールの周辺）と 10 m 間隔の格子（飛距離の目安）。
  const fine = new THREE.GridHelper(10, 10, 0xa8d8b0, 0x7fbf8a);
  fine.position.y = 0.001;
  scene.add(fine);
  const coarse = new THREE.GridHelper(120, 12, 0x8fc79a, 0x8fc79a);
  coarse.position.set(40, 0.002, 0);
  scene.add(coarse);

  // 座標軸の目印（x：赤 = 蹴り出しの基準方向、y：緑 = 上、z：青）。
  const axes = new THREE.AxesHelper(0.5);
  axes.position.y = 0.003;
  scene.add(axes);

  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2f4a33, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-3, 8, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -4;
  shadowCamera.right = 4;
  shadowCamera.top = 4;
  shadowCamera.bottom = -4;
  scene.add(sun);
}
