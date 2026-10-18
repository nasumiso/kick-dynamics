// KickDynamics Core の公開 API（docs/04-architecture.md §6）。
// 利用側（Lab・検証ツール）は '@kick-dynamics/physics-core' からだけ import する。
export const MODEL_VERSION = '0.0.0';

export type { SimError, SimErrorCode, SimResult } from './result';

export * as vec3 from './math/vec3';
export type { Vec3 } from './math/vec3';
export * as mat3 from './math/mat3';
export type { Mat3 } from './math/mat3';
export * as quat from './math/quat';
export type { Quat } from './math/quat';

export { GROUND_HEIGHT, gravityVector, WORLD_FORWARD, WORLD_RIGHT, WORLD_UP } from './frames';

export type { BallParams, BoxFootShape, FootParams, FootShape, RigidBodyState } from './bodies/types';
export {
  angularMomentum, ballInertia, boxInertia, inertiaWorld, kineticEnergy, linearMomentum,
} from './bodies/dynamics';
export type { MassProperties, MotionState } from './bodies/dynamics';

export type {
  Confidence, ParameterEntry, ParameterId, ParameterSet, RestThresholds,
} from './params/parameter-set';

export type {
  CoefficientModel, DegeneracyThresholds, FlightEnvironment, FlightEvent, FlightForceSettings, FlightSample, FlightSettings,
  FlightSimulationSettings, ForceAndTorque, GroundContact, GroundContactHandler, GroundContactResponse, SpinDecayModel,
} from './flight/types';
export { computeForces } from './flight/forces';
export { integrateFixedSteps, rk4Step } from './flight/integrator';
export { simulateFlightRun, terminateOnGroundContact } from './flight/ground-events';
export type { FlightRun } from './flight/ground-events';
export { simulateFlight, stateAt, toTrajectory } from './flight/trajectory';
export type { Trajectory } from './flight/trajectory';
