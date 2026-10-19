// 3D ビュー（描画層）。物理の時間刻みとは独立に、requestAnimationFrame で描画だけを行う（AGENTS.md ルール 5）。
import * as THREE from 'three';

export interface SceneView {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
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
  container.appendChild(renderer.domElement);

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
    for (const callback of callbacks) callback();
    renderer.render(scene, camera);
  });

  return { scene, camera, renderer, onFrame: (callback) => callbacks.push(callback) };
}
