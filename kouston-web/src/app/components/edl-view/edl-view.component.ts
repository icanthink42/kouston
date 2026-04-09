import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';
import { FormatService } from '../../services/format.service';

@Component({
  selector: 'app-edl-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './edl-view.component.html',
  styleUrl: './edl-view.component.scss'
})
export class EdlViewComponent {
  @Input() vessel: Vessel | null = null;
  @Input() mode: 'pod' | 'lander' = 'lander';

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

  getRotation(): number {
    if (!this.vessel) return 0;
    return 90 - this.vessel.pitch;
  }

  getHeading(): number {
    if (!this.vessel) return 0;
    return Math.round(this.vessel.heading || 0);
  }

  getPrograde(): number {
    if (!this.vessel) return 0;
    return Math.round(this.vessel.prograde || 0);
  }

  getImage(): string {
    if (this.mode === 'pod') {
      return 'pod.png';
    }
    return this.vessel && this.vessel.throttle > 0 ? 'lander_fire.png' : 'lander.png';
  }
}
