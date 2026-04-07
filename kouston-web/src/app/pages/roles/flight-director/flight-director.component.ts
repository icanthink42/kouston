import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TelemetryService } from '../../../services/telemetry.service';
import { TelemetryState, Vessel } from '../../../models/telemetry';
import { Subscription } from 'rxjs';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';

type DisplayMode = 'orbital' | 'pod' | 'lunar' | 'ascent';

@Component({
  selector: 'app-flight-director',
  standalone: true,
  imports: [CommonModule, OrbitalViewComponent],
  templateUrl: './flight-director.component.html',
  styleUrl: './flight-director.component.scss'
})
export class FlightDirectorComponent implements OnInit, OnDestroy {
  telemetry: TelemetryState = {};
  connected = false;
  vesselIds: string[] = [];
  selectedVesselId: string | null = null;
  currentDisplay: DisplayMode = 'orbital';

  // Pre-computed compass tick marks
  compassTicks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
    const rad = deg * Math.PI / 180;
    return {
      x1: 60 + 45 * Math.sin(rad),
      y1: 60 - 45 * Math.cos(rad),
      x2: 60 + 40 * Math.sin(rad),
      y2: 60 - 40 * Math.cos(rad)
    };
  });

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

    const vessel = this.selectedVessel;
    const hasAtmosphere = (vessel.atmosphereHeight || 0) > 0;
    const safeAltitude = hasAtmosphere ? vessel.atmosphereHeight : 0;

    // Show orbital if periapsis is above atmosphere (or surface if no atmo)
    if (vessel.periapsis > safeAltitude) {
      this.currentDisplay = 'orbital';
    } else if (vessel.verticalSpeed >= 0 || vessel.throttle > 0) {
      // Going up or thrusting - show ascent view
      this.currentDisplay = 'ascent';
    } else if (vessel.altitude > vessel.apoapsis * 0.8) {
      // Descending but near apoapsis - still in ascent phase
      this.currentDisplay = 'ascent';
    } else {
      // Descending and well below apoapsis - EDL mode
      // Pod for atmospheric bodies, lunar lander for airless bodies
      this.currentDisplay = hasAtmosphere ? 'pod' : 'lunar';
    }
  }

  get selectedVessel(): Vessel | null {
    return this.selectedVesselId ? this.telemetry[this.selectedVesselId] : null;
  }

  selectVessel(id: string): void {
    this.selectedVesselId = id;
    this.updateDisplayMode();
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

  // Ascent view helpers
  getRocketRotation(): number {
    if (!this.selectedVessel) return 0;
    // Same as lander but for rocket icon
    return 90 - this.selectedVessel.pitch;
  }

  getHeading(): number {
    if (!this.selectedVessel) return 0;
    // Calculate heading from horizontal velocity components
    // For now, use longitude change rate as proxy, or return 90 (east) as default
    // In a real implementation, you'd get heading from the telemetry
    return 90; // Placeholder - east heading
  }

  // Ascent view - get the scale factor based on apoapsis
  getAscentScale(): { planetRadius: number; viewRadius: number; centerY: number } {
    if (!this.selectedVessel) {
      return { planetRadius: 600000, viewRadius: 2000, centerY: 800 };
    }

    const vessel = this.selectedVessel;
    const planetRadius = vessel.bodyRadius || 600000; // Default to Kerbin
    const apoapsis = Math.max(vessel.apoapsis, vessel.altitude, 1000);

    // View radius determines how much of the planet we see
    // At low altitude, very zoomed in (small viewRadius relative to planet)
    // At high altitude, zoomed out more
    const viewRadius = Math.max(apoapsis * 2.5, 5000);

    // Center of planet is below the view
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const centerY = viewHeight + (planetRadius * scale) - 50;

    return { planetRadius, viewRadius, centerY };
  }

  getGroundArc(): string {
    if (!this.selectedVessel) return '';

    const { planetRadius, viewRadius, centerY } = this.getAscentScale();
    const viewWidth = 600;
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const scaledRadius = planetRadius * scale;
    const centerX = viewWidth / 2;

    // Calculate where the planet edge intersects the view
    // Only draw the top portion of the planet (the horizon we can see)
    const getArcY = (x: number) => {
      const dx = x - centerX;
      if (Math.abs(dx) > scaledRadius) return viewHeight; // Off the planet edge
      const dy = Math.sqrt(scaledRadius * scaledRadius - dx * dx);
      return centerY - dy; // Top of circle only
    };

    // Find the x range where the planet is visible
    const leftEdge = Math.max(0, centerX - scaledRadius);
    const rightEdge = Math.min(viewWidth, centerX + scaledRadius);

    // Build arc path - only the visible horizon
    const points: string[] = [];

    // Start from left edge of view at bottom
    points.push(`0,${viewHeight}`);

    // If planet edge is within view, go to that edge first
    if (leftEdge > 0) {
      points.push(`${leftEdge},${viewHeight}`);
    }

    // Draw the arc across the visible portion
    for (let x = leftEdge; x <= rightEdge; x += 5) {
      const y = getArcY(x);
      // Only add points that are within the view and represent the top of the planet
      if (y < viewHeight) {
        points.push(`${x},${Math.max(0, y)}`);
      }
    }

    // If planet edge is within view on right side
    if (rightEdge < viewWidth) {
      points.push(`${rightEdge},${viewHeight}`);
    }

    // Close to bottom right and back
    points.push(`${viewWidth},${viewHeight}`);

    return `M ${points.join(' L ')} Z`;
  }

  getTrajectoryPath(): string {
    if (!this.selectedVessel) return '';

    const vessel = this.selectedVessel;
    const { planetRadius, viewRadius, centerY } = this.getAscentScale();
    const viewWidth = 600;
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const scaledRadius = planetRadius * scale;
    const centerX = viewWidth / 2;

    // Current state
    const alt = vessel.altitude;
    const vSpeed = vessel.verticalSpeed;
    const hSpeed = vessel.horizontalSpeed;

    // Surface gravity (simplified - using Kerbin's g at surface)
    const g = 9.81 * Math.pow(planetRadius / (planetRadius + alt), 2);

    // Calculate trajectory points going FORWARD in time only
    const points: string[] = [];
    let currentAlt = alt;
    let currentVSpeed = vSpeed;
    let currentHDist = 0;
    const dt = 0.5; // time step in seconds

    // Start at current position
    const startY = centerY - scaledRadius - (alt * scale);
    points.push(`${centerX},${startY}`);

    // Simulate forward trajectory
    for (let t = 0; t < 300; t += dt) {
      // Update velocity (gravity pulls down)
      const localG = 9.81 * Math.pow(planetRadius / (planetRadius + currentAlt), 2);
      currentVSpeed -= localG * dt;

      // Update position
      currentAlt += currentVSpeed * dt;
      currentHDist += hSpeed * dt;

      // Convert to view coordinates
      // Horizontal distance becomes angle around planet
      const angle = currentHDist / planetRadius;
      const r = planetRadius + currentAlt;
      const x = centerX + r * Math.sin(angle) * scale;
      const y = centerY - r * Math.cos(angle) * scale;

      // Stop if below surface or out of view
      if (currentAlt < 0) break;
      if (x < -50 || x > viewWidth + 50) break;
      if (y > viewHeight + 50) break;

      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return points.length > 1 ? `M ${points.join(' L ')}` : '';
  }

  getVesselPosition(): { x: number; y: number } {
    if (!this.selectedVessel) return { x: 300, y: 350 };

    const { planetRadius, viewRadius, centerY } = this.getAscentScale();
    const viewWidth = 600;
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const scaledRadius = planetRadius * scale;

    const x = viewWidth / 2;
    const y = centerY - scaledRadius - (this.selectedVessel.altitude * scale);

    return { x, y: Math.max(20, Math.min(y, viewHeight - 20)) };
  }

  getApoapsisPosition(): { x: number; y: number; visible: boolean } {
    if (!this.selectedVessel || this.selectedVessel.apoapsis <= 0) {
      return { x: 0, y: 0, visible: false };
    }

    const vessel = this.selectedVessel;
    const { planetRadius, viewRadius, centerY } = this.getAscentScale();
    const viewWidth = 600;
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);

    // Estimate time to apoapsis and horizontal distance
    const g = 9.81;
    const timeToApo = vessel.verticalSpeed > 0 ? vessel.verticalSpeed / g : 0;
    const hDistToApo = vessel.horizontalSpeed * timeToApo;
    const angle = hDistToApo / planetRadius;

    const r = planetRadius + vessel.apoapsis;
    const x = viewWidth / 2 + r * Math.sin(angle) * scale;
    const y = centerY - r * Math.cos(angle) * scale;

    const visible = x > 0 && x < viewWidth && y > 0 && y < viewHeight;

    return { x, y, visible };
  }
}
