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
        public double bodyRadius; // Kerbin radius for calculations

        public static Telemetry FromVessel(Vessel vessel)
        {
            if (vessel == null)
                return null;

            var orbit = vessel.orbit;

            return new Telemetry
            {
                name = vessel.vesselName,
                altitude = vessel.altitude,
                velocity = vessel.srfSpeed,
                latitude = vessel.latitude,
                longitude = vessel.longitude,
                apoapsis = orbit?.ApA ?? 0,
                periapsis = orbit?.PeA ?? 0,
                fuel = GetTotalFuel(vessel),
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),

                // Orbital elements
                inclination = orbit?.inclination ?? 0,
                eccentricity = orbit?.eccentricity ?? 0,
                semiMajorAxis = orbit?.semiMajorAxis ?? 0,
                lan = orbit?.LAN ?? 0,
                argumentOfPeriapsis = orbit?.argumentOfPeriapsis ?? 0,
                trueAnomaly = orbit?.trueAnomaly ?? 0,
                period = orbit?.period ?? 0,
                bodyRadius = vessel.mainBody?.Radius ?? 600000 // Kerbin default
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
    }
}
