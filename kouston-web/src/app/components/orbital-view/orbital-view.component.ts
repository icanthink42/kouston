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

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
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

      // Validate values
      if (!isFinite(semiMajorAxis) || !isFinite(eccentricity) || semiMajorAxis <= 0) {
        this.drawPlaceholder(centerX, centerY);
        return;
      }

      let scale: number;
      const margin = 50;

      if (isHyperbolic) {
        // Hyperbolic trajectory
        const periapsis = semiMajorAxis * (eccentricity - 1);
        // Scale based on current distance from body for better view
        const currentR = this.vessel.altitude + bodyRadius;
        const visibleRadius = Math.max(periapsis * 3, currentR * 1.5);
        scale = (Math.min(width, height) / 2 - margin) / visibleRadius;

        if (isFinite(scale) && scale > 0) {
          this.drawHyperbola(centerX, centerY, semiMajorAxis, eccentricity, scale);
        }
      } else {
        // Elliptical orbit
        const semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
        const focusOffset = semiMajorAxis * eccentricity;
        const maxOrbitDim = Math.max(semiMajorAxis + focusOffset, semiMinorAxis);
        scale = (Math.min(width, height) / 2 - margin) / maxOrbitDim;

        if (isFinite(scale) && scale > 0) {
          this.drawOrbit(centerX, centerY, semiMajorAxis, semiMinorAxis, focusOffset, scale);
        }
      }

      if (!isFinite(scale) || scale <= 0) {
        this.drawPlaceholder(centerX, centerY);
        return;
      }

      // Draw body at focus
      this.drawBody(centerX, centerY, bodyRadius, semiMajorAxis * eccentricity, scale);

      // Draw spacecraft
      this.drawSpacecraft(centerX, centerY, semiMajorAxis, eccentricity, trueAnomaly, semiMajorAxis * eccentricity, scale);

      // Draw apsides (only periapsis for hyperbolic)
      this.drawApsides(centerX, centerY, semiMajorAxis, eccentricity, semiMajorAxis * eccentricity, scale);
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
    scale: number
  ): void {
    if (!this.ctx) return;

    // The ellipse center is offset from the focus (where the body is)
    // Body is at the right focus, so ellipse center is to the left
    const ellipseCenterX = centerX - focusOffset * scale;
    const ellipseCenterY = centerY;

    this.ctx.strokeStyle = '#4a9eff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    this.ctx.ellipse(
      ellipseCenterX,
      ellipseCenterY,
      semiMajorAxis * scale,
      semiMinorAxis * scale,
      0, 0, Math.PI * 2
    );
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawHyperbola(
    centerX: number,
    centerY: number,
    semiMajorAxis: number,
    eccentricity: number,
    scale: number
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
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
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

    // Draw asymptotes
    this.ctx.strokeStyle = '#444466';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 6]);

    const asymptoteLength = 500;
    const asymptoteAngle = Math.acos(-1 / eccentricity);

    // Upper asymptote
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.lineTo(
      centerX + Math.cos(asymptoteAngle) * asymptoteLength,
      centerY - Math.sin(asymptoteAngle) * asymptoteLength
    );
    this.ctx.stroke();

    // Lower asymptote
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.lineTo(
      centerX + Math.cos(-asymptoteAngle) * asymptoteLength,
      centerY - Math.sin(-asymptoteAngle) * asymptoteLength
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
    scale: number
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

    // Position in orbital plane (focus at origin)
    const x = r * Math.cos(trueAnomaly);
    const y = r * Math.sin(trueAnomaly);

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

    // Draw velocity vector direction (tangent to orbit)
    const velocityAngle = trueAnomaly + Math.PI / 2 + Math.atan2(eccentricity * Math.sin(trueAnomaly), 1 + eccentricity * Math.cos(trueAnomaly));
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
    scale: number
  ): void {
    if (!this.ctx || !this.vessel) return;

    const isHyperbolic = eccentricity >= 1;

    // Periapsis calculation differs for hyperbolic
    const periapsis = isHyperbolic
      ? semiMajorAxis * (eccentricity - 1)
      : semiMajorAxis * (1 - eccentricity);

    // Periapsis (closest point) - to the right of focus
    const peX = centerX + periapsis * scale;
    const peY = centerY;

    this.ctx.fillStyle = '#00ffff';
    this.ctx.beginPath();
    this.ctx.arc(peX, peY, 5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#00ffff';
    this.ctx.font = '10px Courier New';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Pe: ${this.formatAltitude(this.vessel.periapsis)}`, peX + 10, peY + 4);

    // Only draw apoapsis for elliptical orbits
    if (!isHyperbolic) {
      const apoapsis = semiMajorAxis * (1 + eccentricity);

      const apX = centerX - apoapsis * scale;
      const apY = centerY;

      this.ctx.fillStyle = '#ff6600';
      this.ctx.beginPath();
      this.ctx.arc(apX, apY, 5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ff6600';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`Ap: ${this.formatAltitude(this.vessel.apoapsis)}`, apX - 10, apY + 4);
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
}
