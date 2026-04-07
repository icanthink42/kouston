import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TelemetryService } from '../../services/telemetry.service';
import { TelemetryState, Vessel } from '../../models/telemetry';
import { Subscription } from 'rxjs';

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
  selector: 'app-systems-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './systems-display.component.html',
  styleUrl: './systems-display.component.scss'
})
export class SystemsDisplayComponent implements OnInit, OnDestroy {
  telemetry: TelemetryState = {};
  connected = false;
  vesselIds: string[] = [];
  selectedVesselId: string | null = null;

  expandedResources: Set<string> = new Set();

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
        summaryMap.set(type, {
          type: type,
          totalAmount: 0,
          totalMax: 0,
          percentage: 0,
          entries: []
        });
      }

      const summary = summaryMap.get(type)!;
      summary.totalAmount += entry.amount;
      summary.totalMax += entry.maxAmount;
      summary.entries.push(entry);
    }

    // Calculate percentages
    for (const summary of summaryMap.values()) {
      summary.percentage = summary.totalMax > 0
        ? (summary.totalAmount / summary.totalMax) * 100
        : 0;
    }

    // Sort by resource type
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
      if (amount >= 1000) {
        return `${(amount / 1000).toFixed(2)} kEC`;
      }
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
