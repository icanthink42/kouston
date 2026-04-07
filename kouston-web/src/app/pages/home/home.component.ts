import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TelemetryService, Team } from '../../services/telemetry.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  roles = [
    { path: '/flight-director', name: 'Flight Director', description: 'Orbital view when in orbit, Pod reentry when suborbital' },
    { path: '/gnc', name: 'GNC', description: 'Guidance, Navigation & Control - Phase angles display' },
    { path: '/eecom', name: 'EECOM', description: 'Electrical, Environmental & Consumables - Systems display' },
    { path: '/custom', name: 'Custom', description: 'Manually select any display' },
  ];

  connected = false;
  isLocal = false;
  localIP = '127.0.0.1';
  localPort = '7777';
  useSSL = false;

  private connectedSub: Subscription | null = null;

  constructor(
    private router: Router,
    private telemetryService: TelemetryService
  ) {}

  ngOnInit(): void {
    this.isLocal = this.telemetryService.isLocal;
    this.connectedSub = this.telemetryService.connected$.subscribe(
      connected => this.connected = connected
    );
  }

  ngOnDestroy(): void {
    this.connectedSub?.unsubscribe();
  }

  selectTeam(team: Team): void {
    this.telemetryService.connectWithTeam(team);
  }

  connectLocal(): void {
    const port = parseInt(this.localPort, 10);
    if (!isNaN(port)) {
      this.telemetryService.connectLocal(this.localIP, port, this.useSSL);
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
