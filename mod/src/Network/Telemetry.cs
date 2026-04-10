using System;
using System.Collections.Generic;

namespace Kouston.Network
{
    [Serializable]
    public class Telemetry
    {
        public string name;
        public double altitude;
        public double velocity;
        public double latitude;
        public double longitude;
        public double apoapsis;
        public double periapsis;
        public double fuel;
        public long timestamp;

        // Orbital elements
        public double inclination;
        public double eccentricity;
        public double semiMajorAxis;
        public double lan; // Longitude of Ascending Node
        public double argumentOfPeriapsis;
        public double trueAnomaly;
        public double period;
        public double bodyRadius;
        public string bodyName;
        public double atmosphereHeight; // Height of atmosphere in meters (0 = no atmosphere)

        // EDL data
        public double pitch;           // Pitch angle relative to horizon (degrees)
        public double heading;         // Attitude compass heading (degrees, 0 = north)
        public double prograde;        // Velocity compass heading (degrees, 0 = north)
        public double verticalSpeed;   // Vertical velocity (m/s, negative = descending)
        public double horizontalSpeed; // Horizontal velocity (m/s)
        public double radarAltitude;   // Height above terrain (m)
        public double throttle;        // Current throttle (0-1)
        public double groundSlope;     // Ground slope angle below vessel (degrees)

        // System bodies (flattened arrays for Unity JsonUtility compatibility)
        public string[] bodyNames = new string[0];
        public string[] bodyParents = new string[0];  // Parent body name (empty string for Sun's children)
        public double[] bodyTrueAnomalies = new double[0];
        public double[] bodyArgsOfPeriapsis = new double[0];
        public double[] bodyLANs = new double[0];
        public double[] bodyInclinations = new double[0];
        public double[] bodySemiMajorAxes = new double[0];
        public double[] bodyEccentricities = new double[0];
        public double[] bodyRadii = new double[0];

        // Resource breakdown (flattened arrays)
        public string[] resourcePartNames = new string[0];
        public string[] resourceTypes = new string[0];
        public double[] resourceAmounts = new double[0];
        public double[] resourceMaxAmounts = new double[0];

        public static Telemetry FromVessel(Vessel vessel)
        {
            if (vessel == null)
                return null;

            var orbit = vessel.orbit;

            return new Telemetry
            {
                name = vessel.vesselName,
                altitude = Sanitize(vessel.altitude),
                velocity = Sanitize(vessel.srfSpeed),
                latitude = Sanitize(vessel.latitude),
                longitude = Sanitize(vessel.longitude),
                apoapsis = Sanitize(orbit?.ApA ?? 0, -1),  // -1 indicates no apoapsis (escape)
                periapsis = Sanitize(orbit?.PeA ?? 0),
                fuel = Sanitize(GetTotalFuel(vessel)),
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),

                // Orbital elements
                inclination = Sanitize(orbit?.inclination ?? 0),
                eccentricity = Sanitize(orbit?.eccentricity ?? 0),
                semiMajorAxis = Sanitize(orbit?.semiMajorAxis ?? 0),
                lan = Sanitize(orbit?.LAN ?? 0),
                argumentOfPeriapsis = Sanitize(orbit?.argumentOfPeriapsis ?? 0),
                trueAnomaly = Sanitize(orbit?.trueAnomaly ?? 0),
                period = Sanitize(orbit?.period ?? 0, -1),  // -1 indicates no period (escape)
                bodyRadius = Sanitize(vessel.mainBody?.Radius ?? 600000, 600000),
                bodyName = vessel.mainBody?.bodyName ?? "Kerbin",
                atmosphereHeight = Sanitize(vessel.mainBody?.atmosphereDepth ?? 0),

                // EDL data
                pitch = vessel.transform != null ?
                    Sanitize(90 - Vector3d.Angle(vessel.transform.up, (vessel.CoMD - vessel.mainBody.position).normalized)) : 0,
                heading = vessel.transform != null ? Sanitize(GetHeading(vessel)) : 0,
                prograde = Sanitize(GetPrograde(vessel)),
                verticalSpeed = Sanitize(vessel.verticalSpeed),
                horizontalSpeed = Sanitize(vessel.horizontalSrfSpeed),
                radarAltitude = Sanitize(vessel.radarAltitude),
                throttle = Sanitize(vessel.ctrlState?.mainThrottle ?? 0),
                groundSlope = Sanitize(GetGroundSlope(vessel)),

                // System bodies
                bodyNames = GetBodyNames(vessel.mainBody),
                bodyParents = GetBodyParents(vessel.mainBody),
                bodyTrueAnomalies = GetBodyTrueAnomalies(vessel.mainBody),
                bodyArgsOfPeriapsis = GetBodyArgsOfPeriapsis(vessel.mainBody),
                bodyLANs = GetBodyLANs(vessel.mainBody),
                bodyInclinations = GetBodyInclinations(vessel.mainBody),
                bodySemiMajorAxes = GetBodySemiMajorAxes(vessel.mainBody),
                bodyEccentricities = GetBodyEccentricities(vessel.mainBody),
                bodyRadii = GetBodyRadii(vessel.mainBody),

                // Resources
                resourcePartNames = GetResourcePartNames(vessel),
                resourceTypes = GetResourceTypes(vessel),
                resourceAmounts = GetResourceAmounts(vessel),
                resourceMaxAmounts = GetResourceMaxAmounts(vessel)
            };
        }

        private static void GetResourceData(Vessel vessel, out List<string> partNames, out List<string> types, out List<double> amounts, out List<double> maxAmounts)
        {
            partNames = new List<string>();
            types = new List<string>();
            amounts = new List<double>();
            maxAmounts = new List<double>();

            try
            {
                foreach (var part in vessel.parts)
                {
                    foreach (var resource in part.Resources)
                    {
                        // Only include fuel types and electric charge
                        if (resource.resourceName == "LiquidFuel" ||
                            resource.resourceName == "Oxidizer" ||
                            resource.resourceName == "MonoPropellant" ||
                            resource.resourceName == "ElectricCharge" ||
                            resource.resourceName == "XenonGas" ||
                            resource.resourceName == "SolidFuel")
                        {
                            partNames.Add(part.partInfo?.title ?? part.name ?? "Unknown");
                            types.Add(resource.resourceName);
                            amounts.Add(Sanitize(resource.amount));
                            maxAmounts.Add(Sanitize(resource.maxAmount));
                        }
                    }
                }
            }
            catch { }
        }

        private static string[] GetResourcePartNames(Vessel vessel)
        {
            GetResourceData(vessel, out var partNames, out _, out _, out _);
            return partNames.ToArray();
        }

        private static string[] GetResourceTypes(Vessel vessel)
        {
            GetResourceData(vessel, out _, out var types, out _, out _);
            return types.ToArray();
        }

        private static double[] GetResourceAmounts(Vessel vessel)
        {
            GetResourceData(vessel, out _, out _, out var amounts, out _);
            return amounts.ToArray();
        }

        private static double[] GetResourceMaxAmounts(Vessel vessel)
        {
            GetResourceData(vessel, out _, out _, out _, out var maxAmounts);
            return maxAmounts.ToArray();
        }

        private static CelestialBody GetSun(CelestialBody body)
        {
            if (body == null) return null;
            while (body.referenceBody != null && body.referenceBody != body)
            {
                body = body.referenceBody;
            }
            return body;
        }

        private static List<CelestialBody> GetAllBodies(CelestialBody root)
        {
            var result = new List<CelestialBody>();
            try
            {
                if (root?.orbitingBodies != null)
                {
                    foreach (var body in root.orbitingBodies)
                    {
                        if (body != null)
                        {
                            result.Add(body);
                            // Recursively add moons
                            result.AddRange(GetAllBodies(body));
                        }
                    }
                }
            }
            catch { }
            return result;
        }

        private static List<CelestialBody> GetOrbitingBodies(CelestialBody mainBody)
        {
            // Get all bodies in the solar system from the Sun
            var sun = GetSun(mainBody);
            return GetAllBodies(sun);
        }

        private static string[] GetBodyNames(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var names = new string[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                names[i] = bodies[i].bodyName ?? "Unknown";
            return names;
        }

        private static string[] GetBodyParents(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var sun = GetSun(mainBody);
            var parents = new string[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
            {
                var parent = bodies[i].referenceBody;
                // If parent is the Sun, use empty string; otherwise use parent's name
                parents[i] = (parent == null || parent == sun) ? "" : (parent.bodyName ?? "");
            }
            return parents;
        }

        private static double[] GetBodyTrueAnomalies(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var values = new double[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                values[i] = Sanitize(bodies[i].orbit?.trueAnomaly ?? 0);
            return values;
        }

        private static double[] GetBodyArgsOfPeriapsis(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var values = new double[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                values[i] = Sanitize(bodies[i].orbit?.argumentOfPeriapsis ?? 0);
            return values;
        }

        private static double[] GetBodyLANs(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var values = new double[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                values[i] = Sanitize(bodies[i].orbit?.LAN ?? 0);
            return values;
        }

        private static double[] GetBodyInclinations(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var values = new double[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                values[i] = Sanitize(bodies[i].orbit?.inclination ?? 0);
            return values;
        }

        private static double[] GetBodySemiMajorAxes(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var values = new double[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                values[i] = Sanitize(bodies[i].orbit?.semiMajorAxis ?? 0);
            return values;
        }

        private static double[] GetBodyEccentricities(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var values = new double[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                values[i] = Sanitize(bodies[i].orbit?.eccentricity ?? 0);
            return values;
        }

        private static double[] GetBodyRadii(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var values = new double[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                values[i] = Sanitize(bodies[i].Radius);
            return values;
        }

        private static double GetTotalFuel(Vessel vessel)
        {
            double total = 0;
            foreach (var part in vessel.parts)
            {
                foreach (var resource in part.Resources)
                {
                    if (resource.resourceName == "LiquidFuel" || resource.resourceName == "Oxidizer")
                    {
                        total += resource.amount;
                    }
                }
            }
            return total;
        }

        private static double GetHeading(Vessel vessel)
        {
            Vector3d up = (vessel.CoMD - vessel.mainBody.position).normalized;
            // North is the component of celestial north that lies in the local horizontal plane
            Vector3d north = Vector3d.Exclude(up, vessel.mainBody.transform.up).normalized;
            Vector3d east = Vector3d.Cross(up, north).normalized;
            Vector3d forward = vessel.transform.up;

            // Project forward onto the horizontal plane
            Vector3d horizontalForward = Vector3d.Exclude(up, forward).normalized;

            // Calculate heading (0 = north, 90 = east)
            double headingRad = Math.Atan2(Vector3d.Dot(horizontalForward, east), Vector3d.Dot(horizontalForward, north));
            double headingDeg = headingRad * 180.0 / Math.PI;
            if (headingDeg < 0) headingDeg += 360;
            return headingDeg;
        }

        private static double GetPrograde(Vessel vessel)
        {
            if (vessel.srf_velocity.magnitude < 0.1) return 0;

            Vector3d up = (vessel.CoMD - vessel.mainBody.position).normalized;
            Vector3d north = Vector3d.Exclude(up, vessel.mainBody.transform.up).normalized;
            Vector3d east = Vector3d.Cross(up, north).normalized;

            // Project velocity onto the horizontal plane
            Vector3d horizontalVelocity = Vector3d.Exclude(up, vessel.srf_velocity).normalized;

            // Calculate prograde heading (0 = north, 90 = east)
            double headingRad = Math.Atan2(Vector3d.Dot(horizontalVelocity, east), Vector3d.Dot(horizontalVelocity, north));
            double headingDeg = headingRad * 180.0 / Math.PI;
            if (headingDeg < 0) headingDeg += 360;
            return headingDeg;
        }

        private static double GetGroundSlope(Vessel vessel)
        {
            try
            {
                if (vessel.mainBody?.pqsController == null)
                    return 0;

                // Sample distance in meters (adaptive based on altitude)
                double sampleDistance = Math.Max(5, Math.Min(50, vessel.radarAltitude * 0.5));

                // Get vessel position
                double lat = vessel.latitude * Math.PI / 180.0;
                double lon = vessel.longitude * Math.PI / 180.0;

                // Calculate offset in radians for the sample distance
                double latOffset = sampleDistance / vessel.mainBody.Radius;
                double lonOffset = sampleDistance / (vessel.mainBody.Radius * Math.Cos(lat));

                // Sample terrain heights at 4 cardinal points
                double heightN = GetTerrainHeight(vessel.mainBody, lat + latOffset, lon);
                double heightS = GetTerrainHeight(vessel.mainBody, lat - latOffset, lon);
                double heightE = GetTerrainHeight(vessel.mainBody, lat, lon + lonOffset);
                double heightW = GetTerrainHeight(vessel.mainBody, lat, lon - lonOffset);
                double heightC = GetTerrainHeight(vessel.mainBody, lat, lon);

                // Calculate slopes in each direction
                double slopeNS = Math.Atan2(Math.Abs(heightN - heightS), 2 * sampleDistance) * 180.0 / Math.PI;
                double slopeEW = Math.Atan2(Math.Abs(heightE - heightW), 2 * sampleDistance) * 180.0 / Math.PI;

                // Return the maximum slope
                return Math.Max(slopeNS, slopeEW);
            }
            catch
            {
                return 0;
            }
        }

        private static double GetTerrainHeight(CelestialBody body, double latRad, double lonRad)
        {
            // Convert lat/lon to radial vector
            Vector3d radial = new Vector3d(
                Math.Cos(latRad) * Math.Cos(lonRad),
                Math.Sin(latRad),
                Math.Cos(latRad) * Math.Sin(lonRad)
            );

            // Get surface height from PQS controller
            double surfaceHeight = body.pqsController.GetSurfaceHeight(radial);
            return surfaceHeight - body.Radius;
        }

        // Sanitize double values to avoid JSON serialization issues with Infinity/NaN
        private static double Sanitize(double value, double fallback = 0)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
                return fallback;
            return value;
        }
    }
}
