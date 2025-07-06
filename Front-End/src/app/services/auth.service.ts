import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private apiUrl = environment.apiUrl;
  private isAuthenticated = new BehaviorSubject<boolean>(this.hasToken());
  private simulationMode = false; // DISABLED - using real token authentication only
  
  constructor(private http: HttpClient, private router: Router) {
    // Clear any simulated tokens when starting in real mode
    this.clearSimulatedTokens();
  }
  
  /**
   * Check if the stored token is a simulated token and clear it if we're in real mode
   */
  private clearSimulatedTokens(): void {
    if (!this.simulationMode) {
      const token = this.getToken();
      
      if (token && token.startsWith('simulated-token-')) {
        console.log('Clearing simulated token');
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.isAuthenticated.next(false);
      }
    }
  }
  
  login(username: string, password: string): Observable<any> {
    // Check if simulation mode is enabled
    if (this.simulationMode) {
      console.log('Using simulation mode for login:', username);
      
      // Simulate successful login for any username/password
      const simulatedToken = 'simulated-token-' + Date.now();
      
      // Determine user role based on username
      let role = 'staff';
      let isStaff = false;
      let isSuperuser = false;
      
      // Assign roles based on username
      if (username === 'admin') {
        role = 'admin';
        isStaff = true;
        isSuperuser = true;
      } else if (username === 'itguy') {
        role = 'it_admin';
        isStaff = true;
      } else if (username === 'main') {
        role = 'maintenance';
        isStaff = true;
      }
      
      // Create user data based on username
      const userData = {
        username: username,
        is_staff: isStaff,
        is_superuser: isSuperuser,
        role: role,
        profile: { role: role }
      };
      
      // Store auth data
      localStorage.setItem(this.TOKEN_KEY, simulatedToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
      this.isAuthenticated.next(true);
      
      return of({
        token: simulatedToken,
        username: username
      });
    }
    
    // First, clear any existing tokens to prevent invalid auth states
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    
    // Log the request being made
    console.log('Sending login request to:', `${this.apiUrl}/auth/login/`);
    console.log('Login payload:', { username, password: '********' });
    
    // Real backend implementation
    return this.http.post<any>(`${this.apiUrl}/auth/login/`, { username, password })
      .pipe(
        tap(response => {
          // Debug the login response
          console.log('Login response:', response);
          
          if (response && response.token) {
            // Store token and user data
            // DEBUG: Log the raw response from backend
            console.log('DEBUG - Raw login response:', response);
            
            // If username is 'maintenance', force the role to be maintenance
            // This is a temporary fix until we resolve the backend issue
            let roleValue = response.role || '';
            let profileRole = response.profile?.role || roleValue;
            
            if (username.toLowerCase() === 'maintenance') {
              console.log('DEBUG - Detected maintenance username, setting role explicitly');
              roleValue = 'maintenance';
              profileRole = 'maintenance';
            }
            
            // Use the role information from the backend response
            const userData = {
              username: response.username || username,
              is_staff: response.is_staff !== undefined ? response.is_staff : false,
              is_superuser: response.is_superuser !== undefined ? response.is_superuser : false,
              // Use role with special handling for maintenance
              role: roleValue,
              // Use profile with special handling for maintenance
              profile: {
                role: profileRole
              }
            };
            
            console.log('Storing user data:', userData);
            localStorage.setItem(this.TOKEN_KEY, response.token);
            localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
            this.isAuthenticated.next(true);
            
            // Add explicit debug logs for navigation
            console.log('DEBUG - Navigating based on role checks:', { 
              isAdmin: this.isAdmin(),
              isMaintenance: this.isMaintenance(),
              isDoctorOrNurse: this.isDoctorOrNurse()
            });
            
            // Clear navigation history to prevent unwanted redirects
            history.replaceState({}, '', window.location.pathname);
            
            // Navigate based on user role with clear fallbacks
            if (this.isAdmin()) {
              console.log('DEBUG - Navigating to admin dashboard');
              // Use skipLocationChange to avoid browser history issues
              this.router.navigate(['/admin'], { replaceUrl: true, skipLocationChange: false });
            } else if (this.isMaintenance()) {
              console.log('DEBUG - Navigating to maintenance dashboard');
              // Force browser to clear history and prevent any redirect attempts for maintenance users
              setTimeout(() => {
                window.location.href = '/maintenance';
              }, 100);
            } else if (this.isDoctorOrNurse()) {
              console.log('DEBUG - Navigating to general dashboard');
              this.router.navigate(['/dashboard'], { replaceUrl: true });
            } else {
              // Explicit fallback if no role matched
              console.log('DEBUG - No role matched, navigating to login');
              this.router.navigate(['/login'], { replaceUrl: true });
            }
          }
        }),
        catchError(error => {
          console.error('Login error:', error);
          return this.handleError(error);
        })
      );
  }
  
  register(firstName: string, lastName: string, email: string, username: string, role: string, password: string): Observable<any> {
    // Check if simulation mode is enabled
    if (this.simulationMode) {
      console.log('Using simulation mode for registration', { firstName, lastName, email, username, role });
      
      // Always return success in simulation mode
      return of({ 
        message: 'Registration successful. Account pending admin approval.', 
        username: username, 
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: role,
        is_active: username === 'teeti' || username === 'itguy' // Make test accounts active
      });
    }
    
    // Real backend implementation
    return this.http.post<any>(`${this.apiUrl}/auth/register/`, {
      first_name: firstName,
      last_name: lastName,
      email: email,
      username: username,
      role: role,
      password: password
    }).pipe(
      catchError(this.handleError)
    );
  }
  
  logout(): Observable<any> {
    // Check if simulation mode is enabled
    if (this.simulationMode) {
      console.log('Using simulation mode for logout');
      
      // Just clear local storage and return success
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      this.isAuthenticated.next(false);
      this.router.navigate(['/login']);
      
      return of({ message: 'Logout successful' });
    }
    
    // Get the token before we clear storage
    const token = this.getToken();
    
    // Real logout with backend (invalidate token)
    return this.http.post<any>(`${this.apiUrl}/auth/logout/`, {}, {
      headers: {
        'Authorization': `Token ${token}`
      }
    }).pipe(
      tap(() => {
        // Clear local storage regardless of response
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.isAuthenticated.next(false);
        this.router.navigate(['/login']);
      }),
      catchError(error => {
        // Even if the backend logout fails, we still clear local storage
        console.error('Logout error:', error);
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.isAuthenticated.next(false);
        this.router.navigate(['/login']);
        return throwError(() => error);
      })
    );
  }
  
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  getUserData(): any {
    const userData = localStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }
  
  getCurrentUser(): any {
    return this.getUserData();
  }
  
  isAdmin(): boolean {
    const userData = this.getUserData();
    const isAdminUser = userData ? (userData.is_staff === true || userData.is_superuser === true) : false;
    
    // Check for Django superuser 'admin'
    if (userData && userData.username === 'admin') {
      return true;
    }

    // Check for Hospital IT Admin users (itguy or any user with IT Admin role)
    if (userData && (
      userData.username === 'itguy' || 
      userData.role === 'it_admin' || 
      userData.role === 'admin' ||
      (userData.profile && (userData.profile.role === 'it_admin' || userData.profile.role === 'admin'))
    )) {
      return true;
    }
    
    return isAdminUser;
  }
  
  isDoctor(): boolean {
    const userData = this.getUserData();
    if (!userData) return false;
    
    return userData.role === 'doctor' || 
           (userData.profile && userData.profile.role === 'doctor');
  }
  
  isNurse(): boolean {
    const userData = this.getUserData();
    if (!userData) return false;
    
    return userData.role === 'nurse' || 
           (userData.profile && userData.profile.role === 'nurse');
  }
  
  isMaintenance(): boolean {
    const userData = this.getUserData();
    if (!userData) return false;
    
    // DEBUG: Add logging to see what's being checked
    console.log('DEBUG - isMaintenance check:', {
      username: userData.username,
      role: userData.role,
      profileRole: userData.profile?.role,
      isMaintenanceByRole: userData.role === 'maintenance',
      isMaintenanceByProfileRole: userData.profile && userData.profile.role === 'maintenance'
    });
    
    return userData.role === 'maintenance' || 
           (userData.profile && userData.profile.role === 'maintenance');
  }
  
  isDoctorOrNurse(): boolean {
    return this.isDoctor() || this.isNurse();
  }
  
  /**
   * Check if user has any of the specified roles
   * @param roles Array of role names to check
   * @returns true if user has any of the roles
   */
  hasRole(roles: string[]): boolean {
    if (this.isAdmin()) return true; // Admin has access to all roles
    
    if (roles.includes('doctor') && this.isDoctor()) return true;
    if (roles.includes('nurse') && this.isNurse()) return true;
    if (roles.includes('maintenance') && this.isMaintenance()) return true;
    
    return false;
  }
  
  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
  
  isLoggedIn(): Observable<boolean> {
    return this.isAuthenticated.asObservable();
  }
  
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error && typeof error.error === 'object') {
        // Try to extract detailed error messages
        const serverErrors = Object.values(error.error).flat();
        if (serverErrors.length > 0) {
          errorMessage = serverErrors.join('. ');
        } else {
          errorMessage = `Error Code: ${error.status}. Message: ${error.message}`;
        }
      } else {
        errorMessage = `Error Code: ${error.status}. Message: ${error.message}`;
      }
    }
    
    console.error('Auth service error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
