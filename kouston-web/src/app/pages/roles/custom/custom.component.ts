import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TelemetryService } from '../../../services/telemetry.service';
import { TelemetryState, Vessel } from '../../../models/telemetry';
import { Subscription } from 'rxjs';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';
import { OrbitalMapComponent } from '../../../components/orbital-map/orbital-map.component';

type DisplayMode = 'orbital' | 'pod' | 'edl' | 'ground-track' | 'phase' | 'systems' | 'ascent';

interface ResourceEntry {
  partName: string;
  type: string;
  amount: number;
  maxAmount: number;
  percentage: number;
}

interface ResourceSummary {
  type: string;
  totalAmount: number;
  totalMax: number;
  percentage: number;
  entries: ResourceEntry[];
}

@Component({
  selector: 'app-custom',
  standalone: true,
  imports: [CommonModule, FormsModule, OrbitalViewComponent, OrbitalMapComponent],
  templateUrl: './custom.component.html',
  styleUrl: './custom.component.scss'
})
export class CustomComponent implements OnInit, OnDestroy {
  telemetry: TelemetryState = {};
  connected = false;
  vesselIds: string[] = [];
  selectedVesselId: string | null = null;
  currentDisplay: DisplayMode = 'orbital';
  expandedResources: Set<string> = new Set();

  displayOptions: { value: DisplayMode; label: string }[] = [
    { value: 'ground-track', label: 'Ground Track' },
    { value: 'orbital', label: 'Orbital View' },
    { value: 'ascent', label: 'Ascent' },
    { value: 'edl', label: 'EDL (Lander)' },
    { value: 'pod', label: 'Pod' },
    { value: 'phase', label: 'Phase Angles' },
    { value: 'systems', label: 'Systems' },
  ];

  // Pre-computed compass tick marks for ascent view
  compassTicks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
    const rad = deg * Math.PI / 180;
    return {
      x1: 60 + 45 * Math.sin(rad),
      y1: 60 - 45 * Math.cos(rad),
      x2: 60 + 40 * Math.sin(rad),
      y2: 60 - 40 * Math.cos(rad)
    };
  });

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

  // EDL/Pod helpers
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
  getHeading(): number {
    return 90; // Placeholder - east heading
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

  // Phase helpers
  radToDeg(rad: number): number {
    return rad * (180 / Math.PI);
  }

  formatDistance(meters: number): string {
    if (meters >= 1e9) {
      return `${(meters / 1e9).toFixed(2)} Gm`;
    } else if (meters >= 1e6) {
      return `${(meters / 1e6).toFixed(2)} Mm`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }

  getPhaseAngles(): { name: string; phaseAngle: number; inclinationChange: number; semiMajorAxis: number }[] {
    const vessel = this.selectedVessel;
    if (!vessel || !vessel.bodyNames || vessel.bodyNames.length === 0) {
      return [];
    }

    const vesselLAN = this.degToRad(vessel.lan || 0);
    const vesselArgPeriapsis = this.degToRad(vessel.argumentOfPeriapsis || 0);
    const vesselTrueAnomaly = vessel.trueAnomaly || 0;
    const vesselTrueLongitude = vesselLAN + vesselArgPeriapsis + vesselTrueAnomaly;

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

  // Systems helpers
  toggleExpand(resourceType: string): void {
    if (this.expandedResources.has(resourceType)) {
      this.expandedResources.delete(resourceType);
    } else {
      this.expandedResources.add(resourceType);
    }
  }

  isExpanded(resourceType: string): boolean {
    return this.expandedResources.has(resourceType);
  }

  getResourceSummaries(): ResourceSummary[] {
    const vessel = this.selectedVessel;
    if (!vessel || !vessel.resourcePartNames || vessel.resourcePartNames.length === 0) {
      return [];
    }

    const summaryMap = new Map<string, ResourceSummary>();

    for (let i = 0; i < vessel.resourcePartNames.length; i++) {
      const type = vessel.resourceTypes[i];
      const entry: ResourceEntry = {
        partName: vessel.resourcePartNames[i],
        type: type,
        amount: vessel.resourceAmounts[i],
        maxAmount: vessel.resourceMaxAmounts[i],
        percentage: vessel.resourceMaxAmounts[i] > 0
          ? (vessel.resourceAmounts[i] / vessel.resourceMaxAmounts[i]) * 100
          : 0
      };

      if (!summaryMap.has(type)) {
        summaryMap.set(type, { type, totalAmount: 0, totalMax: 0, percentage: 0, entries: [] });
      }

      const summary = summaryMap.get(type)!;
      summary.totalAmount += entry.amount;
      summary.totalMax += entry.maxAmount;
      summary.entries.push(entry);
    }

    for (const summary of summaryMap.values()) {
      summary.percentage = summary.totalMax > 0 ? (summary.totalAmount / summary.totalMax) * 100 : 0;
    }

    const order = ['ElectricCharge', 'LiquidFuel', 'Oxidizer', 'MonoPropellant', 'XenonGas', 'SolidFuel'];
    return Array.from(summaryMap.values()).sort((a, b) => {
      const aIndex = order.indexOf(a.type);
      const bIndex = order.indexOf(b.type);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }

  formatResourceName(type: string): string {
    switch (type) {
      case 'ElectricCharge': return 'Electric Charge';
      case 'LiquidFuel': return 'Liquid Fuel';
      case 'MonoPropellant': return 'Monopropellant';
      case 'XenonGas': return 'Xenon Gas';
      case 'SolidFuel': return 'Solid Fuel';
      default: return type;
    }
  }

  formatAmount(amount: number, type: string): string {
    if (type === 'ElectricCharge') {
      if (amount >= 1000) return `${(amount / 1000).toFixed(2)} kEC`;
      return `${amount.toFixed(1)} EC`;
    }
    return amount.toFixed(1);
  }

  getResourceColor(type: string): string {
    switch (type) {
      case 'ElectricCharge': return '#44aaff';
      case 'LiquidFuel': return '#44ff44';
      case 'Oxidizer': return '#aaaaff';
      case 'MonoPropellant': return '#ffff44';
      case 'XenonGas': return '#aa44ff';
      case 'SolidFuel': return '#ff8844';
      default: return '#888888';
    }
  }

  getBarColor(percentage: number): string {
    if (percentage > 50) return '#44ff44';
    if (percentage > 25) return '#ffff44';
    return '#ff4444';
  }
}
