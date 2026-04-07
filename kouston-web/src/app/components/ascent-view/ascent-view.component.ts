import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';
import { FormatService } from '../../services/format.service';

@Component({
  selector: 'app-ascent-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ascent-view.component.html',
  styleUrl: './ascent-view.component.scss'
})
export class AscentViewComponent {
  @Input() vessel: Vessel | null = null;

  fmt = new FormatService();

  compassTicks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
    const rad = deg * Math.PI / 180;
    return {
      x1: 60 + 45 * Math.sin(rad),
      y1: 60 - 45 * Math.cos(rad),
      x2: 60 + 40 * Math.sin(rad),
      y2: 60 - 40 * Math.cos(rad)
    };
  });

  getHeading(): number {
    if (!this.vessel) return 0;
    return Math.round(this.vessel.heading || 0);
  }

  getAscentScale(): { planetRadius: number; viewRadius: number; centerY: number } {
    if (!this.vessel) {
      return { planetRadius: 600000, viewRadius: 2000, centerY: 800 };
    }
    const vessel = this.vessel;
    const planetRadius = vessel.bodyRadius || 600000;
    const apoapsis = Math.max(vessel.apoapsis, vessel.altitude, 1000);
    const viewRadius = Math.max(apoapsis * 2.5, 5000);
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const centerY = viewHeight + (planetRadius * scale) - 50;
    return { planetRadius, viewRadius, centerY };
  }

  getGroundArc(): string {
    if (!this.vessel) return '';
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
    const points: string[] = [`0,${viewHeight}`];
    if (leftEdge > 0) points.push(`${leftEdge},${viewHeight}`);
    for (let x = leftEdge; x <= rightEdge; x += 5) {
      const y = getArcY(x);
      if (y < viewHeight) points.push(`${x},${Math.max(0, y)}`);
    }
    if (rightEdge < viewWidth) points.push(`${rightEdge},${viewHeight}`);
    points.push(`${viewWidth},${viewHeight}`);
    return `M ${points.join(' L ')} Z`;
  }

  getTrajectoryPath(): string {
    if (!this.vessel) return '';
    const vessel = this.vessel;
    const { planetRadius, viewRadius, centerY } = this.getAscentScale();
    const viewWidth = 600;
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const scaledRadius = planetRadius * scale;
    const centerX = viewWidth / 2;

    const points: string[] = [];
    let currentAlt = vessel.altitude;
    let currentVSpeed = vessel.verticalSpeed;
    let currentHDist = 0;
    const dt = 0.5;
    const startY = centerY - scaledRadius - (vessel.altitude * scale);
    points.push(`${centerX},${startY}`);

    for (let t = 0; t < 300; t += dt) {
      const localG = 9.81 * Math.pow(planetRadius / (planetRadius + currentAlt), 2);
      currentVSpeed -= localG * dt;
      currentAlt += currentVSpeed * dt;
      currentHDist += vessel.horizontalSpeed * dt;
      const angle = currentHDist / planetRadius;
      const r = planetRadius + currentAlt;
      const x = centerX + r * Math.sin(angle) * scale;
      const y = centerY - r * Math.cos(angle) * scale;
      if (currentAlt < 0 || x < -50 || x > viewWidth + 50 || y > viewHeight + 50) break;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.length > 1 ? `M ${points.join(' L ')}` : '';
  }

  getVesselPosition(): { x: number; y: number } {
    if (!this.vessel) return { x: 300, y: 350 };
    const { planetRadius, viewRadius, centerY } = this.getAscentScale();
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const scaledRadius = planetRadius * scale;
    const x = 300;
    const y = centerY - scaledRadius - (this.vessel.altitude * scale);
    return { x, y: Math.max(20, Math.min(y, viewHeight - 20)) };
  }

  getApoapsisPosition(): { x: number; y: number; visible: boolean } {
    if (!this.vessel || this.vessel.apoapsis <= 0) return { x: 0, y: 0, visible: false };
    const vessel = this.vessel;
    const { planetRadius, viewRadius, centerY } = this.getAscentScale();
    const viewWidth = 600;
    const viewHeight = 400;
    const scale = viewHeight / (viewRadius * 2);
    const timeToApo = vessel.verticalSpeed > 0 ? vessel.verticalSpeed / 9.81 : 0;
    const hDistToApo = vessel.horizontalSpeed * timeToApo;
    const angle = hDistToApo / planetRadius;
    const r = planetRadius + vessel.apoapsis;
    const x = viewWidth / 2 + r * Math.sin(angle) * scale;
    const y = centerY - r * Math.cos(angle) * scale;
    return { x, y, visible: x > 0 && x < viewWidth && y > 0 && y < viewHeight };
  }
}
