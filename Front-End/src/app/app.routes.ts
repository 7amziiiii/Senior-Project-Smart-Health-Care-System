import { Router, Routes } from '@angular/router';
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
import { doctorGuard } from './guards/doctor.guard';
import { nurseGuard } from './guards/nurse.guard';
import { medicalStaffGuard } from './guards/medical-staff.guard';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';

export const routes: Routes = [
  // Root path redirects to login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // Home path handles role-based routing after login
  { 
    path: 'home', 
    canActivate: [() => {
      const authService = inject(AuthService);
      const router = inject(Router);
      
      // If not logged in, redirect to login page
      if (!authService.isLoggedIn()) {
        router.navigate(['/login']);
        return false;
      }
      
      // If user is admin, redirect to admin dashboard
      if (authService.isAdmin()) {
        router.navigate(['/admin']);
        return false;
      }
      
      // If user is maintenance, redirect to maintenance dashboard
      if (authService.isMaintenance()) {
        router.navigate(['/maintenance']);
        return false;
      }
      
      // If user is doctor or nurse, redirect to general dashboard
      if (authService.isDoctorOrNurse()) {
        router.navigate(['/dashboard']);
        return false;
      }
      
      // Fallback - if role not recognized, go to login
      router.navigate(['/login']);
      return false;
    }],
    component: LoginComponent
  },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [medicalStaffGuard], data: { routeId: 'dashboard' } },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard], data: { routeId: 'admin' } },
  { path: 'maintenance', component: MaintenanceDashboardComponent, canActivate: [maintenanceGuard], data: { routeId: 'maintenance' } },
  { path: 'instruments-verification', component: InstrumentsVerificationComponent, canActivate: [medicalStaffGuard] },
  { path: 'outbound-tracking', component: OutboundTrackingComponent, canActivate: [medicalStaffGuard] },
  { path: 'equipment-tracking', component: EquipmentTrackingComponent, canActivate: [medicalStaffGuard] },
  { path: 'equipment-overview', component: EquipmentOverviewComponent, canActivate: [maintenanceGuard] },
  { path: 'predictive-maintenance', component: PredictiveMaintenanceComponent, canActivate: [maintenanceGuard] },
  { path: '**', redirectTo: 'login' } // Redirect invalid routes to login
];
