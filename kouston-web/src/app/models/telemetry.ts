export interface Vessel {
  name: string;
  altitude: number;
  velocity: number;
  latitude: number;
  longitude: number;
  apoapsis: number;
  periapsis: number;
  fuel: number;
  timestamp: number;

  // Orbital elements
  inclination: number;
  eccentricity: number;
  semiMajorAxis: number;
  lan: number; // Longitude of Ascending Node
  argumentOfPeriapsis: number;
  trueAnomaly: number;
  period: number;
  bodyRadius: number;
  bodyName: string;
  atmosphereHeight: number; // Height of atmosphere in meters (0 = no atmosphere)

  // EDL data
  pitch: number;           // Pitch angle relative to horizon (degrees)
  heading: number;         // Attitude compass heading (degrees, 0 = north)
  prograde: number;        // Velocity compass heading (degrees, 0 = north)
  verticalSpeed: number;   // Vertical velocity (m/s, negative = descending)
  horizontalSpeed: number; // Horizontal velocity (m/s)
  radarAltitude: number;   // Height above terrain (m)
  throttle: number;        // Current throttle (0-1)

  // System bodies (flattened arrays)
  bodyNames: string[];
  bodyParents: string[];  // Parent body name (empty string = orbits Sun)
  bodyTrueAnomalies: number[];
  bodyArgsOfPeriapsis: number[];
  bodyLANs: number[];
  bodyInclinations: number[];
  bodySemiMajorAxes: number[];
  bodyEccentricities: number[];
  bodyRadii: number[];

  // Resource breakdown
  resourcePartNames: string[];
  resourceTypes: string[];
  resourceAmounts: number[];
  resourceMaxAmounts: number[];
}

export interface TelemetryState {
  [clientId: string]: Vessel;
}
