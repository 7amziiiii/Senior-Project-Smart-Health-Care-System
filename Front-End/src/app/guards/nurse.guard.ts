import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const nurseGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Check if user is nurse or admin (admin can access all)
  if (authService.isAdmin() || authService.isNurse()) {
    return true;
  }
  
  console.log('Access denied: User is not a nurse or admin');
  router.navigate(['/login']);
  return false;
};
