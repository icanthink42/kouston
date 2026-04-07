import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vessel } from '../../models/telemetry';

@Component({
  selector: 'app-vessel-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vessel-sidebar.component.html',
  styleUrl: './vessel-sidebar.component.scss'
})
export class VesselSidebarComponent {
  @Input() vessels: { [id: string]: Vessel } = {};
  @Input() vesselIds: string[] = [];
  @Input() selectedVesselId: string | null = null;

  @Output() vesselSelect = new EventEmitter<string>();

  selectVessel(id: string): void {
    this.vesselSelect.emit(id);
  }

  getVessel(id: string): Vessel {
    return this.vessels[id];
  }
}
