import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TelemetryService } from '../../services/telemetry.service';
import { TelemetryState, Vessel } from '../../models/telemetry';
import { Subscription } from 'rxjs';

interface PhaseAngleData {
  name: string;
  trueAnomaly: number;
  semiMajorAxis: number;
  radius: number;
  phaseAngle: number;
  relativePosition: 'ahead' | 'behind';
  inclinationChange: number;
}

@Component({
  selector: 'app-phase-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './phase-display.component.html',
  styleUrl: './phase-display.component.scss'
})
export class PhaseDisplayComponent implements OnInit, OnDestroy {
  telemetry: TelemetryState = {};
  connected = false;
  vesselIds: string[] = [];
  selectedVesselId: string | null = null;

  private telemetrySub: Subscription | null = null;
  private connectedSub: Subscription | null = null;

  constructor(private telemetryService: TelemetryService, private router: Router) {}

  navigateTo(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.router.navigate([select.value]);
  }

  ngOnInit(): void {
    this.connectedSub = this.telemetryService.connected$.subscribe(
      connected => this.connected = connected
    );

    this.telemetrySub = this.telemetryService.telemetry$.subscribe(
      telemetry => {
        this.telemetry = telemetry;
        this.vesselIds = Object.keys(telemetry);

        if (!this.selectedVesselId && this.vesselIds.length > 0) {
          this.selectedVesselId = this.vesselIds[0];
        }
        if (this.selectedVesselId && !telemetry[this.selectedVesselId]) {
          this.selectedVesselId = this.vesselIds.length > 0 ? this.vesselIds[0] : null;
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.telemetrySub?.unsubscribe();
    this.connectedSub?.unsubscribe();
  }

  get selectedVessel(): Vessel | null {
    return this.selectedVesselId ? this.telemetry[this.selectedVesselId] : null;
  }

  selectVessel(id: string): void {
    this.selectedVesselId = id;
  }

  getVessel(id: string): Vessel {
    return this.telemetry[id];
  }

  getPhaseAngles(): PhaseAngleData[] {
    const vessel = this.selectedVessel;
    if (!vessel || !vessel.bodyNames || vessel.bodyNames.length === 0) {
      return [];
    }

    // Vessel's true longitude = LAN + AoP + TA (all need same units)
    // KSP: trueAnomaly is in radians, LAN and AoP are in degrees
    const vesselLAN = this.degToRad(vessel.lan || 0);
    const vesselArgPeriapsis = this.degToRad(vessel.argumentOfPeriapsis || 0);
    const vesselTrueAnomaly = vessel.trueAnomaly || 0;
    const vesselTrueLongitude = vesselLAN + vesselArgPeriapsis + vesselTrueAnomaly;

    const result: PhaseAngleData[] = [];

    for (let i = 0; i < vessel.bodyNames.length; i++) {
      const bodyTrueAnomaly = (vessel.bodyTrueAnomalies && vessel.bodyTrueAnomalies[i]) || 0;
      const bodyArgOfPeriapsis = this.degToRad((vessel.bodyArgsOfPeriapsis && vessel.bodyArgsOfPeriapsis[i]) || 0);
      const bodyLAN = this.degToRad((vessel.bodyLANs && vessel.bodyLANs[i]) || 0);
      const bodyInclination = (vessel.bodyInclinations && vessel.bodyInclinations[i]) || 0;

      // Body's true longitude
      const bodyTrueLongitude = bodyLAN + bodyArgOfPeriapsis + bodyTrueAnomaly;

      const diff = this.normalizeAngle(bodyTrueLongitude - vesselTrueLongitude);
      const inclinationChange = bodyInclination - (vessel.inclination || 0);

      result.push({
        name: vessel.bodyNames[i],
        trueAnomaly: bodyTrueAnomaly,
        semiMajorAxis: (vessel.bodySemiMajorAxes && vessel.bodySemiMajorAxes[i]) || 0,
        radius: (vessel.bodyRadii && vessel.bodyRadii[i]) || 0,
        phaseAngle: diff,
        relativePosition: diff > 0 ? 'ahead' : 'behind',
        inclinationChange: inclinationChange
      });
    }

    return result.sort((a, b) => Math.abs(a.phaseAngle) - Math.abs(b.phaseAngle));
  }

  private degToRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  private normalizeAngle(radians: number): number {
    // Normalize to [-PI, PI]
    while (radians > Math.PI) radians -= 2 * Math.PI;
    while (radians < -Math.PI) radians += 2 * Math.PI;
    return radians;
  }

  radToDeg(radians: number): number {
    return radians * 180 / Math.PI;
  }

  formatDistance(meters: number): string {
    if (meters >= 1e12) {
      return `${(meters / 1e12).toFixed(2)} Tm`;
    } else if (meters >= 1e9) {
      return `${(meters / 1e9).toFixed(2)} Gm`;
    } else if (meters >= 1e6) {
      return `${(meters / 1e6).toFixed(2)} Mm`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }
}
