import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseTelemetryComponent } from '../../../components/base-telemetry.component';
import { DisplayHeaderComponent } from '../../../components/display-header/display-header.component';
import { VesselSidebarComponent } from '../../../components/vessel-sidebar/vessel-sidebar.component';
import { OrbitalViewComponent } from '../../../components/orbital-view/orbital-view.component';
import { OrbitalMapComponent } from '../../../components/orbital-map/orbital-map.component';
import { EdlViewComponent } from '../../../components/edl-view/edl-view.component';
import { AscentViewComponent } from '../../../components/ascent-view/ascent-view.component';
import { PhaseViewComponent } from '../../../components/phase-view/phase-view.component';
import { SystemsViewComponent } from '../../../components/systems-view/systems-view.component';

type DisplayMode = 'orbital' | 'pod' | 'edl' | 'ground-track' | 'phase' | 'systems' | 'ascent';

@Component({
  selector: 'app-custom',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DisplayHeaderComponent,
    VesselSidebarComponent,
    OrbitalViewComponent,
    OrbitalMapComponent,
    EdlViewComponent,
    AscentViewComponent,
    PhaseViewComponent,
    SystemsViewComponent
  ],
  templateUrl: './custom.component.html',
  styleUrl: './custom.component.scss'
})
export class CustomComponent extends BaseTelemetryComponent {
  currentDisplay: DisplayMode = 'orbital';

  displayOptions: { value: DisplayMode; label: string }[] = [
    { value: 'ground-track', label: 'Ground Track' },
    { value: 'orbital', label: 'Orbital View' },
    { value: 'ascent', label: 'Ascent' },
    { value: 'edl', label: 'EDL (Lander)' },
    { value: 'pod', label: 'Pod (Atmospheric)' },
    { value: 'phase', label: 'Phase Angles' },
    { value: 'systems', label: 'Systems' },
  ];
}
