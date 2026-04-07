import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TelemetryService } from '../services/telemetry.service';
import { FormatService } from '../services/format.service';
import { TelemetryState, Vessel } from '../models/telemetry';

@Component({ template: '' })
export abstract class BaseTelemetryComponent implements OnInit, OnDestroy {
  protected telemetryService = inject(TelemetryService);
  protected router = inject(Router);
  protected fmt = inject(FormatService);

  telemetry: TelemetryState = {};
  connected = false;
  vesselIds: string[] = [];
  selectedVesselId: string | null = null;

  private telemetrySub: Subscription | null = null;
  private connectedSub: Subscription | null = null;

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

        this.onTelemetryUpdate();
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

  navigateTo(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.router.navigate([select.value]);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  protected onTelemetryUpdate(): void {
    // Override in subclasses if needed
  }
}
