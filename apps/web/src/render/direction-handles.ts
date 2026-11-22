// 足の移動方向の回転ギズモ（spec 003 §4、表示と操作だけ）。3D ツールの回転ギズモにならう：
// - 接触点を中心とする 2 つの大円（画面上で一定の大きさ）。水平の円（緑）は鉛直軸まわりの回転 = 方位角 ψ、
//   矢印を含む鉛直の円（赤）は矢印の右向きの水平軸まわりの回転 = 仰角 θ。
// - 円を掴んでドラッグすると、マウスの動きのうち掴んだ点での円の接線方向（画面上）の成分だけ回る（斜めから見ても値が飛ばない）。
// - 矢印の先端の球を掴むと、先端がマウスに付いてくるように ψ・θ を同時に変える。
// 求めた向きは onDrag で知らせ、範囲の制限（打点の上限）は呼び出し側で contact-frame の関数を使って行う。
// 円は、回すとその位置へ来る向きが範囲外の部分を灰色で描く。掴んだ・指している円は黄色にする。
import type { Vec3 } from '@kick-dynamics/physics-core';
import * as THREE from 'three';
import { withinHitLimit, type ElevationRange } from '../kick/contact-frame';
import { anglesToDirection, type DirectionAngles } from '../units/direction';
import { ARROW_LENGTH, OVERLAY_RENDER_ORDER } from './velocity-arrow';

export type HandleKind = 'tip' | 'azimuth' | 'elevation';

export interface HandleState {
  /** 接触点（ワールド座標 m）= 回転の中心 */
  readonly contact: Vec3;
  /** 接触点の向き d（範囲の描き分けに使う） */
  readonly d: Vec3;
  readonly angles: DirectionAngles;
}

/**
 * 円のドラッグの回転量 rad：マウスの移動 delta（px）の、画面上の接線方向 tangent（単位ベクトル）の成分を、
 * 円の画面上の半径 radiusPx で割る（円に沿って半径の長さだけ動かすと 1 rad）。
 */
export function ringDragAngle(delta: readonly [number, number], tangent: readonly [number, number], radiusPx: number): number {
  return (delta[0] * tangent[0] + delta[1] * tangent[1]) / radiusPx;
}

/**
 * 先端のドラッグの角度の変化 [dψ, dθ]：画面上の先端の微分 jPsi・jTheta（px/rad）で、マウスの移動 delta を
 * 減衰付き最小二乗で解く（(JᵀJ + λI) x = Jᵀ delta）。先端が視線方向に重なって J が退化しても値が飛ばない。
 */
export function tipDragAngles(delta: readonly [number, number], jPsi: readonly [number, number], jTheta: readonly [number, number], damping = 400): readonly [number, number] {
  const a = jPsi[0] * jPsi[0] + jPsi[1] * jPsi[1] + damping;
  const b = jPsi[0] * jTheta[0] + jPsi[1] * jTheta[1];
  const c = jTheta[0] * jTheta[0] + jTheta[1] * jTheta[1] + damping;
  const u = jPsi[0] * delta[0] + jPsi[1] * delta[1];
  const v = jTheta[0] * delta[0] + jTheta[1] * delta[1];
  const det = a * c - b * b;
  return [(c * u - b * v) / det, (a * v - b * u) / det];
}

/** 表示の値（画面上の px。ギズモはカメラからの距離に合わせて大きさを変え、画面上で一定に見せる）。 */
const RING_PX = 85;
const TUBE_PX = 2.2;
const PICK_PX = 9;
const TIP_PX = 7;
/** リングの上の、今の角度の目印（回すとリングに沿って動く）。 */
const KNOB_PX = 5.5;
const TIP_PICK_PX = 14;
const SEGMENTS = 128;
/** 方位のリングの 1 回のドラッグで回せる最大の角 rad（π の少し手前）。 */
const MAX_AZIMUTH_DRAG = Math.PI - 1e-3;
const AZIMUTH_COLOR = new THREE.Color(0x40c057);
const ELEVATION_COLOR = new THREE.Color(0xfa5252);
const OUT_OF_RANGE_COLOR = new THREE.Color(0x6b7580);
const ACTIVE_COLOR = new THREE.Color(0xffd43b);
const TIP_COLOR = new THREE.Color(0xf1f3f5);

/** 単位円（局所座標の xz 面）の管。頂点の色は後で塗る。 */
function ringGeometry(tubeRadius: number): THREE.TorusGeometry {
  const geometry = new THREE.TorusGeometry(1, tubeRadius, 8, SEGMENTS);
  geometry.rotateX(Math.PI / 2); // xy 面 → xz 面
  return geometry;
}

export interface DirectionHandles {
  readonly object: THREE.Object3D;
  /** null なら非表示にし、操作も受け付けない */
  readonly update: (state: HandleState | null) => void;
  /** 毎フレーム呼ぶ：画面上の大きさを一定に保つ */
  readonly fitToScreen: () => void;
}

export interface DirectionHandleOptions {
  readonly dom: HTMLElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly elevationRange: ElevationRange;
  /** ドラッグで求めた向き（範囲の制限の前） */
  readonly onDrag: (requested: DirectionAngles) => void;
}

export function createDirectionHandles({ dom, camera, elevationRange, onDrag }: DirectionHandleOptions): DirectionHandles {
  const root = new THREE.Group();
  root.name = 'direction-gizmo';
  const material = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });

  // 回転の中心（接触点）に置き、画面上の大きさを一定にする組。局所座標の半径 1 が RING_PX になる。
  const rings = new THREE.Group();
  const azimuthMesh = new THREE.Mesh(ringGeometry(TUBE_PX / RING_PX), material());
  const azimuthPick = new THREE.Mesh(ringGeometry(PICK_PX / RING_PX), hidden);
  // 仰角の円は、矢印を含む鉛直の面に置く（局所の xz 面の円を、x → 水平の向き h、z → 上 に回す）。
  const elevationFrame = new THREE.Group();
  const elevationMesh = new THREE.Mesh(ringGeometry(TUBE_PX / RING_PX), material());
  const elevationPick = new THREE.Mesh(ringGeometry(PICK_PX / RING_PX), hidden);
  elevationFrame.add(elevationMesh, elevationPick);
  // 今の角度の目印。リングは動かさず、回すとこの目印がリングに沿って動く。
  const knob = (): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(KNOB_PX / RING_PX, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
    mesh.renderOrder = OVERLAY_RENDER_ORDER + 2;
    return mesh;
  };
  const azimuthKnob = knob();
  const elevationKnob = knob();
  elevationFrame.add(elevationKnob);
  rings.add(azimuthMesh, azimuthPick, azimuthKnob, elevationFrame);
  // 矢印の先端の球（位置は先端、大きさは画面上で一定）
  const tip = new THREE.Group();
  const tipMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: TIP_COLOR, depthTest: false, transparent: true, opacity: 0.95 }));
  const tipPick = new THREE.Mesh(new THREE.SphereGeometry(TIP_PICK_PX / TIP_PX, 12, 8), hidden);
  tip.add(tipMesh, tipPick);
  for (const mesh of [azimuthMesh, elevationMesh, tipMesh]) mesh.renderOrder = OVERLAY_RENDER_ORDER + 1;
  root.add(rings, tip);
  const kinds = new Map<THREE.Object3D, HandleKind>([[tipPick, 'tip'], [azimuthPick, 'azimuth'], [elevationPick, 'elevation']]);

  let state: HandleState | null = null;
  let hovered: HandleKind | null = null;
  let drag: {
    readonly kind: HandleKind;
    readonly start: DirectionAngles;
    readonly startX: number;
    readonly startY: number;
    readonly tangent: readonly [number, number];
    lastX: number;
    lastY: number;
  } | null = null;

  /** 円の頂点を塗る。angleOf(局所の xz 面の角 φ) が、その位置へ回したときの向き（範囲外なら灰色）。 */
  const paint = (mesh: THREE.Mesh, color: THREE.Color, angleOf: ((phi: number) => DirectionAngles | null) | null): void => {
    const position = mesh.geometry.attributes.position!;
    let colors = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colors) {
      colors = new THREE.BufferAttribute(new Float32Array(position.count * 3), 3);
      mesh.geometry.setAttribute('color', colors);
    }
    const c = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      if (!angleOf || !state) c.copy(color);
      else {
        const angles = angleOf(Math.atan2(position.getZ(i), position.getX(i)));
        c.copy(angles && withinHitLimit(state.d, anglesToDirection(angles)) ? color : OUT_OF_RANGE_COLOR);
      }
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
  };

  const repaint = (): void => {
    if (!state) return;
    const active = drag?.kind ?? hovered;
    const { angles } = state;
    // 水平の円の位置 φ（局所の xz 面、+x から +z）へ回すと ψ = φ。
    paint(azimuthMesh, active === 'azimuth' ? ACTIVE_COLOR : AZIMUTH_COLOR,
      active === 'azimuth' ? null : (phi) => ({ azimuth: phi, elevation: angles.elevation }));
    // 鉛直の円の位置 φ（局所の x = 水平の向き h から z = 上 へ）へ回すと θ = φ。θ の範囲外と背面（|φ| > 90°）は灰色。
    paint(elevationMesh, active === 'elevation' ? ACTIVE_COLOR : ELEVATION_COLOR,
      active === 'elevation' ? null : (phi) => (phi >= elevationRange.min && phi <= elevationRange.max ? { azimuth: angles.azimuth, elevation: phi } : null));
    (tipMesh.material as THREE.MeshBasicMaterial).color.copy(active === 'tip' ? ACTIVE_COLOR : TIP_COLOR);
    // ドラッグ中は、掴んでいないリングを薄くする（方位を回すと仰角のリングは軸ごと回るため）。
    const opacity = (kind: HandleKind): number => (drag && drag.kind !== kind ? 0.2 : 0.9);
    (azimuthMesh.material as THREE.MeshBasicMaterial).opacity = opacity('azimuth');
    (azimuthKnob.material as THREE.MeshBasicMaterial).opacity = opacity('azimuth');
    (elevationMesh.material as THREE.MeshBasicMaterial).opacity = opacity('elevation');
    (elevationKnob.material as THREE.MeshBasicMaterial).opacity = opacity('elevation');
  };

  const update = (next: HandleState | null): void => {
    state = next;
    root.visible = next !== null;
    if (!next) {
      drag = null;
      return;
    }
    const { contact, angles } = next;
    rings.position.set(contact[0], contact[1], contact[2]);
    // 局所の x → h = (cos ψ, 0, sin ψ)、y → h × 上 の逆向き（右手系を保つ）、z → 上
    const h = new THREE.Vector3(Math.cos(angles.azimuth), 0, Math.sin(angles.azimuth));
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, h); // z 軸 × x 軸 = y 軸 になる向き
    elevationFrame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(h, side, up));
    azimuthKnob.position.set(Math.cos(angles.azimuth), 0, Math.sin(angles.azimuth));
    elevationKnob.position.set(Math.cos(angles.elevation), 0, Math.sin(angles.elevation));
    const f = anglesToDirection(angles);
    tip.position.set(contact[0] + ARROW_LENGTH * f[0], contact[1] + ARROW_LENGTH * f[1], contact[2] + ARROW_LENGTH * f[2]);
    repaint();
    fitToScreen();
  };

  /** 位置 p での 1 px あたりの長さ m。 */
  const metersPerPixel = (p: THREE.Vector3): number => {
    const distance = camera.position.distanceTo(p);
    return (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(dom.clientHeight, 1);
  };
  function fitToScreen(): void {
    if (!state) return;
    rings.scale.setScalar(RING_PX * metersPerPixel(rings.position));
    tip.scale.setScalar(TIP_PX * metersPerPixel(tip.position));
  }

  const toScreen = (p: THREE.Vector3): [number, number] => {
    const v = p.clone().project(camera);
    return [((v.x + 1) / 2) * dom.clientWidth, ((1 - v.y) / 2) * dom.clientHeight];
  };
  /** ワールドの点 p を向き dp へ少し動かしたときの、画面上の動き（px / 動かした量）。 */
  const screenDerivative = (p: THREE.Vector3, dp: THREE.Vector3): [number, number] => {
    const e = 1e-3;
    const a = toScreen(p);
    const b = toScreen(p.clone().addScaledVector(dp, e));
    return [(b[0] - a[0]) / e, (b[1] - a[1]) / e];
  };
  const unit = (v: readonly [number, number]): [number, number] => {
    const l = Math.hypot(v[0], v[1]);
    return l > 1e-9 ? [v[0] / l, v[1] / l] : [1, 0];
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (event: PointerEvent): { kind: HandleKind; point: THREE.Vector3 } | null => {
    if (!state) return null;
    const rect = dom.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([tipPick, azimuthPick, elevationPick], false);
    const tipHit = hits.find((hit) => hit.object === tipPick);
    const hit = tipHit ?? hits[0];
    return hit ? { kind: kinds.get(hit.object)!, point: hit.point } : null;
  };

  /** 掴んだ点での、角度を増やす向きの画面上の接線（単位ベクトル）。 */
  const grabTangent = (kind: HandleKind, point: THREE.Vector3, current: HandleState): [number, number] => {
    const center = rings.position;
    const r = point.clone().sub(center);
    if (kind === 'azimuth') {
      // ψ を増やすと、水平の円の上の点は鉛直軸まわりに +x → +z の向きに回る：dQ/dψ = (−r_z, 0, r_x)
      return unit(screenDerivative(point, new THREE.Vector3(-r.z, 0, r.x)));
    }
    // θ を増やすと、鉛直の円の上の点は h → 上 の向きに回る：dQ/dθ = (上 · r) h の逆向き + (h · r) 上
    const h = new THREE.Vector3(Math.cos(current.angles.azimuth), 0, Math.sin(current.angles.azimuth));
    const along = r.dot(h);
    const height = r.y;
    return unit(screenDerivative(point, h.clone().multiplyScalar(-height).add(new THREE.Vector3(0, along, 0))));
  };

  // キャプチャ段階で受け、掴んだときは他の処理（カメラ操作・接触点のクリック）に渡さない。
  dom.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !state) return;
    const hit = pick(event);
    if (!hit) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    drag = {
      kind: hit.kind, start: state.angles, startX: event.clientX, startY: event.clientY,
      tangent: hit.kind === 'tip' ? [0, 0] : grabTangent(hit.kind, hit.point, state),
      lastX: event.clientX, lastY: event.clientY,
    };
    dom.setPointerCapture(event.pointerId);
    dom.style.cursor = 'grabbing';
    repaint();
  }, { capture: true });

  dom.addEventListener('pointermove', (event) => {
    if (drag && state) {
      event.stopImmediatePropagation();
      if (drag.kind === 'tip') {
        // 先端：今の向きでの画面上の微分を使い、前回からのマウスの動きを角度の変化に直す。
        const { angles, contact } = state;
        const c = new THREE.Vector3(contact[0], contact[1], contact[2]);
        const tipAt = (a: DirectionAngles): THREE.Vector3 => {
          const f = anglesToDirection(a);
          return c.clone().add(new THREE.Vector3(f[0], f[1], f[2]).multiplyScalar(ARROW_LENGTH));
        };
        const e = 1e-3;
        const p0 = toScreen(tipAt(angles));
        const pPsi = toScreen(tipAt({ azimuth: angles.azimuth + e, elevation: angles.elevation }));
        const pTheta = toScreen(tipAt({ azimuth: angles.azimuth, elevation: angles.elevation + e }));
        const [dPsi, dTheta] = tipDragAngles(
          [event.clientX - drag.lastX, event.clientY - drag.lastY],
          [(pPsi[0] - p0[0]) / e, (pPsi[1] - p0[1]) / e],
          [(pTheta[0] - p0[0]) / e, (pTheta[1] - p0[1]) / e],
        );
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        onDrag({ azimuth: angles.azimuth + dPsi, elevation: angles.elevation + dTheta });
        return;
      }
      // 円：掴んだときからのマウスの動きの、接線方向の成分だけ回す（掴んだときの向きからの累計）。
      const angle = ringDragAngle([event.clientX - drag.startX, event.clientY - drag.startY], drag.tangent, RING_PX);
      // 方位の累積角は ±π の手前で止める。範囲の制限は今の向きから短い向きに回すので、累積が π を超えると
      // 回る向きが逆になり、範囲の端から反対側の端へ跳ぶため（Codex のレビュー、PR #32）。
      const azimuthAngle = Math.max(-MAX_AZIMUTH_DRAG, Math.min(MAX_AZIMUTH_DRAG, angle));
      onDrag(drag.kind === 'azimuth'
        ? { azimuth: drag.start.azimuth + azimuthAngle, elevation: state.angles.elevation }
        : { azimuth: state.angles.azimuth, elevation: drag.start.elevation + angle });
      return;
    }
    const kind = pick(event)?.kind ?? null;
    if (kind !== hovered) {
      hovered = kind;
      dom.style.cursor = kind ? 'grab' : '';
      repaint();
    }
  }, { capture: true });

  const release = (event: PointerEvent): void => {
    if (!drag) return;
    event.stopImmediatePropagation();
    drag = null;
    if (dom.hasPointerCapture(event.pointerId)) dom.releasePointerCapture(event.pointerId);
    dom.style.cursor = hovered ? 'grab' : '';
    repaint();
  };
  dom.addEventListener('pointerup', release, { capture: true });
  dom.addEventListener('pointercancel', release, { capture: true });

  return { object: root, update, fitToScreen };
}
