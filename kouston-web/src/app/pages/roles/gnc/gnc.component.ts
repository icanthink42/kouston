import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseTelemetryComponent } from '../../../components/base-telemetry.component';
import { DisplayHeaderComponent } from '../../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../../components/vessel-sidebar/vessel-sidebar.component';

interface PhaseAngleData {
  name: string;
  phaseAngle: number;
  inclinationChange: number;
  semiMajorAxis: number;
}

@Component({
  selector: 'app-gnc',
  standalone: true,
  imports: [CommonModule, DisplayHeaderComponent, VesselSidebarComponent],
  templateUrl: './gnc.component.html',
  styleUrl: './gnc.component.scss'
})
export class GncComponent extends BaseTelemetryComponent {
  radToDeg(rad: number): number {
    return rad * (180 / Math.PI);
  }

  getPhaseAngles(): PhaseAngleData[] {
    const vessel = this.selectedVessel;
    if (!vessel || !vessel.bodyNames || vessel.bodyNames.length === 0) {
      return [];
    }

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

      const bodyTrueLongitude = bodyLAN + bodyArgOfPeriapsis + bodyTrueAnomaly;
      const diff = this.normalizeAngle(bodyTrueLongitude - vesselTrueLongitude);
      const inclinationChange = bodyInclination - (vessel.inclination || 0);

      result.push({
        name: vessel.bodyNames[i],
        phaseAngle: diff,
        inclinationChange: inclinationChange,
        semiMajorAxis: (vessel.bodySemiMajorAxes && vessel.bodySemiMajorAxes[i]) || 0
      });
    }

    return result.sort((a: PhaseAngleData, b: PhaseAngleData) => a.semiMajorAxis - b.semiMajorAxis);
  }

  private degToRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  private normalizeAngle(radians: number): number {
    while (radians > Math.PI) radians -= 2 * Math.PI;
    while (radians < -Math.PI) radians += 2 * Math.PI;
    return radians;
  }
}
