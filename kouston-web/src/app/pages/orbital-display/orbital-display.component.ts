import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseTelemetryComponent } from '../../components/base-telemetry.component';
import { DisplayHeaderComponent, PageOption } from '../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../components/vessel-sidebar/vessel-sidebar.component';
import { OrbitalViewComponent } from '../../components/orbital-view/orbital-view.component';

@Component({
  selector: 'app-orbital-display',
  standalone: true,
  imports: [CommonModule, DisplayHeaderComponent, VesselSidebarComponent, OrbitalViewComponent],
  templateUrl: './orbital-display.component.html',
  styleUrl: './orbital-display.component.scss'
})
export class OrbitalDisplayComponent extends BaseTelemetryComponent {
  pageOptions: PageOption[] = [
    { value: '/ground-track', label: 'Ground Track' },
    { value: '/orbital', label: 'Orbital View', selected: true },
    { value: '/edl', label: 'EDL' },
    { value: '/pod', label: 'Pod' },
    { value: '/phase', label: 'Phase Angles' },
    { value: '/systems', label: 'Systems' },
  ];

  onNavigate(path: string): void {
    this.router.navigate([path]);
  }
}
