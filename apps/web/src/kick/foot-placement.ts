// 足モデルの配置（AC-03、T1.4-06）。配置の計算は Core の buildImpactSetup（05 §6.2、VER-C17）を使う。
// 配置は d・φ・(s_x, s_y) だけで決まり、足の速度には依存しない。速度が接近の向きでない入力（separating-input）でも
// 足を表示できるよう、配置の計算では速度を接近の向き（n）に置き換える。入力そのものの妥当性は別に判定して表示する。
import {
  buildImpactSetup, type ImpactGeometryParameters, type KickInput, type Quat, type SimResult, type Vec3,
} from '@kick-dynamics/physics-core';

export interface FootPose {
  /** 足の重心 m（ワールド座標） */
  readonly position: Vec3;
  readonly orientation: Quat;
  /** 接触点 p m */
  readonly contactPoint: Vec3;
}

export function footPose(input: KickInput, geometry: ImpactGeometryParameters): SimResult<FootPose> {
  const n: Vec3 = [-input.contactDirection[0], -input.contactDirection[1], -input.contactDirection[2]];
  const setup = buildImpactSetup({ ...input, footContactPointVelocity: n, footAngularVelocity: [0, 0, 0] }, geometry);
  if (!setup.ok) return setup;
  return { ok: true, value: { position: setup.value.foot.position, orientation: setup.value.foot.orientation, contactPoint: setup.value.contactPoint } };
}
