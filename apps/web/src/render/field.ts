// 地面・ライト・座標軸の目印。地面は y = 0 の水平面（ADR-0005：y 上向きの右手系、+x が基準の蹴り出し方向）。
// 距離感をつかむため、ホワイトボックス風の明るい地面に 1 m・5 m・10 m の線と距離の数字を描く（表示専用）。
import * as THREE from 'three';

/** 地面の範囲 m（x：後方 −10 m から前方 110 m、z：左右 ±40 m） */
export const FIELD_EXTENT = { xMin: -10, xMax: 110, zMin: -40, zMax: 40 } as const;

type Extent = { readonly xMin: number; readonly xMax: number; readonly zMin: number; readonly zMax: number };

/** 線の太さの区分：10 m ごと（major）、5 m ごと（medium）、それ以外の 1 m ごと（minor）。 */
export type GridLevel = 'major' | 'medium' | 'minor';

export function gridLevel(coordinate: number): GridLevel {
  if (coordinate % 10 === 0) return 'major';
  if (coordinate % 5 === 0) return 'medium';
  return 'minor';
}

/**
 * 1 m 間隔の格子の線（x 一定の線と z 一定の線）を、長さ 1 m の線分に分けて、区分ごとに端点 [x, y, z, …] で返す。
 * 1 本の長い線分にすると、端点がカメラの後ろに来たときに線全体が描かれない環境があったため（ヘッドレス Chrome で確認）。
 */
export function gridLinePositions(extent: Extent, y: number): Record<GridLevel, number[]> {
  const out: Record<GridLevel, number[]> = { major: [], medium: [], minor: [] };
  for (let x = Math.ceil(extent.xMin); x <= extent.xMax; x++) {
    for (let z = extent.zMin; z < extent.zMax; z++) out[gridLevel(x)].push(x, y, z, x, y, z + 1);
  }
  for (let z = Math.ceil(extent.zMin); z <= extent.zMax; z++) {
    for (let x = extent.xMin; x < extent.xMax; x++) out[gridLevel(z)].push(x, y, z, x + 1, y, z);
  }
  return out;
}

const GRID_COLORS: Record<GridLevel, number> = { major: 0x5f646b, medium: 0x8e9299, minor: 0xb0b3b8 };

function lineSegments(positions: number[], color: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
}

/** 地面に描いた文字（既定の視点と同じく +z 側から見て、+x の方を右にして読める向き）。高さ sizeM m。 */
function groundText(text: string, sizeM: number, color: string): THREE.Mesh {
  const fontPx = 64;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  const font = `bold ${fontPx}px system-ui, sans-serif`;
  context.font = font;
  canvas.width = Math.ceil(context.measureText(text).width) + 16;
  canvas.height = fontPx + 16;
  context.font = font; // canvas の大きさを変えると設定が戻るため再設定する
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry((sizeM * canvas.width) / canvas.height, sizeM),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2; // 平面の +y（文字の上）を −z に向けて寝かせる
  return mesh;
}

export function addField(scene: THREE.Scene): THREE.DirectionalLight {
  const { xMin, xMax, zMin, zMax } = FIELD_EXTENT;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(xMax - xMin, zMax - zMin),
    new THREE.MeshStandardMaterial({ color: 0xe4e5e7, roughness: 1, depthWrite: false }),
  );
  // 低い視点では、地面のすぐ上の線・文字が深度の精度不足で地面に隠れる。地面は深度を書かずに最初に描き、
  // その上に重ねるものが常に見えるようにする（地面より下に物体はないので、隠れ方は変わらない）。
  ground.renderOrder = -1;
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2; // 平面の法線 +z を +y に向ける
  ground.position.set((xMin + xMax) / 2, 0, (zMin + zMax) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // 格子：細い線が太い線に重なって見えないよう、区分ごとに少しずつ高さを変える。
  const heights: Record<GridLevel, number> = { minor: 0.002, medium: 0.003, major: 0.004 };
  for (const level of ['minor', 'medium', 'major'] as const) {
    const grid = lineSegments(gridLinePositions(FIELD_EXTENT, heights[level])[level], GRID_COLORS[level]);
    grid.name = `grid-${level}`;
    scene.add(grid);
  }
  // 基準の蹴り出し方向（z = 0、+x 向き）の線。
  const centre = lineSegments([0, 0.005, 0, xMax, 0.005, 0], 0xd0453a);
  centre.name = 'kick-axis';
  scene.add(centre);

  // 距離の数字：前方は 5 m ごと（中心線の向こう側）、横は 5 m ごと（ボールの少し後ろ）。
  for (let x = 5; x <= xMax - 5; x += 5) {
    const label = groundText(`${x} m`, x % 10 === 0 ? 0.9 : 0.6, '#2f3338');
    label.position.set(x, 0.005, -0.8);
    scene.add(label);
  }
  for (let z = -30; z <= 30; z += 5) {
    if (z === 0) continue;
    const label = groundText(`${Math.abs(z)} m`, 0.6, '#4a4f56');
    label.position.set(-1.5, 0.005, z);
    scene.add(label);
  }

  // 座標軸の目印（x：赤 = 蹴り出しの基準方向、y：緑 = 上、z：青）。
  const axes = new THREE.AxesHelper(0.5);
  axes.position.y = 0.006;
  scene.add(axes);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9da3, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -6;
  shadowCamera.right = 6;
  shadowCamera.top = 6;
  shadowCamera.bottom = -6;
  shadowCamera.far = 40;
  scene.add(sun);
  scene.add(sun.target);
  followSun(sun, new THREE.Vector3(0, 0, 0));
  return sun;
}

const SUN_OFFSET = new THREE.Vector3(-3, 8, 4);

/** 影の範囲（±6 m）がボールから外れないよう、太陽光をボールの真下の点に合わせて動かす（向きは変えない）。 */
export function followSun(sun: THREE.DirectionalLight, ballPosition: THREE.Vector3): void {
  sun.target.position.set(ballPosition.x, 0, ballPosition.z);
  sun.position.copy(sun.target.position).add(SUN_OFFSET);
}
