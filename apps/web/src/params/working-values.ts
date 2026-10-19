// Lab が接触幾何（足の配置・入力の判定）に使う値。LAB_PARAMETER_SET（05 §10.2 の写し）から組み立て、
// 表示と物理の計算（simulateKick）で同じ値を使う。
import type { BallParams, FootParams, ImpactGeometryParameters, ParameterEntry } from '@kick-dynamics/physics-core';
import { LAB_PARAMETER_SET as P } from './lab-parameter-set';

function value<T>(entry: ParameterEntry<T>): T {
  if (entry.value === null) throw new Error(`${entry.id} has no value in the Lab parameter set`);
  return entry.value;
}

export const WORKING_BALL: BallParams = {
  mass: value(P.ballMass), radius: value(P.ballRadius), inertiaCoefficient: value(P.ballInertiaCoefficient),
};

export const WORKING_FOOT: FootParams = {
  mass: value(P.footMass), inertiaBody: value(P.footInertiaBody), shape: { kind: 'box', dimensions: value(P.footDimensions) },
};

export const WORKING_GEOMETRY: ImpactGeometryParameters = {
  ball: WORKING_BALL, foot: WORKING_FOOT, rollReferenceThreshold: value(P.rollReferenceThreshold),
};
