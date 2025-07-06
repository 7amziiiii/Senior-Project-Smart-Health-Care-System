import { Routes } from '@angular/router';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { InstrumentsVerificationComponent } from './features/instruments-verification/instruments-verification.component';
import { OutboundTrackingComponent } from './features/outbound-tracking/outbound-tracking.component';
import { EquipmentTrackingComponent } from './features/equipment-tracking/equipment-tracking.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { MaintenanceDashboardComponent } from './maintenance/maintenance-dashboard/maintenance-dashboard.component';
import { EquipmentOverviewComponent } from './features/equipment-overview/equipment-overview.component';
import { PredictiveMaintenanceComponent } from './features/predictive-maintenance/predictive-maintenance.component';
import { adminGuard } from './guards/admin.guard';
import { maintenanceGuard } from './guards/maintenance.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'maintenance', component: MaintenanceDashboardComponent, canActivate: [maintenanceGuard] },
  { path: 'instruments-verification', component: InstrumentsVerificationComponent },
  { path: 'outbound-tracking', component: OutboundTrackingComponent },
  { path: 'equipment-tracking', component: EquipmentTrackingComponent },
  { path: 'equipment-overview', component: EquipmentOverviewComponent },
  { path: 'predictive-maintenance', component: PredictiveMaintenanceComponent },
  { path: '**', redirectTo: 'login' } // Redirect invalid routes to login
];
