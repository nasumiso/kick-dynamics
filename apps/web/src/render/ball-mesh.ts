// ボールの表示用メッシュ。回転が見えるように、球面を 8 つの象限で塗り分ける（模様は表示だけのもので、物理には影響しない）。
import * as THREE from 'three';

const COLORS = [0xf2f2f2, 0x2b2b2b];

export function createBallMesh(radius: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 48, 32).toNonIndexed();
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  // 三角形ごとに、重心の座標の符号の組（象限）で白黒を決める。
  for (let i = 0; i < position.count; i += 3) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let j = 0; j < 3; j++) {
      x += position.getX(i + j);
      y += position.getY(i + j);
      z += position.getZ(i + j);
    }
    const parity = (x > 0 ? 1 : 0) + (y > 0 ? 1 : 0) + (z > 0 ? 1 : 0);
    color.setHex(COLORS[parity % 2]!);
    for (let j = 0; j < 3; j++) color.toArray(colors, 3 * (i + j));
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ball';
  mesh.castShadow = true;
  return mesh;
}
