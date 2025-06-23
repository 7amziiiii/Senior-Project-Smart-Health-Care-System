import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private apiUrl = 'http://localhost:8000/api'; // Django backend URL (will be implemented later)
  private isAuthenticated = new BehaviorSubject<boolean>(this.hasToken());
  
  constructor(private http: HttpClient, private router: Router) {}
  
  login(username: string, password: string): Observable<any> {
    // For now, we'll simulate a successful login
    // Later, this will be replaced with actual API call
    return of({ token: 'sample-token-' + Date.now() })
      .pipe(
        tap(response => {
          if (response && response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
            this.isAuthenticated.next(true);
          }
        })
      );
      
    // Actual implementation for later
    // return this.http.post<any>(`${this.apiUrl}/auth/login/`, { username, password })
    //   .pipe(
    //     tap(response => {
    //       if (response && response.token) {
    //         localStorage.setItem(this.TOKEN_KEY, response.token);
    //         this.isAuthenticated.next(true);
    //       }
    //     })
    //   );
  }
  
  register(firstName: string, lastName: string, email: string, username: string, role: string, password: string): Observable<any> {
    // Simulate API call - replace with real HTTP request later
    return new Observable(observer => {
      setTimeout(() => {
        // Simulate successful registration
        console.log('Simulated registration:', { firstName, lastName, email, username, role });
        observer.next({ message: 'Registration successful' });
        observer.complete();
      }, 1000);
    });
  }
  
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.isAuthenticated.next(false);
    this.router.navigate(['/login']);
  }
  
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
  
  isLoggedIn(): Observable<boolean> {
    return this.isAuthenticated.asObservable();
  }
}
