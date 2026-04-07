import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';
import { FormatService } from '../../services/format.service';

@Component({
  selector: 'app-phase-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './phase-view.component.html',
  styleUrl: './phase-view.component.scss'
})
export class PhaseViewComponent {
  @Input() vessel: Vessel | null = null;

  fmt = new FormatService();

  radToDeg(rad: number): number {
    return rad * (180 / Math.PI);
  }

  getPhaseAngles(): { name: string; phaseAngle: number; inclinationChange: number; semiMajorAxis: number }[] {
    const vessel = this.vessel;
    if (!vessel || !vessel.bodyNames || vessel.bodyNames.length === 0) return [];

    const vesselLAN = this.degToRad(vessel.lan || 0);
    const vesselArgPeriapsis = this.degToRad(vessel.argumentOfPeriapsis || 0);
    const vesselTrueLongitude = vesselLAN + vesselArgPeriapsis + (vessel.trueAnomaly || 0);
    const result: { name: string; phaseAngle: number; inclinationChange: number; semiMajorAxis: number }[] = [];

    for (let i = 0; i < vessel.bodyNames.length; i++) {
      const bodyTrueAnomaly = (vessel.bodyTrueAnomalies && vessel.bodyTrueAnomalies[i]) || 0;
      const bodyArgOfPeriapsis = this.degToRad((vessel.bodyArgsOfPeriapsis && vessel.bodyArgsOfPeriapsis[i]) || 0);
      const bodyLAN = this.degToRad((vessel.bodyLANs && vessel.bodyLANs[i]) || 0);
      const bodyInclination = (vessel.bodyInclinations && vessel.bodyInclinations[i]) || 0;
      const bodyTrueLongitude = bodyLAN + bodyArgOfPeriapsis + bodyTrueAnomaly;
      const diff = this.normalizeAngle(bodyTrueLongitude - vesselTrueLongitude);
      result.push({
        name: vessel.bodyNames[i],
        phaseAngle: diff,
        inclinationChange: bodyInclination - (vessel.inclination || 0),
        semiMajorAxis: (vessel.bodySemiMajorAxes && vessel.bodySemiMajorAxes[i]) || 0
      });
    }
    return result.sort((a, b) => a.semiMajorAxis - b.semiMajorAxis);
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
