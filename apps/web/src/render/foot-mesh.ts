// 簡易足モデルの表示用メッシュ（T1.4-06）。物理計算と同じ形状パラメータ（P-06 の直方体 L_x × L_y × L_z）から生成する。
// 面の色とラベルは表示上の仮の対応（05 §5.2。物理の計算には使わない）：
//   +z_b（接触面）= 足の甲、−z_b = 足の裏、+x_b = つま先、−x_b = かかと、+y_b = 内側（右足とみなす。2026-11-14）。
// 面ごとに色を分け、ラベルの左端にも同じ色の帯を付ける。
// 物体座標の軸（x_b・y_b・z_b、原点は直方体の中心）も表示する。面は半透明にして、中の軸が見えるようにする。
import type { FootParams } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { createTextLabel } from './text-label';

export const FOOT_FACE_COLORS = {
  side: 0x3d7bd9, // −x_b（かかと）、−y_b（外側）
  instep: 0xffc21a, // +z_b：甲（接触面）
  sole: 0x343a40, // −z_b：裏
  toe: 0xf76707, // +x_b：つま先
  inside: 0xae3ec9, // +y_b：内側（右足とみなす）
} as const;

const LABEL_HEIGHT = 0.04;
const LABEL_GAP = 0.035;
/** 面の不透明度。中の物体座標の軸が透けて見えるようにする。 */
const FACE_OPACITY = 0.55;

/** 物体座標の軸の色（x_b 赤、y_b 緑、z_b 青。Three.js の AxesHelper と同じ対応）。 */
export const FOOT_AXIS_COLORS = { x: 0xe03131, y: 0x2f9e44, z: 0x1c7ed6 } as const;
/** 軸が面から突き出す長さ m */
const AXIS_OVERHANG = 0.07;

/**
 * 物体座標の軸（原点は直方体の中心）。足と一緒に回る。軸の名前は出さず、面のラベル（つま先・甲・裏・内側）と色で対応を示す。
 * 足の面やボールに隠れないよう、深度判定をせずに描く。
 */
function createBodyAxes(lx: number, ly: number, lz: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'foot-axes';
  const axes: Array<[THREE.Vector3, number, number]> = [
    [new THREE.Vector3(1, 0, 0), lx / 2 + AXIS_OVERHANG, FOOT_AXIS_COLORS.x],
    [new THREE.Vector3(0, 1, 0), ly / 2 + AXIS_OVERHANG, FOOT_AXIS_COLORS.y],
    [new THREE.Vector3(0, 0, 1), lz / 2 + AXIS_OVERHANG, FOOT_AXIS_COLORS.z],
  ];
  for (const [direction, length, color] of axes) {
    const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(), length, color, 0.025, 0.014);
    for (const part of [arrow.line, arrow.cone]) {
      const m = part.material as THREE.Material;
      m.depthTest = false;
      m.transparent = true;
      part.renderOrder = 9;
    }
    group.add(arrow);
  }
  // −z_b（足の裏）は軸の逆向き。破線で示す。
  const soleLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -(lz / 2 + AXIS_OVERHANG))]),
    new THREE.LineDashedMaterial({ color: FOOT_AXIS_COLORS.z, dashSize: 0.01, gapSize: 0.008, depthTest: false, transparent: true }),
  );
  soleLine.computeLineDistances();
  soleLine.renderOrder = 9;
  group.add(soleLine);
  return group;
}

export function createFootMesh(foot: FootParams): THREE.Mesh {
  const [lx, ly, lz] = foot.shape.dimensions;
  const material = (color: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: FACE_OPACITY, depthWrite: false });
  const side = material(FOOT_FACE_COLORS.side);
  // BoxGeometry の面の順：+x, −x, +y, −y, +z, −z
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(lx, ly, lz), [
    material(FOOT_FACE_COLORS.toe), side, material(FOOT_FACE_COLORS.inside), side,
    material(FOOT_FACE_COLORS.instep), material(FOOT_FACE_COLORS.sole),
  ]);
  mesh.name = 'foot';
  mesh.castShadow = true;

  // ラベルは物体座標で各面の外側に置く（足と一緒に回る）。接触面のラベルはボールと重ならないよう、つま先寄りの縁に置く。
  const toe = createTextLabel('つま先', LABEL_HEIGHT, FOOT_FACE_COLORS.toe);
  toe.position.set(lx / 2 + LABEL_GAP, 0, 0);
  const instep = createTextLabel('甲（接触面）', LABEL_HEIGHT, FOOT_FACE_COLORS.instep);
  instep.position.set(lx / 2, -ly / 2 - LABEL_GAP, lz / 2);
  const sole = createTextLabel('裏', LABEL_HEIGHT, FOOT_FACE_COLORS.sole);
  sole.position.set(0, 0, -lz / 2 - LABEL_GAP);
  const inside = createTextLabel('内側', LABEL_HEIGHT, FOOT_FACE_COLORS.inside);
  inside.position.set(-lx / 4, ly / 2 + LABEL_GAP, 0);
  mesh.add(toe, instep, sole, inside, createBodyAxes(lx, ly, lz));
  return mesh;
}
