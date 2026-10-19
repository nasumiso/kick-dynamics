// KickDynamics Core の公開 API（docs/04-architecture.md §6）。
// 利用側（Lab・検証ツール）は '@kick-dynamics/physics-core' からだけ import する。
export { MODEL_VERSION } from './pipeline/simulate-kick';

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
  CoefficientModel, DegeneracyThresholds, SpinCoefficientTable, FlightEnvironment, FlightEvent, FlightForceSettings, FlightSample, FlightSettings,
  FlightSimulationSettings, ForceAndTorque, GroundContact, GroundContactHandler, GroundContactResponse, GroundRolling, SpinDecayModel,
} from './flight/types';
export { computeForces, evaluateSpinTable } from './flight/forces';
export { integrateFixedSteps, rk4Step } from './flight/integrator';
export { simulateFlightRun, terminateOnGroundContact } from './flight/ground-events';
export type { FlightRun } from './flight/ground-events';
export { simulateFlight, stateAt, toTrajectory } from './flight/trajectory';
export type { Trajectory } from './flight/trajectory';

export type {
  ContactParameters, FootModel, ImpactDiagnostics, ImpactGeometryParameters, ImpactRegime, ImpactResult, ImpactSetup, ImpactWarning,
  KickInput,
} from './contact/types';
export { ballContactMatrix, bodyContactMatrix, contactMatrix, finiteInertia, KINEMATIC_INERTIA } from './contact/k-matrix';
export type { ImpactInertia } from './contact/k-matrix';
export { pointVelocity, solveContact, solveImpact } from './contact/solver';
export type { ContactCoefficients } from './contact/solver';
export { groundBounceHandler, groundHandler, solveGroundBounce } from './ground/bounce';
export type { GroundParameters } from './ground/bounce';
export { advanceRolling, constrainToGround, isStopped, rollingContactVelocity } from './ground/rolling';
export type { RollingParameters } from './ground/rolling';
export { buildImpactSetup, footAxes } from './contact/setup';

export { computeFlightMetrics, spinComponents } from './metrics/flight-metrics';
export type { FlightMetrics, MetricsSettings, SpinComponents } from './metrics/flight-metrics';

export { computeMetrics, simulateKick } from './pipeline/simulate-kick';
export type {
  GroundMode, KickMetrics, KickSimulationResult, KickWarning, SimulationSettings, SpinDecaySelection,
} from './pipeline/simulate-kick';
export { ACCEPTED_RANGES } from './pipeline/ranges';
export type { AcceptedRange } from './pipeline/ranges';
