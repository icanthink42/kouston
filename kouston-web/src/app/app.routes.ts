import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { MainDisplayComponent } from './components/main-display/main-display.component';
import { OrbitalDisplayComponent } from './pages/orbital-display/orbital-display.component';
import { EdlDisplayComponent } from './pages/edl-display/edl-display.component';
import { PodDisplayComponent } from './pages/pod-display/pod-display.component';
import { PhaseDisplayComponent } from './pages/phase-display/phase-display.component';
import { SystemsDisplayComponent } from './pages/systems-display/systems-display.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'ground-track', component: MainDisplayComponent },
  { path: 'orbital', component: OrbitalDisplayComponent },
  { path: 'edl', component: EdlDisplayComponent },
  { path: 'pod', component: PodDisplayComponent },
  { path: 'phase', component: PhaseDisplayComponent },
  { path: 'systems', component: SystemsDisplayComponent },
];
