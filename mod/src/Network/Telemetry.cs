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
        public double verticalSpeed;   // Vertical velocity (m/s, negative = descending)
        public double horizontalSpeed; // Horizontal velocity (m/s)
        public double radarAltitude;   // Height above terrain (m)
        public double throttle;        // Current throttle (0-1)

        // System bodies (flattened arrays for Unity JsonUtility compatibility)
        public string[] bodyNames = new string[0];
        public double[] bodyTrueAnomalies = new double[0];
        public double[] bodyArgsOfPeriapsis = new double[0];
        public double[] bodyLANs = new double[0];
        public double[] bodyInclinations = new double[0];
        public double[] bodySemiMajorAxes = new double[0];
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
                verticalSpeed = Sanitize(vessel.verticalSpeed),
                horizontalSpeed = Sanitize(vessel.horizontalSrfSpeed),
                radarAltitude = Sanitize(vessel.radarAltitude),
                throttle = Sanitize(vessel.ctrlState?.mainThrottle ?? 0),

                // System bodies
                bodyNames = GetBodyNames(vessel.mainBody),
                bodyTrueAnomalies = GetBodyTrueAnomalies(vessel.mainBody),
                bodyArgsOfPeriapsis = GetBodyArgsOfPeriapsis(vessel.mainBody),
                bodyLANs = GetBodyLANs(vessel.mainBody),
                bodyInclinations = GetBodyInclinations(vessel.mainBody),
                bodySemiMajorAxes = GetBodySemiMajorAxes(vessel.mainBody),
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

        private static List<CelestialBody> GetOrbitingBodies(CelestialBody mainBody)
        {
            var result = new List<CelestialBody>();
            try
            {
                if (mainBody?.orbitingBodies != null)
                {
                    foreach (var body in mainBody.orbitingBodies)
                    {
                        if (body != null)
                            result.Add(body);
                    }
                }
            }
            catch { }
            return result;
        }

        private static string[] GetBodyNames(CelestialBody mainBody)
        {
            var bodies = GetOrbitingBodies(mainBody);
            var names = new string[bodies.Count];
            for (int i = 0; i < bodies.Count; i++)
                names[i] = bodies[i].bodyName ?? "Unknown";
            return names;
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

        // Sanitize double values to avoid JSON serialization issues with Infinity/NaN
        private static double Sanitize(double value, double fallback = 0)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
                return fallback;
            return value;
        }
    }
}
