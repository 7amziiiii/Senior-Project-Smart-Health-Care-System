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
  private simulationMode = false; // Set to false to use real backend
  
  constructor(private http: HttpClient, private router: Router) {}
  
  login(username: string, password: string): Observable<any> {
    // Use simulation mode for testing without a backend
    if (this.simulationMode) {
      console.log('Using simulation mode for login');
      return of({ token: 'simulated-token-' + Date.now(), username: username })
        .pipe(
          tap(response => {
            localStorage.setItem(this.TOKEN_KEY, response.token);
            localStorage.setItem(this.USER_KEY, JSON.stringify({ username: response.username }));
            this.isAuthenticated.next(true);
          })
        );
    }
    
    // Real backend implementation
    return this.http.post<any>(`${this.apiUrl}/auth/login/`, { username, password })
      .pipe(
        tap(response => {
          if (response && response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
            localStorage.setItem(this.USER_KEY, JSON.stringify({ username: response.username }));
            this.isAuthenticated.next(true);
          }
        }),
        catchError(this.handleError)
      );
  }
  
  register(firstName: string, lastName: string, email: string, username: string, role: string, password: string): Observable<any> {
    // Use simulation mode for testing without a backend
    if (this.simulationMode) {
      console.log('Using simulation mode for registration', { firstName, lastName, email, username, role });
      return of({ 
        message: 'Registration successful. Account pending admin approval.', 
        username: username, 
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: role,
        is_active: false
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
    // Use simulation mode for testing without a backend
    if (this.simulationMode) {
      console.log('Using simulation mode for logout');
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
