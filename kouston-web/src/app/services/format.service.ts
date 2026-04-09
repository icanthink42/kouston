import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FormatService {
  altitude(meters: number): string {
    if (meters >= 1000000) {
      return `${(meters / 1000000).toFixed(2)} Mm`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }

  velocity(ms: number): string {
    if (Math.abs(ms) >= 1000) {
      return `${(ms / 1000).toFixed(2)} km/s`;
    }
    return `${ms.toFixed(1)} m/s`;
  }

  period(seconds: number): string {
    if (seconds < 0) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }

  distance(meters: number): string {
    if (meters >= 1e12) {
      return `${(meters / 1e12).toFixed(2)} Tm`;
    } else if (meters >= 1e9) {
      return `${(meters / 1e9).toFixed(2)} Gm`;
    } else if (meters >= 1e6) {
      return `${(meters / 1e6).toFixed(2)} Mm`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }

  number(value: number, decimals: number = 0): string {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  resourceName(type: string): string {
    switch (type) {
      case 'ElectricCharge': return 'Electric Charge';
      case 'LiquidFuel': return 'Liquid Fuel';
      case 'MonoPropellant': return 'Monopropellant';
      case 'XenonGas': return 'Xenon Gas';
      case 'SolidFuel': return 'Solid Fuel';
      default: return type;
    }
  }

  resourceAmount(amount: number, type: string): string {
    if (type === 'ElectricCharge') {
      if (amount >= 1000) {
        return `${(amount / 1000).toFixed(2)} kEC`;
      }
      return `${amount.toFixed(1)} EC`;
    }
    return amount.toFixed(1);
  }

  radToDeg(radians: number): number {
    return radians * 180 / Math.PI;
  }

  degToRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }
}
