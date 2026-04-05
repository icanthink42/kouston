import { Routes } from '@angular/router';
import { MainDisplayComponent } from './components/main-display/main-display.component';

export const routes: Routes = [
  { path: '', component: MainDisplayComponent },
  { path: 'main', component: MainDisplayComponent },
  // Future station pages will go here
  // { path: 'tracking', component: TrackingStationComponent },
  // { path: 'flight', component: FlightControlComponent },
];
