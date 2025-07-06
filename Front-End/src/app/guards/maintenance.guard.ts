import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const maintenanceGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // For development/testing, allow access to maintenance pages
  // This will be removed in production
  if ((window as any).allowMaintenanceAccess === true) {
    console.log('Maintenance access granted via override flag');
    return true;
  }

  // Check if user is logged in and has maintenance role
  if (authService.isLoggedIn() && authService.getCurrentUser()?.role === 'maintenance') {
    return true;
  }
  
  // If we're in simulation mode, always allow access for testing
  if (authService['simulationMode'] === true) {
    console.log('Maintenance access granted via simulation mode');
    localStorage.setItem('auth_user', JSON.stringify({
      username: 'maintenance_user',
      role: 'maintenance',
      profile: { role: 'maintenance' }
    }));
    return true;
  }
  
  // Redirect to login page if not authenticated or not a maintenance staff
  router.navigate(['/login']);
  return false;
};
