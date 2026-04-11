import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';
import { ThemeService } from '../../services/theme.service';

interface BodyData {
  name: string;
  parent: string;
  sma: number;
  eccentricity: number;
  trueAnomaly: number;
  inclination: number;
  lan: number;
  argPeriapsis: number;
  radius: number;
  absoluteX?: number;
  absoluteY?: number;
}

@Component({
  selector: 'app-orbital-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orbital-view.component.html',
  styleUrl: './orbital-view.component.scss'
})
export class OrbitalViewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() vessel: Vessel | null = null;
  @ViewChild('orbitCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private themeService = inject(ThemeService);
  private ctx: CanvasRenderingContext2D | null = null;
  private zoomLevel = 1;
  private resizeObserver: ResizeObserver | null = null;
  private drawPending = false;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');

    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(canvas.parentElement!);

    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    this.draw();
  }

  private isLightMode(): boolean {
    return this.themeService.theme() === 'light';
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.85 : 1.18;
    this.zoomLevel = Math.max(0.00001, Math.min(1000, this.zoomLevel * zoomFactor));
    this.scheduleDraw();
  }

  private scheduleDraw(): void {
    if (this.drawPending) return;
    this.drawPending = true;
    requestAnimationFrame(() => {
      this.drawPending = false;
      this.draw();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vessel'] && this.ctx) {
      this.draw();
    }
  }

  private draw(): void {
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const width = canvas.width;
    const height = canvas.height;
    const light = this.isLightMode();

    // Clear canvas
    this.ctx.fillStyle = light ? '#ffffff' : '#0a0a0f';
    this.ctx.fillRect(0, 0, width, height);

    if (!this.vessel) {
      this.drawPlaceholder(width / 2, height / 2);
      return;
    }

    try {
      // Build body hierarchy and calculate absolute positions
      const bodies = this.buildBodyHierarchy();
      this.calculateAbsolutePositions(bodies);

      // Calculate spacecraft absolute position
      const spacecraft = this.calculateSpacecraftPosition(bodies);

      // Get the body we're orbiting
      const parentBody = bodies.get(this.vessel.bodyName);
      const centerX = parentBody?.absoluteX || 0;
      const centerY = parentBody?.absoluteY || 0;

      // Base scale on the vessel's orbit size for a good default view
      const vesselSma = Math.abs(this.vessel.semiMajorAxis) || 1000000;
      const e = this.vessel.eccentricity;
      let vesselOrbitExtent: number;

      if (e >= 1) {
        // Hyperbolic trajectory - show periapsis and current position with margin
        const periapsis = vesselSma * (e - 1);
        const currentR = this.vessel.altitude + (this.vessel.bodyRadius || 600000);
        vesselOrbitExtent = Math.max(periapsis * 4, currentR * 2);
      } else {
        // Elliptical - show the full orbit diameter
        vesselOrbitExtent = vesselSma * 2;
      }

      // Scale to fit vessel orbit nicely by default
      const margin = 50;
      const baseScale = (Math.min(width, height) / 2 - margin) / vesselOrbitExtent;
      const scale = baseScale * this.zoomLevel;

      // Offset to center on the body we're orbiting
      const offsetX = width / 2 - centerX * scale;
      const offsetY = height / 2 + centerY * scale; // Flip Y

      // Draw Sun at origin (if visible)
      if (offsetX > -100 && offsetX < width + 100 && offsetY > -100 && offsetY < height + 100) {
        this.drawSun(offsetX, offsetY, scale);
      }

      // Draw all bodies and their orbits
      this.drawBodies(bodies, offsetX, offsetY, scale, width, height);

      // Draw vessel orbit around its parent body
      this.drawVesselOrbit(bodies, offsetX, offsetY, scale, width, height);

      // Draw AP and PE markers
      this.drawApsides(bodies, offsetX, offsetY, scale);

      // Draw spacecraft
      this.drawSpacecraft(spacecraft, offsetX, offsetY, scale);

    } catch (e) {
      console.error('Error drawing orbital view:', e);
      this.drawPlaceholder(width / 2, height / 2);
    }
  }

  private buildBodyHierarchy(): Map<string, BodyData> {
    const bodies = new Map<string, BodyData>();

    if (!this.vessel?.bodyNames) return bodies;

    for (let i = 0; i < this.vessel.bodyNames.length; i++) {
      bodies.set(this.vessel.bodyNames[i], {
        name: this.vessel.bodyNames[i],
        parent: this.vessel.bodyParents?.[i] || '',
        sma: this.vessel.bodySemiMajorAxes?.[i] || 0,
        eccentricity: this.vessel.bodyEccentricities?.[i] || 0,
        trueAnomaly: this.vessel.bodyTrueAnomalies?.[i] || 0,
        inclination: this.vessel.bodyInclinations?.[i] || 0,
        lan: this.vessel.bodyLANs?.[i] || 0,
        argPeriapsis: this.vessel.bodyArgsOfPeriapsis?.[i] || 0,
        radius: this.vessel.bodyRadii?.[i] || 0
      });
    }

    return bodies;
  }

  private calculateAbsolutePositions(bodies: Map<string, BodyData>): void {
    // Calculate position relative to parent, then add parent's absolute position
    const calculated = new Set<string>();

    const calculate = (body: BodyData): { x: number; y: number } => {
      if (calculated.has(body.name)) {
        return { x: body.absoluteX!, y: body.absoluteY! };
      }

      // Position in orbit (simplified - assuming low eccentricity for display)
      const rotation = (body.lan + body.argPeriapsis) * Math.PI / 180;
      const angle = body.trueAnomaly + rotation;
      const r = body.sma * (1 - body.eccentricity * body.eccentricity) /
                (1 + body.eccentricity * Math.cos(body.trueAnomaly));

      let x = r * Math.cos(angle);
      let y = r * Math.sin(angle);

      // Add parent's position
      if (body.parent && bodies.has(body.parent)) {
        const parentPos = calculate(bodies.get(body.parent)!);
        x += parentPos.x;
        y += parentPos.y;
      }

      body.absoluteX = x;
      body.absoluteY = y;
      calculated.add(body.name);

      return { x, y };
    };

    for (const body of bodies.values()) {
      calculate(body);
    }
  }

  private calculateSpacecraftPosition(bodies: Map<string, BodyData>): { x: number; y: number } {
    if (!this.vessel) return { x: 0, y: 0 };

    const sma = Math.abs(this.vessel.semiMajorAxis);
    const e = this.vessel.eccentricity;
    const ta = this.vessel.trueAnomaly;
    const rotation = ((this.vessel.lan || 0) + (this.vessel.argumentOfPeriapsis || 0)) * Math.PI / 180;

    const p = e >= 1
      ? sma * (e * e - 1)
      : sma * (1 - e * e);

    const r = p / (1 + e * Math.cos(ta));
    const angle = ta + rotation;

    let x = r * Math.cos(angle);
    let y = r * Math.sin(angle);

    // Add parent body's absolute position
    const parentBody = bodies.get(this.vessel.bodyName);
    if (parentBody && parentBody.absoluteX !== undefined) {
      x += parentBody.absoluteX;
      y += parentBody.absoluteY!;
    }

    return { x, y };
  }

  private drawPlaceholder(centerX: number, centerY: number): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = this.isLightMode() ? '#999' : '#333';
    this.ctx.font = '16px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('No vessel selected', centerX, centerY);
  }

  private drawSun(offsetX: number, offsetY: number, scale: number): void {
    if (!this.ctx) return;

    const screenX = offsetX;
    const screenY = offsetY;
    const sunRadius = Math.max(15, 696340000 * scale); // Sun radius or min 15px

    const gradient = this.ctx.createRadialGradient(
      screenX - sunRadius * 0.3, screenY - sunRadius * 0.3, 0,
      screenX, screenY, sunRadius
    );
    gradient.addColorStop(0, '#ffff88');
    gradient.addColorStop(1, '#ffaa00');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, sunRadius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = this.isLightMode() ? '#000' : '#fff';
    this.ctx.font = 'bold 10px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Sun', screenX, screenY + sunRadius + 12);
  }

  private drawBodies(bodies: Map<string, BodyData>, offsetX: number, offsetY: number, scale: number, width: number, height: number): void {
    if (!this.ctx) return;

    const margin = 200;

    const isVisible = (x: number, y: number, radius: number) => {
      return x + radius > -margin && x - radius < width + margin &&
             y + radius > -margin && y - radius < height + margin;
    };

    // Batch orbits by type to minimize setLineDash calls
    const planetOrbits: { cx: number; cy: number; rx: number; ry: number; rot: number }[] = [];
    const moonOrbits: { cx: number; cy: number; rx: number; ry: number; rot: number }[] = [];

    for (const body of bodies.values()) {
      let parentX = 0, parentY = 0;
      if (body.parent && bodies.has(body.parent)) {
        const parent = bodies.get(body.parent)!;
        parentX = parent.absoluteX || 0;
        parentY = parent.absoluteY || 0;
      }

      const orbitScreenX = offsetX + parentX * scale;
      const orbitScreenY = offsetY - parentY * scale;
      const orbitRadius = body.sma * scale;

      if (!isVisible(orbitScreenX, orbitScreenY, orbitRadius)) continue;
      if (orbitRadius < 3) continue;

      const rotation = (body.lan + body.argPeriapsis) * Math.PI / 180;
      const e = body.eccentricity || 0;
      const semiMinor = body.sma * Math.sqrt(1 - e * e);
      const focusOffset = body.sma * e;

      const orbit = {
        cx: orbitScreenX - focusOffset * scale * Math.cos(rotation),
        cy: orbitScreenY + focusOffset * scale * Math.sin(rotation),
        rx: body.sma * scale,
        ry: semiMinor * scale,
        rot: -rotation
      };

      if (body.parent) {
        moonOrbits.push(orbit);
      } else {
        planetOrbits.push(orbit);
      }
    }

    // Draw planet orbits
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);

    if (planetOrbits.length > 0) {
      this.ctx.strokeStyle = '#666666';
      for (const o of planetOrbits) {
        this.ctx.beginPath();
        this.ctx.ellipse(o.cx, o.cy, o.rx, o.ry, o.rot, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }

    // Draw moon orbits
    if (moonOrbits.length > 0) {
      this.ctx.strokeStyle = '#ff66ff';
      for (const o of moonOrbits) {
        this.ctx.beginPath();
        this.ctx.ellipse(o.cx, o.cy, o.rx, o.ry, o.rot, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }

    this.ctx.setLineDash([]);

    // Draw bodies
    const drawnLabels: { x: number; y: number; name: string }[] = [];

    for (const body of bodies.values()) {
      const bodyX = offsetX + (body.absoluteX || 0) * scale;
      const bodyY = offsetY - (body.absoluteY || 0) * scale;
      const bodyRadius = Math.max(3, body.radius * scale);

      if (!isVisible(bodyX, bodyY, bodyRadius + 30)) continue;

      this.ctx.fillStyle = body.parent ? '#ff66ff' : this.getBodyColor(body.name);
      this.ctx.beginPath();
      this.ctx.arc(bodyX, bodyY, bodyRadius, 0, Math.PI * 2);
      this.ctx.fill();

      drawnLabels.push({ x: bodyX, y: bodyY - bodyRadius - 8, name: body.name });
    }

    // Draw labels
    this.ctx.fillStyle = this.isLightMode() ? '#000' : '#fff';
    this.ctx.font = 'bold 9px Courier New';
    this.ctx.textAlign = 'center';

    for (let i = 0; i < drawnLabels.length; i++) {
      let labelY = drawnLabels[i].y;
      for (let j = 0; j < i; j++) {
        const dx = Math.abs(drawnLabels[i].x - drawnLabels[j].x);
        const dy = Math.abs(labelY - drawnLabels[j].y);
        if (dx < 50 && dy < 12) {
          labelY -= 12;
        }
      }
      this.ctx.fillText(drawnLabels[i].name, drawnLabels[i].x, labelY);
    }
  }

  private getBodyColor(name: string): string {
    const colors: { [key: string]: string } = {
      'Moho': '#8B4513',
      'Eve': '#9932CC',
      'Kerbin': '#4a9eff',
      'Duna': '#CD853F',
      'Dres': '#808080',
      'Jool': '#32CD32',
      'Eeloo': '#E0FFFF',
      'Mun': '#888888',
      'Minmus': '#98FB98'
    };
    return colors[name] || '#888888';
  }

  private drawVesselOrbit(bodies: Map<string, BodyData>, offsetX: number, offsetY: number, scale: number, width: number, height: number): void {
    if (!this.ctx || !this.vessel) return;

    // Get parent body position
    let parentX = 0, parentY = 0;
    const parentBody = bodies.get(this.vessel.bodyName);
    if (parentBody) {
      parentX = parentBody.absoluteX || 0;
      parentY = parentBody.absoluteY || 0;
    }

    const orbitCenterX = offsetX + parentX * scale;
    const orbitCenterY = offsetY - parentY * scale;

    const sma = Math.abs(this.vessel.semiMajorAxis);
    const orbitRadius = sma * scale;

    // Skip if orbit is too small to see or completely off-screen
    if (orbitRadius < 1) return;
    const margin = 500;
    if (orbitCenterX + orbitRadius < -margin || orbitCenterX - orbitRadius > width + margin ||
        orbitCenterY + orbitRadius < -margin || orbitCenterY - orbitRadius > height + margin) {
      return;
    }

    const e = this.vessel.eccentricity;
    const rotation = ((this.vessel.lan || 0) + (this.vessel.argumentOfPeriapsis || 0)) * Math.PI / 180;

    if (e >= 1) {
      this.drawHyperbola(orbitCenterX, orbitCenterY, sma, e, scale, rotation);
    } else {
      const semiMinor = sma * Math.sqrt(1 - e * e);
      const focusOffset = sma * e;

      const ellipseCenterX = orbitCenterX - focusOffset * scale * Math.cos(rotation);
      const ellipseCenterY = orbitCenterY + focusOffset * scale * Math.sin(rotation);

      this.ctx.strokeStyle = '#4a9eff';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.ellipse(ellipseCenterX, ellipseCenterY, sma * scale, semiMinor * scale, -rotation, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawHyperbola(centerX: number, centerY: number, sma: number, e: number, scale: number, rotation: number): void {
    if (!this.ctx) return;

    this.ctx.strokeStyle = '#ff9944';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    const maxAngle = Math.acos(-1 / e) - 0.01;
    const p = sma * (e * e - 1);

    this.ctx.beginPath();
    let firstPoint = true;

    for (let i = 0; i <= 200; i++) {
      const theta = -maxAngle + (2 * maxAngle * i) / 200;
      const r = p / (1 + e * Math.cos(theta));

      if (r > 0) {
        const rotatedTheta = theta + rotation;
        const x = r * Math.cos(rotatedTheta);
        const y = r * Math.sin(rotatedTheta);
        const screenX = centerX + x * scale;
        const screenY = centerY - y * scale;

        if (firstPoint) {
          this.ctx.moveTo(screenX, screenY);
          firstPoint = false;
        } else {
          this.ctx.lineTo(screenX, screenY);
        }
      }
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawApsides(bodies: Map<string, BodyData>, offsetX: number, offsetY: number, scale: number): void {
    if (!this.ctx || !this.vessel) return;

    const e = this.vessel.eccentricity;
    // Only draw for elliptical orbits
    if (e >= 1) return;

    const sma = Math.abs(this.vessel.semiMajorAxis);
    const rotation = ((this.vessel.lan || 0) + (this.vessel.argumentOfPeriapsis || 0)) * Math.PI / 180;

    // Get parent body position
    let parentX = 0, parentY = 0;
    const parentBody = bodies.get(this.vessel.bodyName);
    if (parentBody) {
      parentX = parentBody.absoluteX || 0;
      parentY = parentBody.absoluteY || 0;
    }

    const orbitCenterX = offsetX + parentX * scale;
    const orbitCenterY = offsetY - parentY * scale;

    // Periapsis is at true anomaly = 0
    const rPe = sma * (1 - e);
    const peX = orbitCenterX + rPe * scale * Math.cos(rotation);
    const peY = orbitCenterY - rPe * scale * Math.sin(rotation);

    // Apoapsis is at true anomaly = π
    const rAp = sma * (1 + e);
    const apX = orbitCenterX + rAp * scale * Math.cos(rotation + Math.PI);
    const apY = orbitCenterY - rAp * scale * Math.sin(rotation + Math.PI);

    const light = this.isLightMode();

    // Draw PE marker
    this.ctx.fillStyle = '#00aaff';
    this.ctx.beginPath();
    this.ctx.arc(peX, peY, 5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = light ? '#000' : '#fff';
    this.ctx.font = 'bold 10px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PE', peX, peY - 10);

    // Draw AP marker
    this.ctx.fillStyle = '#00aaff';
    this.ctx.beginPath();
    this.ctx.arc(apX, apY, 5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = light ? '#000' : '#fff';
    this.ctx.fillText('AP', apX, apY - 10);
  }

  private drawSpacecraft(pos: { x: number; y: number }, offsetX: number, offsetY: number, scale: number): void {
    if (!this.ctx || !this.vessel) return;

    const screenX = offsetX + pos.x * scale;
    const screenY = offsetY - pos.y * scale;

    // Spacecraft marker
    this.ctx.fillStyle = '#00ff00';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Name
    this.ctx.fillStyle = this.isLightMode() ? '#000' : '#fff';
    this.ctx.font = 'bold 12px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.vessel.name, screenX, screenY - 15);
  }

  formatAlt(meters: number): string {
    if (meters < 0) return 'N/A';
    if (meters >= 1000000000) {
      return `${(meters / 1000000000).toFixed(2)} Gm`;
    } else if (meters >= 1000000) {
      return `${(meters / 1000000).toFixed(2)} Mm`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }

  formatTime(seconds: number): string {
    if (seconds < 0) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
}
