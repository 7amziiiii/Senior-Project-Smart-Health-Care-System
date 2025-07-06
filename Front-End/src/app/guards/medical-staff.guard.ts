import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const medicalStaffGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Debug information about the route being accessed
  console.log('DEBUG - Medical Staff Guard - Attempted access to:', {
    url: state.url,
    path: route.routeConfig?.path,
    routeData: route.data,
    routeId: route.data?.['routeId'],
    user: authService.getCurrentUser()?.username,
    role: authService.getCurrentUser()?.role,
    isAdmin: authService.isAdmin(),
    isDoctorOrNurse: authService.isDoctorOrNurse(),
    isMaintenance: authService.isMaintenance(),
    // Include navigation history if available
    previousNavigation: history.state?.navigationId
  });
  
  // Check if user is doctor, nurse or admin (admin can access all)
  if (authService.isAdmin() || authService.isDoctorOrNurse()) {
    console.log('DEBUG - Medical Staff Guard - Access granted');
    return true;
  }
  
  console.log('Access denied: User is not medical staff (doctor or nurse) or admin');
  router.navigate(['/login']);
  return false;
};
