// 3D ビュー（描画層）。物理の時間刻みとは独立に、requestAnimationFrame で描画だけを行う（AGENTS.md ルール 5）。
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SceneView {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** マウス操作によるカメラの回転・ズーム・平行移動（AC-01） */
  readonly controls: OrbitControls;
  /** 毎フレームの描画の前に呼ぶ処理を登録する。 */
  readonly onFrame: (callback: () => void) => void;
}

export function createSceneView(container: HTMLElement): SceneView {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1f24);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
  camera.position.set(-1.2, 0.8, 2.0);
  camera.lookAt(0, 0.11, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.11, 0);
  controls.minDistance = 0.3;
  controls.maxDistance = 150;
  controls.maxPolarAngle = Math.PI / 2 - 0.01; // 地面の下に回り込まない
  controls.update();

  const resize = (): void => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const callbacks: Array<() => void> = [];
  renderer.setAnimationLoop(() => {
    controls.update();
    for (const callback of callbacks) callback();
    renderer.render(scene, camera);
  });

  return { scene, camera, renderer, controls, onFrame: (callback) => callbacks.push(callback) };
}
