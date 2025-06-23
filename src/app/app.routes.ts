import { Routes } from '@angular/router';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { InstrumentsVerificationComponent } from './features/instruments-verification/instruments-verification.component';
import { OutboundTrackingComponent } from './features/outbound-tracking/outbound-tracking.component';
import { EquipmentTrackingComponent } from './features/equipment-tracking/equipment-tracking.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'instruments-verification', component: InstrumentsVerificationComponent },
  { path: 'outbound-tracking', component: OutboundTrackingComponent },
  { path: 'equipment-tracking', component: EquipmentTrackingComponent },
  { path: '**', redirectTo: 'login' } // Redirect invalid routes to login
];
