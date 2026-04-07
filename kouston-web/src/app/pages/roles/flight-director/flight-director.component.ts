import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseTelemetryComponent } from '../../../components/base-telemetry.component';
import { DisplayHeaderComponent } from '../../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../../components/vessel-sidebar/vessel-sidebar.component';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';

type DisplayMode = 'orbital' | 'pod' | 'edl';

@Component({
  selector: 'app-flight-director',
  standalone: true,
  imports: [CommonModule, DisplayHeaderComponent, VesselSidebarComponent, OrbitalViewComponent],
  templateUrl: './flight-director.component.html',
  styleUrl: './flight-director.component.scss'
})
export class FlightDirectorComponent extends BaseTelemetryComponent implements OnInit {
  currentDisplay: DisplayMode = 'orbital';

  compassTicks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
    const rad = deg * Math.PI / 180;
    return {
      x1: 60 + 45 * Math.sin(rad),
      y1: 60 - 45 * Math.cos(rad),
      x2: 60 + 40 * Math.sin(rad),
      y2: 60 - 40 * Math.cos(rad)
    };
  });

  override ngOnInit(): void {
    super.ngOnInit();
    this.telemetryService.telemetry$.subscribe(() => {
      this.updateDisplayMode();
    });
  }

  override selectVessel(id: string): void {
    super.selectVessel(id);
    this.updateDisplayMode();
  }

  private updateDisplayMode(): void {
    if (!this.selectedVessel) return;

    const vessel = this.selectedVessel;
    const hasAtmosphere = (vessel.atmosphereHeight || 0) > 0;
    const safeAltitude = hasAtmosphere ? vessel.atmosphereHeight : 0;
    const isLanded = vessel.radarAltitude < 50 && Math.abs(vessel.velocity) < 10;
    const isEarth = vessel.bodyName === 'Kerbin' || vessel.bodyName === 'Earth';

    // On Earth: always orbital view when landed
    if (isLanded && isEarth) {
      this.currentDisplay = 'orbital';
    } else if (isLanded || vessel.periapsis <= safeAltitude) {
      this.currentDisplay = hasAtmosphere ? 'pod' : 'edl';
    } else {
      this.currentDisplay = 'orbital';
    }
  }

  getLanderRotation(): number {
    if (!this.selectedVessel) return 0;
    return 90 - this.selectedVessel.pitch;
  }

  getHeading(): number {
    if (!this.selectedVessel) return 0;
    return Math.round(this.selectedVessel.heading || 0);
  }
}
