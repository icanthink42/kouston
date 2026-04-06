import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';

@Component({
  selector: 'app-orbital-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orbital-view.component.html',
  styleUrl: './orbital-view.component.scss'
})
export class OrbitalViewComponent implements AfterViewInit, OnChanges {
  @Input() vessel: Vessel | null = null;
  @ViewChild('orbitCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private zoomLevel = 1;
  private readonly minZoom = 0.1;
  private readonly maxZoom = 10;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');

    // Add wheel event for zooming
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    this.draw();
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));

    this.draw();
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
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, width, height);

    if (!this.vessel) {
      this.drawPlaceholder(centerX, centerY);
      return;
    }

    try {
      const bodyRadius = this.vessel.bodyRadius;
      const semiMajorAxis = Math.abs(this.vessel.semiMajorAxis);
      const eccentricity = this.vessel.eccentricity;
      const trueAnomaly = this.vessel.trueAnomaly;
      const isHyperbolic = eccentricity >= 1;

      // Longitude of periapsis for inertial frame rotation
      const lan = (this.vessel.lan || 0) * Math.PI / 180;
      const argPeriapsis = (this.vessel.argumentOfPeriapsis || 0) * Math.PI / 180;
      const longitudeOfPeriapsis = lan + argPeriapsis;

      // Validate values
      if (!isFinite(semiMajorAxis) || !isFinite(eccentricity) || semiMajorAxis <= 0) {
        this.drawPlaceholder(centerX, centerY);
        return;
      }

      // Find visible bodies and calculate max extent needed
      const visibleBodies = this.getVisibleBodies();
      let maxExtent: number;

      if (isHyperbolic) {
        const periapsis = semiMajorAxis * (eccentricity - 1);
        const currentR = this.vessel.altitude + bodyRadius;
        maxExtent = Math.max(periapsis * 3, currentR * 1.5);
      } else {
        const focusOffset = semiMajorAxis * eccentricity;
        maxExtent = semiMajorAxis + focusOffset;
      }

      // Include visible body orbits in scale calculation
      for (const body of visibleBodies) {
        maxExtent = Math.max(maxExtent, body.sma);
      }

      const margin = 50;
      const scale = ((Math.min(width, height) / 2 - margin) / maxExtent) * this.zoomLevel;

      if (!isFinite(scale) || scale <= 0) {
        this.drawPlaceholder(centerX, centerY);
        return;
      }

      if (isHyperbolic) {
        this.drawHyperbola(centerX, centerY, semiMajorAxis, eccentricity, scale, longitudeOfPeriapsis);
      } else {
        const semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
        const focusOffset = semiMajorAxis * eccentricity;
        this.drawOrbit(centerX, centerY, semiMajorAxis, semiMinorAxis, focusOffset, scale, longitudeOfPeriapsis);
      }

      // Draw body at focus
      this.drawBody(centerX, centerY, bodyRadius, semiMajorAxis * eccentricity, scale);

      // Draw nearby system bodies (within 5 degrees inclination)
      this.drawNearbyBodiesFromList(centerX, centerY, scale, visibleBodies);

      // Draw spacecraft
      this.drawSpacecraft(centerX, centerY, semiMajorAxis, eccentricity, trueAnomaly, semiMajorAxis * eccentricity, scale, longitudeOfPeriapsis);

      // Draw apsides (only periapsis for hyperbolic)
      this.drawApsides(centerX, centerY, semiMajorAxis, eccentricity, semiMajorAxis * eccentricity, scale, longitudeOfPeriapsis);
    } catch (e) {
      console.error('Error drawing orbital view:', e);
      this.drawPlaceholder(centerX, centerY);
    }
  }

  private drawPlaceholder(centerX: number, centerY: number): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = '#333';
    this.ctx.font = '16px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('No vessel selected', centerX, centerY);
  }

  private drawOrbit(
    centerX: number,
    centerY: number,
    semiMajorAxis: number,
    semiMinorAxis: number,
    focusOffset: number,
    scale: number,
    rotation: number
  ): void {
    if (!this.ctx) return;

    // The ellipse center is offset from the focus (where the body is)
    // Apply rotation to the offset direction
    const ellipseCenterX = centerX - focusOffset * scale * Math.cos(rotation);
    const ellipseCenterY = centerY + focusOffset * scale * Math.sin(rotation);

    this.ctx.strokeStyle = '#4a9eff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    this.ctx.ellipse(
      ellipseCenterX,
      ellipseCenterY,
      semiMajorAxis * scale,
      semiMinorAxis * scale,
      -rotation, 0, Math.PI * 2
    );
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawHyperbola(
    centerX: number,
    centerY: number,
    semiMajorAxis: number,
    eccentricity: number,
    scale: number,
    rotation: number
  ): void {
    if (!this.ctx) return;

    this.ctx.strokeStyle = '#ff9944';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    // For hyperbola: r = a(e² - 1) / (1 + e*cos(θ))
    // Valid range: θ where 1 + e*cos(θ) > 0, i.e., cos(θ) > -1/e
    // So θ in range (-maxAngle, maxAngle) where maxAngle = arccos(-1/e)
    const maxAngle = Math.acos(-1 / eccentricity) - 0.01; // Slight margin to avoid infinity
    const p = semiMajorAxis * (eccentricity * eccentricity - 1);

    this.ctx.beginPath();
    const steps = 200;
    let firstPoint = true;

    for (let i = 0; i <= steps; i++) {
      const theta = -maxAngle + (2 * maxAngle * i) / steps;
      const r = p / (1 + eccentricity * Math.cos(theta));

      if (r > 0) {
        // Apply rotation to get inertial frame position
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

    // Draw asymptotes (also rotated)
    this.ctx.strokeStyle = '#444466';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 6]);

    const asymptoteLength = 500;
    const asymptoteAngle = Math.acos(-1 / eccentricity);

    // Upper asymptote
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.lineTo(
      centerX + Math.cos(asymptoteAngle + rotation) * asymptoteLength,
      centerY - Math.sin(asymptoteAngle + rotation) * asymptoteLength
    );
    this.ctx.stroke();

    // Lower asymptote
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.lineTo(
      centerX + Math.cos(-asymptoteAngle + rotation) * asymptoteLength,
      centerY - Math.sin(-asymptoteAngle + rotation) * asymptoteLength
    );
    this.ctx.stroke();

    this.ctx.setLineDash([]);
  }

  private drawBody(
    centerX: number,
    centerY: number,
    bodyRadius: number,
    focusOffset: number,
    scale: number
  ): void {
    if (!this.ctx || !this.vessel) return;

    // Body is at the focus (centerX, centerY)
    const bodyScreenRadius = Math.max(bodyRadius * scale, 15); // Min 15px for visibility

    // Draw body
    const gradient = this.ctx.createRadialGradient(
      centerX - bodyScreenRadius * 0.3,
      centerY - bodyScreenRadius * 0.3,
      0,
      centerX,
      centerY,
      bodyScreenRadius
    );

    // Color based on body name
    const bodyName = this.vessel.bodyName || 'Kerbin';
    if (bodyName === 'Kerbin') {
      gradient.addColorStop(0, '#5588ff');
      gradient.addColorStop(0.5, '#336699');
      gradient.addColorStop(1, '#224466');
    } else if (bodyName === 'Mun') {
      gradient.addColorStop(0, '#aaaaaa');
      gradient.addColorStop(1, '#555555');
    } else if (bodyName === 'Minmus') {
      gradient.addColorStop(0, '#aaffaa');
      gradient.addColorStop(1, '#558855');
    } else if (bodyName === 'Sun' || bodyName === 'Kerbol') {
      gradient.addColorStop(0, '#ffff88');
      gradient.addColorStop(1, '#ffaa00');
    } else {
      gradient.addColorStop(0, '#888888');
      gradient.addColorStop(1, '#444444');
    }

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, bodyScreenRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Body name
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(bodyName, centerX, centerY + bodyScreenRadius + 15);
  }

  private drawSpacecraft(
    centerX: number,
    centerY: number,
    semiMajorAxis: number,
    eccentricity: number,
    trueAnomaly: number,
    focusOffset: number,
    scale: number,
    rotation: number
  ): void {
    if (!this.ctx || !this.vessel) return;

    const isHyperbolic = eccentricity >= 1;

    // Calculate spacecraft position from true anomaly
    // For ellipse: r = a(1 - e²) / (1 + e*cos(θ))
    // For hyperbola: r = a(e² - 1) / (1 + e*cos(θ))
    const p = isHyperbolic
      ? semiMajorAxis * (eccentricity * eccentricity - 1)
      : semiMajorAxis * (1 - eccentricity * eccentricity);

    const denominator = 1 + eccentricity * Math.cos(trueAnomaly);
    if (Math.abs(denominator) < 0.001) return; // Avoid division by near-zero

    const r = p / denominator;
    if (!isFinite(r) || r <= 0) return;

    // Position in inertial frame (apply rotation)
    const inertialAngle = trueAnomaly + rotation;
    const x = r * Math.cos(inertialAngle);
    const y = r * Math.sin(inertialAngle);

    // Screen coordinates (body/focus is at centerX, centerY)
    const screenX = centerX + x * scale;
    const screenY = centerY - y * scale; // Flip Y for screen coordinates

    // Draw spacecraft marker
    this.ctx.fillStyle = '#00ff00';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw velocity vector direction (tangent to orbit, also rotated)
    const velocityAngle = trueAnomaly + rotation + Math.PI / 2 + Math.atan2(eccentricity * Math.sin(trueAnomaly), 1 + eccentricity * Math.cos(trueAnomaly));
    const arrowLength = 25;

    this.ctx.strokeStyle = '#ffcc00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(screenX, screenY);
    this.ctx.lineTo(
      screenX + Math.cos(velocityAngle) * arrowLength,
      screenY - Math.sin(velocityAngle) * arrowLength
    );
    this.ctx.stroke();

    // Vessel name
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.vessel.name, screenX, screenY - 15);
  }

  private drawApsides(
    centerX: number,
    centerY: number,
    semiMajorAxis: number,
    eccentricity: number,
    focusOffset: number,
    scale: number,
    rotation: number
  ): void {
    if (!this.ctx || !this.vessel) return;

    const isHyperbolic = eccentricity >= 1;

    // Periapsis calculation differs for hyperbolic
    const periapsis = isHyperbolic
      ? semiMajorAxis * (eccentricity - 1)
      : semiMajorAxis * (1 - eccentricity);

    // Periapsis (closest point) - rotated to inertial position
    const peX = centerX + periapsis * scale * Math.cos(rotation);
    const peY = centerY - periapsis * scale * Math.sin(rotation);

    this.ctx.fillStyle = '#00ffff';
    this.ctx.beginPath();
    this.ctx.arc(peX, peY, 5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#00ffff';
    this.ctx.font = '10px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Pe: ${this.formatAltitude(this.vessel.periapsis)}`, peX, peY - 10);

    // Only draw apoapsis for elliptical orbits
    if (!isHyperbolic) {
      const apoapsis = semiMajorAxis * (1 + eccentricity);

      // Apoapsis is 180° from periapsis
      const apX = centerX - apoapsis * scale * Math.cos(rotation);
      const apY = centerY + apoapsis * scale * Math.sin(rotation);

      this.ctx.fillStyle = '#ff6600';
      this.ctx.beginPath();
      this.ctx.arc(apX, apY, 5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ff6600';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`Ap: ${this.formatAltitude(this.vessel.apoapsis)}`, apX, apY - 10);
    } else {
      // Show "ESCAPE" indicator for hyperbolic
      this.ctx.fillStyle = '#ff9944';
      this.ctx.font = 'bold 12px Courier New';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('ESCAPE TRAJECTORY', 10, 20);
    }
  }

  private formatAltitude(meters: number): string {
    if (meters >= 1000000) {
      return `${(meters / 1000000).toFixed(2)} Mm`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }

  private getVisibleBodies(): { name: string; ta: number; rotation: number; sma: number; radius: number }[] {
    if (!this.vessel || !this.vessel.bodyNames || this.vessel.bodyNames.length === 0) {
      return [];
    }

    const thresholdDeg = 5;
    const vesselInclination = this.vessel.inclination || 0;
    const visibleBodies: { name: string; ta: number; rotation: number; sma: number; radius: number }[] = [];

    for (let i = 0; i < this.vessel.bodyNames.length; i++) {
      const bodyInclination = this.vessel.bodyInclinations?.[i] || 0;
      const inclinationDiff = Math.abs(bodyInclination - vesselInclination);

      if (inclinationDiff <= thresholdDeg) {
        const bodyAoP = (this.vessel.bodyArgsOfPeriapsis?.[i] || 0) * Math.PI / 180;
        const bodyLAN = (this.vessel.bodyLANs?.[i] || 0) * Math.PI / 180;

        visibleBodies.push({
          name: this.vessel.bodyNames[i],
          ta: this.vessel.bodyTrueAnomalies?.[i] || 0,
          rotation: bodyLAN + bodyAoP,
          sma: this.vessel.bodySemiMajorAxes?.[i] || 0,
          radius: this.vessel.bodyRadii?.[i] || 0
        });
      }
    }

    return visibleBodies;
  }

  private drawNearbyBodiesFromList(
    centerX: number,
    centerY: number,
    scale: number,
    bodies: { name: string; ta: number; rotation: number; sma: number; radius: number }[]
  ): void {
    if (!this.ctx) return;

    for (const body of bodies) {
      this.drawSystemBodyOrbit(centerX, centerY, body.sma, body.rotation, scale);
      this.drawSystemBody(centerX, centerY, body.sma, body.ta, body.rotation, body.radius, body.name, scale);
    }
  }

  private drawSystemBodyOrbit(
    centerX: number,
    centerY: number,
    semiMajorAxis: number,
    rotation: number,
    scale: number
  ): void {
    if (!this.ctx) return;

    // Assume circular orbit for moons (e ≈ 0)
    this.ctx.strokeStyle = '#ff66ff';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, semiMajorAxis * scale, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawSystemBody(
    centerX: number,
    centerY: number,
    semiMajorAxis: number,
    trueAnomaly: number,
    rotation: number,
    radius: number,
    name: string,
    scale: number
  ): void {
    if (!this.ctx) return;

    // Position in inertial frame
    const inertialAngle = trueAnomaly + rotation;
    const r = semiMajorAxis; // Assuming circular orbit
    const x = r * Math.cos(inertialAngle);
    const y = r * Math.sin(inertialAngle);

    const screenX = centerX + x * scale;
    const screenY = centerY - y * scale;

    // Draw body marker
    const bodyScreenRadius = Math.max(radius * scale, 6);

    this.ctx.fillStyle = '#ff66ff';
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, bodyScreenRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Body name
    this.ctx.fillStyle = '#ff66ff';
    this.ctx.font = 'bold 10px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(name, screenX, screenY - bodyScreenRadius - 5);
  }
}
