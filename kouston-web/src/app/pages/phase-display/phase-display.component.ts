import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseTelemetryComponent } from '../../components/base-telemetry.component';
import { DisplayHeaderComponent, PageOption } from '../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../components/vessel-sidebar/vessel-sidebar.component';

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
  imports: [CommonModule, DisplayHeaderComponent, VesselSidebarComponent],
  templateUrl: './phase-display.component.html',
  styleUrl: './phase-display.component.scss'
})
export class PhaseDisplayComponent extends BaseTelemetryComponent {
  pageOptions: PageOption[] = [
    { value: '/ground-track', label: 'Ground Track' },
    { value: '/orbital', label: 'Orbital View' },
    { value: '/edl', label: 'EDL' },
    { value: '/pod', label: 'Pod' },
    { value: '/phase', label: 'Phase Angles', selected: true },
    { value: '/systems', label: 'Systems' },
  ];

  onNavigate(path: string): void {
    this.router.navigate([path]);
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
    while (radians > Math.PI) radians -= 2 * Math.PI;
    while (radians < -Math.PI) radians += 2 * Math.PI;
    return radians;
  }

  radToDeg(radians: number): number {
    return radians * 180 / Math.PI;
  }
}
