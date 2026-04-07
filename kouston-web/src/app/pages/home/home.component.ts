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
  screens = [
    { path: '/ground-track', name: 'Ground Track', description: 'Map view with vessel ground track' },
    { path: '/orbital', name: 'Orbital View', description: 'Orbital mechanics visualization' },
    { path: '/edl', name: 'EDL', description: 'Entry, descent & landing display' },
    { path: '/pod', name: 'Pod', description: 'Pod reentry display' },
    { path: '/phase', name: 'Phase Angles', description: 'Phase angles to system bodies' },
    { path: '/systems', name: 'Systems', description: 'Vessel resource management' },
  ];

  constructor(private router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
