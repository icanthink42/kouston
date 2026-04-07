import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TelemetryService } from '../../../services/telemetry.service';
import { TelemetryState, Vessel } from '../../../models/telemetry';
import { Subscription } from 'rxjs';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';
import { OrbitalMapComponent } from '../../../components/orbital-map/orbital-map.component';

type DisplayMode = 'orbital' | 'pod' | 'edl' | 'ground-track' | 'phase' | 'systems';

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
    { value: 'edl', label: 'EDL (Lander)' },
    { value: 'pod', label: 'Pod' },
    { value: 'phase', label: 'Phase Angles' },
    { value: 'systems', label: 'Systems' },
  ];

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
