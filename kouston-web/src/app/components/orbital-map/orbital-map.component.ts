import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';

@Component({
  selector: 'app-orbital-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orbital-map.component.html',
  styleUrl: './orbital-map.component.scss'
})
export class OrbitalMapComponent implements AfterViewInit, OnChanges {
  @Input() vessel: Vessel | null = null;
  @ViewChild('mapCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private mapImage: HTMLImageElement | null = null;
  private mapLoaded = false;

  // Map dimensions (4096x2048 equirectangular)
  private readonly MAP_WIDTH = 4096;
  private readonly MAP_HEIGHT = 2048;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');

    this.mapImage = new Image();
    this.mapImage.onload = () => {
      this.mapLoaded = true;
      this.draw();
    };
    this.mapImage.src = '/kerbin.jpg';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vessel'] && this.mapLoaded) {
      this.draw();
    }
  }

  private draw(): void {
    if (!this.ctx || !this.mapImage || !this.mapLoaded) return;

    const canvas = this.canvasRef.nativeElement;

    // Draw map
    this.ctx.drawImage(this.mapImage, 0, 0, canvas.width, canvas.height);

    if (!this.vessel) return;

    // Draw orbital path
    this.drawOrbit();

    // Draw vessel position
    this.drawVesselMarker();
  }

  private drawOrbit(): void {
    if (!this.ctx || !this.vessel) return;

    const canvas = this.canvasRef.nativeElement;
    const points = this.calculateGroundTrack();

    if (points.length < 2) return;

    this.ctx.strokeStyle = '#ffcc00';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    // Draw the ground track, handling wrap-around
    this.ctx.beginPath();
    let prevX = -1;

    for (let i = 0; i < points.length; i++) {
      const { lat, lon } = points[i];
      const x = this.lonToX(lon, canvas.width);
      const y = this.latToY(lat, canvas.height);

      // Detect wrap-around (large jump in x)
      if (prevX !== -1 && Math.abs(x - prevX) > canvas.width / 2) {
        this.ctx.stroke();
        this.ctx.beginPath();
      }

      if (prevX === -1 || Math.abs(x - prevX) > canvas.width / 2) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      prevX = x;
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawVesselMarker(): void {
    if (!this.ctx || !this.vessel) return;

    const canvas = this.canvasRef.nativeElement;
    const x = this.lonToX(this.vessel.longitude, canvas.width);
    const y = this.latToY(this.vessel.latitude, canvas.height);

    // Draw marker
    this.ctx.fillStyle = '#00ff00';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.arc(x, y, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw vessel name
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 14px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.vessel.name, x, y - 15);
  }

  private calculateGroundTrack(): { lat: number; lon: number }[] {
    if (!this.vessel || this.vessel.semiMajorAxis <= 0 || this.vessel.period <= 0) {
      return [];
    }

    const points: { lat: number; lon: number }[] = [];

    const incDeg = this.vessel.inclination;
    const orbitalPeriod = this.vessel.period;
    const currentLat = this.vessel.latitude;
    const currentLon = this.vessel.longitude;

    // Kerbin's sidereal rotation period in seconds (~6 hours)
    const kerbinRotationPeriod = 21549.425;

    // Planet rotation per orbit (how much ground moves east under the orbit)
    const planetRotationPerOrbit = (orbitalPeriod / kerbinRotationPeriod) * 360;

    // Net eastward ground track motion per orbit = 360° - planet rotation
    const netEastwardPerOrbit = 360 - planetRotationPerOrbit;

    // Calculate current phase from actual vessel latitude
    let currentPhase = 0;
    if (incDeg > 0.1) {
      const sinPhase = Math.max(-1, Math.min(1, currentLat / incDeg));
      currentPhase = Math.asin(sinPhase);

      // Determine if ascending or descending based on argument of latitude
      const argLatDeg = (this.vessel.argumentOfPeriapsis + this.vessel.trueAnomaly) % 360;

      // If descending (past the peak), adjust phase
      if (argLatDeg > 90 && argLatDeg < 270) {
        currentPhase = Math.PI - currentPhase;
      }
    }

    // Number of orbits to show (3 past + 3 future = 6 total)
    const orbitsToShow = 6;
    const pointsPerOrbit = 120;

    for (let i = 0; i <= orbitsToShow * pointsPerOrbit; i++) {
      // orbitOffset: -3 to +3 (negative = past, positive = future)
      const orbitOffset = ((i / (orbitsToShow * pointsPerOrbit)) - 0.5) * orbitsToShow;

      // Phase at this point (one orbit = 2π of phase)
      const phase = currentPhase + orbitOffset * 2 * Math.PI;

      // Latitude from sinusoidal pattern
      const lat = incDeg * Math.sin(phase);

      // Longitude: spacecraft moves eastward relative to ground
      let lon = currentLon + (orbitOffset * netEastwardPerOrbit);

      // Normalize to -180 to 180
      while (lon > 180) lon -= 360;
      while (lon < -180) lon += 360;

      points.push({ lat, lon });
    }

    return points;
  }

  private trueToMeanAnomaly(trueAnomaly: number, e: number): number {
    // Calculate eccentric anomaly from true anomaly
    const cosTA = Math.cos(trueAnomaly);
    const sinTA = Math.sin(trueAnomaly);

    const E = Math.atan2(
      Math.sqrt(1 - e * e) * sinTA,
      e + cosTA
    );

    // Mean anomaly from eccentric anomaly
    return E - e * Math.sin(E);
  }

  private lonToX(lon: number, width: number): number {
    return ((lon + 180) / 360) * width;
  }

  private latToY(lat: number, height: number): number {
    return ((90 - lat) / 180) * height;
  }
}
