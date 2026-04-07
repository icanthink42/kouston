import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';
import { FormatService } from '../../services/format.service';

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
  selector: 'app-systems-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './systems-view.component.html',
  styleUrl: './systems-view.component.scss'
})
export class SystemsViewComponent {
  @Input() vessel: Vessel | null = null;

  fmt = new FormatService();
  expandedResources: Set<string> = new Set();

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
    const vessel = this.vessel;
    if (!vessel || !vessel.resourcePartNames || vessel.resourcePartNames.length === 0) return [];

    const summaryMap = new Map<string, ResourceSummary>();
    for (let i = 0; i < vessel.resourcePartNames.length; i++) {
      const type = vessel.resourceTypes[i];
      const entry: ResourceEntry = {
        partName: vessel.resourcePartNames[i],
        type,
        amount: vessel.resourceAmounts[i],
        maxAmount: vessel.resourceMaxAmounts[i],
        percentage: vessel.resourceMaxAmounts[i] > 0 ? (vessel.resourceAmounts[i] / vessel.resourceMaxAmounts[i]) * 100 : 0
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
