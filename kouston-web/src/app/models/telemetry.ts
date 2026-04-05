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
}

export interface TelemetryState {
  [clientId: string]: Vessel;
}
