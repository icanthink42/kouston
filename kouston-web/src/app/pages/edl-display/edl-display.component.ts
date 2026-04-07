import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseTelemetryComponent } from '../../components/base-telemetry.component';
import { DisplayHeaderComponent, PageOption } from '../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../components/vessel-sidebar/vessel-sidebar.component';

@Component({
  selector: 'app-edl-display',
  standalone: true,
  imports: [CommonModule, DisplayHeaderComponent, VesselSidebarComponent],
  templateUrl: './edl-display.component.html',
  styleUrl: './edl-display.component.scss'
})
export class EdlDisplayComponent extends BaseTelemetryComponent {
  pageOptions: PageOption[] = [
    { value: '/ground-track', label: 'Ground Track' },
    { value: '/orbital', label: 'Orbital View' },
    { value: '/edl', label: 'EDL', selected: true },
    { value: '/pod', label: 'Pod' },
    { value: '/phase', label: 'Phase Angles' },
    { value: '/systems', label: 'Systems' },
  ];

  onNavigate(path: string): void {
    this.router.navigate([path]);
  }

  getLanderRotation(): number {
    if (!this.selectedVessel) return 0;
    return 90 - this.selectedVessel.pitch;
  }
}
