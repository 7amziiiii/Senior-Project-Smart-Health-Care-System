import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    
    // Skip adding auth header for login and register requests
    const isAuthRequest = request.url.includes('/auth/login/') || request.url.includes('/auth/register/');
    
    if (token && !isAuthRequest) {
      // Add debug logging
      console.log(`Adding token to request: ${request.url}`);
      
      // Clone the request and add the authorization header with token
      // Ensure format is exactly 'Token <token>' as Django REST expects
      const authReq = request.clone({
        headers: request.headers.set('Authorization', `Token ${token}`)
      });
      return next.handle(authReq);
    }
    
    // Log requests without tokens
    if (!isAuthRequest) {
      console.log(`Request without token: ${request.url}`);
    }
    
    return next.handle(request);
  }
}
