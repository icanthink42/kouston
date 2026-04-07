import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  roles = [
    { path: '/flight-director', name: 'Flight Director', description: 'Orbital view when in orbit, Pod reentry when suborbital' },
    { path: '/gnc', name: 'GNC', description: 'Guidance, Navigation & Control - Phase angles display' },
    { path: '/eecom', name: 'EECOM', description: 'Electrical, Environmental & Consumables - Systems display' },
    { path: '/custom', name: 'Custom', description: 'Manually select any display' },
  ];

  constructor(private router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
