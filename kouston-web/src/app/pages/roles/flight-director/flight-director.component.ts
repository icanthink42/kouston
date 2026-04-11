import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseTelemetryComponent } from '../../../components/base-telemetry.component';
import { DisplayHeaderComponent } from '../../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../../components/vessel-sidebar/vessel-sidebar.component';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';
import { EdlViewComponent } from '../../../components/edl-view/edl-view.component';

type DisplayMode = 'orbital' | 'pod' | 'edl';

@Component({
  selector: 'app-flight-director',
  standalone: true,
  imports: [CommonModule, DisplayHeaderComponent, VesselSidebarComponent, OrbitalViewComponent, EdlViewComponent],
  templateUrl: './flight-director.component.html',
  styleUrl: './flight-director.component.scss'
})
export class FlightDirectorComponent extends BaseTelemetryComponent implements OnInit {
  currentDisplay: DisplayMode = 'orbital';

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
    const isAscending = vessel.verticalSpeed > 0;
    const isBurning = vessel.throttle > 0;

    // On Earth: always orbital view when landed, ascending, or burning
    if (isLanded && isEarth) {
      this.currentDisplay = 'orbital';
    } else if (isEarth && (isAscending || isBurning)) {
      this.currentDisplay = 'orbital';
    } else if (isLanded || vessel.periapsis <= safeAltitude) {
      this.currentDisplay = hasAtmosphere ? 'pod' : 'edl';
    } else {
      this.currentDisplay = 'orbital';
    }
  }

}
