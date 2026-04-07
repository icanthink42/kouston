import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TelemetryService } from '../../services/telemetry.service';
import { TelemetryState, Vessel } from '../../models/telemetry';
import { OrbitalViewComponent } from '../../components/orbital-view/orbital-view.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-orbital-display',
  standalone: true,
  imports: [CommonModule, OrbitalViewComponent],
  templateUrl: './orbital-display.component.html',
  styleUrl: './orbital-display.component.scss'
})
export class OrbitalDisplayComponent implements OnInit, OnDestroy {
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

  formatAltitude(meters: number): string {
    if (meters >= 1000000) {
      return `${(meters / 1000000).toFixed(2)} Mm`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }

  formatVelocity(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)} km/s`;
    }
    return `${ms.toFixed(1)} m/s`;
  }
}
