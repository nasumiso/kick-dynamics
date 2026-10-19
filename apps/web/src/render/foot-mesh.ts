// 簡易足モデルの表示用メッシュ（T1.4-06）。物理計算と同じ形状パラメータ（P-06 の直方体 L_x × L_y × L_z）から生成する。
// 面の色とラベルは表示上の仮の対応（05 §5.2。物理の計算には使わない）：
//   +z_b（接触面）= 足の甲、−z_b = 足の裏、+x_b = つま先、−x_b = かかと。±y_b（内側・外側）は定めない。
import type { FootParams } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { createTextLabel } from './text-label';

export const FOOT_FACE_COLORS = {
  side: 0x3d7bd9,
  instep: 0xffb020, // +z_b：甲（接触面）
  sole: 0x495057, // −z_b：裏
  toe: 0xe8590c, // +x_b：つま先
} as const;

const LABEL_HEIGHT = 0.04;
const LABEL_GAP = 0.035;

export function createFootMesh(foot: FootParams): THREE.Mesh {
  const [lx, ly, lz] = foot.shape.dimensions;
  const material = (color: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 0.85 });
  const side = material(FOOT_FACE_COLORS.side);
  // BoxGeometry の面の順：+x, −x, +y, −y, +z, −z
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(lx, ly, lz), [
    material(FOOT_FACE_COLORS.toe), side, side, side, material(FOOT_FACE_COLORS.instep), material(FOOT_FACE_COLORS.sole),
  ]);
  mesh.name = 'foot';
  mesh.castShadow = true;

  // ラベルは物体座標で各面の外側に置く（足と一緒に回る）。接触面のラベルはボールと重ならないよう、つま先寄りの縁に置く。
  const toe = createTextLabel('Toe', LABEL_HEIGHT);
  toe.position.set(lx / 2 + LABEL_GAP, 0, 0);
  const instep = createTextLabel('Instep (contact)', LABEL_HEIGHT);
  instep.position.set(lx / 2, ly / 2 + LABEL_GAP, lz / 2);
  const sole = createTextLabel('Sole', LABEL_HEIGHT);
  sole.position.set(0, 0, -lz / 2 - LABEL_GAP);
  mesh.add(toe, instep, sole);
  return mesh;
}
