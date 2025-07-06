import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const maintenanceGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  console.log('DEBUG - Maintenance Guard - Checking access:', {
    url: state.url,
    path: route.routeConfig?.path,
    isLoggedIn: authService.isLoggedIn(),
    user: authService.getCurrentUser()?.username,
    role: authService.getCurrentUser()?.role,
    isAdmin: authService.isAdmin(),
    isMaintenance: authService.isMaintenance()
  });

  // For development/testing, allow access to maintenance pages
  // This will be removed in production
  if ((window as any).allowMaintenanceAccess === true) {
    console.log('DEBUG - Maintenance access granted via override flag');
    return true;
  }

  // Use the AuthService's isMaintenance method for role checking
  if (authService.isLoggedIn() && authService.isMaintenance()) {
    console.log('DEBUG - Maintenance access granted: User has maintenance role');
    return true;
  }
  
  // If we have admin access, allow access as well
  if (authService.isLoggedIn() && authService.isAdmin()) {
    console.log('DEBUG - Maintenance access granted: User has admin role');
    return true;
  }
  
  // Redirect to login page if not authenticated or not a maintenance staff
  console.log('DEBUG - Maintenance access denied: Not logged in or not maintenance/admin role');
  router.navigate(['/login']);
  return false;
};
