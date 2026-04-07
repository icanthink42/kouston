import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { FlightDirectorComponent } from './pages/roles/flight-director/flight-director.component';
import { GncComponent } from './pages/roles/gnc/gnc.component';
import { EecomComponent } from './pages/roles/eecom/eecom.component';
import { CustomComponent } from './pages/roles/custom/custom.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'flight-director', component: FlightDirectorComponent },
  { path: 'gnc', component: GncComponent },
  { path: 'eecom', component: EecomComponent },
  { path: 'custom', component: CustomComponent },
];
