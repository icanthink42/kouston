import { Routes } from '@angular/router';
import { MainDisplayComponent } from './components/main-display/main-display.component';
import { OrbitalDisplayComponent } from './pages/orbital-display/orbital-display.component';
import { EdlDisplayComponent } from './pages/edl-display/edl-display.component';

export const routes: Routes = [
  { path: '', component: MainDisplayComponent },
  { path: 'main', component: MainDisplayComponent },
  { path: 'orbital', component: OrbitalDisplayComponent },
  { path: 'edl', component: EdlDisplayComponent },
];
