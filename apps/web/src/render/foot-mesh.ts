// 簡易足モデルの表示用メッシュ（T1.4-06）。物理計算と同じ形状パラメータ（P-06 の直方体 L_x × L_y × L_z）から生成する。
// 接触面（+z_b 面、05 §5.2）だけ色を変える。
import type { FootParams } from '@kick-dynamics/physics-core';
import * as THREE from 'three';

export function createFootMesh(foot: FootParams): THREE.Mesh {
  const [lx, ly, lz] = foot.shape.dimensions;
  const side = new THREE.MeshStandardMaterial({ color: 0x3d7bd9, roughness: 0.6, transparent: true, opacity: 0.85 });
  const contactFace = new THREE.MeshStandardMaterial({ color: 0xffb020, roughness: 0.6, transparent: true, opacity: 0.85 });
  // BoxGeometry の面の順：+x, −x, +y, −y, +z, −z
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(lx, ly, lz), [side, side, side, side, contactFace, side]);
  mesh.name = 'foot';
  mesh.castShadow = true;
  return mesh;
}
