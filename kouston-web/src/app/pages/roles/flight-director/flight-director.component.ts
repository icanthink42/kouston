import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseTelemetryComponent } from '../../../components/base-telemetry.component';
import { DisplayHeaderComponent } from '../../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../../components/vessel-sidebar/vessel-sidebar.component';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';

type DisplayMode = 'orbital' | 'pod' | 'lunar' | 'ascent';

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

    if (vessel.periapsis > safeAltitude) {
      this.currentDisplay = 'orbital';
    } else if (vessel.verticalSpeed >= 0 || vessel.throttle > 0) {
      this.currentDisplay = 'ascent';
    } else if (vessel.altitude > vessel.apoapsis * 0.8) {
      this.currentDisplay = 'ascent';
    } else {
      this.currentDisplay = hasAtmosphere ? 'pod' : 'lunar';
    }
  }

  getLanderRotation(): number {
    if (!this.selectedVessel) return 0;
    return 90 - this.selectedVessel.pitch;
  }

  getRocketRotation(): number {
    if (!this.selectedVessel) return 0;
    return 90 - this.selectedVessel.pitch;
  }

  getHeading(): number {
    return 90;
  }

  getAscentScale(): { planetRadius: number; viewRadius: number; centerY: number } {
    if (!this.selectedVessel) {
      return { planetRadius: 600000, viewRadius: 2000, centerY: 800 };
    }

    const vessel = this.selectedVessel;
    const planetRadius = vessel.bodyRadius || 600000;
    const apoapsis = Math.max(vessel.apoapsis, vessel.altitude, 1000);
    const viewRadius = Math.max(apoapsis * 2.5, 5000);
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

    const getArcY = (x: number) => {
      const dx = x - centerX;
      if (Math.abs(dx) > scaledRadius) return viewHeight;
      const dy = Math.sqrt(scaledRadius * scaledRadius - dx * dx);
      return centerY - dy;
    };

    const leftEdge = Math.max(0, centerX - scaledRadius);
    const rightEdge = Math.min(viewWidth, centerX + scaledRadius);

    const points: string[] = [];
    points.push(`0,${viewHeight}`);
    if (leftEdge > 0) {
      points.push(`${leftEdge},${viewHeight}`);
    }

    for (let x = leftEdge; x <= rightEdge; x += 5) {
      const y = getArcY(x);
      if (y < viewHeight) {
        points.push(`${x},${Math.max(0, y)}`);
      }
    }

    if (rightEdge < viewWidth) {
      points.push(`${rightEdge},${viewHeight}`);
    }
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

    const alt = vessel.altitude;
    const vSpeed = vessel.verticalSpeed;
    const hSpeed = vessel.horizontalSpeed;

    const points: string[] = [];
    let currentAlt = alt;
    let currentVSpeed = vSpeed;
    let currentHDist = 0;
    const dt = 0.5;

    const startY = centerY - scaledRadius - (alt * scale);
    points.push(`${centerX},${startY}`);

    for (let t = 0; t < 300; t += dt) {
      const localG = 9.81 * Math.pow(planetRadius / (planetRadius + currentAlt), 2);
      currentVSpeed -= localG * dt;
      currentAlt += currentVSpeed * dt;
      currentHDist += hSpeed * dt;

      const angle = currentHDist / planetRadius;
      const r = planetRadius + currentAlt;
      const x = centerX + r * Math.sin(angle) * scale;
      const y = centerY - r * Math.cos(angle) * scale;

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
