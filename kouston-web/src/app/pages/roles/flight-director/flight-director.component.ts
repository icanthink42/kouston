import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TelemetryService } from '../../../services/telemetry.service';
import { TelemetryState, Vessel } from '../../../models/telemetry';
import { Subscription } from 'rxjs';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';

type DisplayMode = 'orbital' | 'pod' | 'edl' | 'ground-track';

@Component({
  selector: 'app-flight-director',
  standalone: true,
  imports: [CommonModule, FormsModule, OrbitalViewComponent],
  templateUrl: './flight-director.component.html',
  styleUrl: './flight-director.component.scss'
})
export class FlightDirectorComponent implements OnInit, OnDestroy {
  telemetry: TelemetryState = {};
  connected = false;
  vesselIds: string[] = [];
  selectedVesselId: string | null = null;
  currentDisplay: DisplayMode = 'orbital';

  serverIP = '127.0.0.1';
  serverPort = '7777';

  private telemetrySub: Subscription | null = null;
  private connectedSub: Subscription | null = null;

  constructor(private telemetryService: TelemetryService, private router: Router) {}

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

        this.updateDisplayMode();
      }
    );
  }

  ngOnDestroy(): void {
    this.telemetrySub?.unsubscribe();
    this.connectedSub?.unsubscribe();
  }

  private updateDisplayMode(): void {
    if (!this.selectedVessel) return;

    // Show orbital if periapsis is above surface (positive), otherwise show pod
    if (this.selectedVessel.periapsis > 0) {
      this.currentDisplay = 'orbital';
    } else {
      this.currentDisplay = 'pod';
    }
  }

  get selectedVessel(): Vessel | null {
    return this.selectedVesselId ? this.telemetry[this.selectedVesselId] : null;
  }

  selectVessel(id: string): void {
    this.selectedVesselId = id;
    this.updateDisplayMode();
  }

  connect(): void {
    const port = parseInt(this.serverPort, 10);
    if (!isNaN(port)) {
      this.telemetryService.connect(this.serverIP, port);
    }
  }

  disconnect(): void {
    this.telemetryService.disconnect();
  }

  getVessel(id: string): Vessel {
    return this.telemetry[id];
  }

  goHome(): void {
    this.router.navigate(['/']);
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
    if (Math.abs(ms) >= 1000) {
      return `${(ms / 1000).toFixed(2)} km/s`;
    }
    return `${ms.toFixed(1)} m/s`;
  }

  getLanderRotation(): number {
    if (!this.selectedVessel) return 0;
    return 90 - this.selectedVessel.pitch;
  }
}
