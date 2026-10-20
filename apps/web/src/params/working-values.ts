// Lab が Core の段階 API（足の配置・入力の妥当性）を呼ぶときに使う物性値。既定のパラメータセット（05 §10.2 の写し）から作る。
import type { BallParams, FootParams, ImpactGeometryParameters, ParameterEntry } from '@kick-dynamics/physics-core';
import { DEFAULT_PARAMETER_SET as P } from './default-parameter-set';

function value<T>(entry: ParameterEntry<T>): T {
  if (entry.value === null) throw new Error(`${entry.id} has no value in the default parameter set`);
  return entry.value;
}

export const WORKING_BALL: BallParams = { mass: value(P.ballMass), radius: value(P.ballRadius), inertiaCoefficient: value(P.ballInertiaCoefficient) };

export const WORKING_FOOT: FootParams = {
  mass: value(P.footMass), inertiaBody: value(P.footInertiaBody), shape: { kind: 'box', dimensions: value(P.footDimensions) },
};

export const WORKING_GEOMETRY: ImpactGeometryParameters = {
  ball: WORKING_BALL, foot: WORKING_FOOT, rollReferenceThreshold: value(P.rollReferenceThreshold),
};
