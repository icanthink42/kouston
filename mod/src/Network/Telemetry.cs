using System;

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

        // EDL data
        public double pitch;           // Pitch angle relative to horizon (degrees)
        public double verticalSpeed;   // Vertical velocity (m/s, negative = descending)
        public double horizontalSpeed; // Horizontal velocity (m/s)
        public double radarAltitude;   // Height above terrain (m)
        public double throttle;        // Current throttle (0-1)

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

                // EDL data
                pitch = vessel.transform != null ?
                    Sanitize(90 - Vector3d.Angle(vessel.transform.up, (vessel.CoMD - vessel.mainBody.position).normalized)) : 0,
                verticalSpeed = Sanitize(vessel.verticalSpeed),
                horizontalSpeed = Sanitize(vessel.horizontalSrfSpeed),
                radarAltitude = Sanitize(vessel.radarAltitude),
                throttle = Sanitize(vessel.ctrlState?.mainThrottle ?? 0)
            };
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
