import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import VerificationPoller from '../utils/verification-poller.js';

export interface VerificationStatus {
  verification_id: number;
  state: 'complete' | 'incomplete' | 'failed';
  used_items: {
    instruments: Record<string, number>;
    trays: Record<string, number>;
  };
  missing_items: {
    instruments: Record<string, number>;
    trays: Record<string, number>;
  };
  extra_items: {
    instruments: Record<string, number>;
    trays: Record<string, number>;
  };
  available_items: {
    instruments: Record<string, number>;
    trays: Record<string, number>;
  };
  available_matches: {
    instruments: Record<string, number>;
    trays: Record<string, number>;
  };
  last_updated: string;
  error?: any;
}

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private verificationPoller: any = null;
  private verificationStatus = new BehaviorSubject<VerificationStatus | null>(null);
  private pollingActive = false;

  constructor(private http: HttpClient, private authService: AuthService) { }

  /**
   * Start polling for verification status updates
   * @param sessionId The operation session ID
   * @param updateInterval Polling interval in milliseconds (default: 5000ms)
   */
  startVerificationPolling(sessionId: number, updateInterval: number = 5000): void {
    // Stop any existing polling
    this.stopVerificationPolling();

    try {
      // Validate session ID
      if (!sessionId || isNaN(sessionId) || sessionId <= 0) {
        throw new Error('Invalid operation session ID');
      }

      // Create a new poller instance
      import('../utils/verification-poller.js').then((module) => {
        // Access the default export correctly
        const VerificationPoller = module.default;
        
        try {
          // Get authentication token to pass to the poller
          const token = this.authService.getToken();
          
          this.verificationPoller = new VerificationPoller(sessionId, updateInterval, token);

          // Register the update handler
          this.verificationPoller.onUpdate((data: VerificationStatus | any) => {
            // Check if we received an error message
            if (data.error) {
              console.error('Verification error:', data);
              // Push error to status subject
              this.verificationStatus.next({
                verification_id: sessionId,
                state: 'failed',
                used_items: { instruments: {}, trays: {} },
                missing_items: { instruments: {}, trays: {} },
                extra_items: { instruments: {}, trays: {} },
                available_items: { instruments: {}, trays: {} },
                available_matches: { instruments: {}, trays: {} },
                last_updated: new Date().toISOString(),
                error: data.error
              });
            } else {
              console.log('Received verification update:', data);
              this.verificationStatus.next(data);
            }
          });

          // Start polling
          this.verificationPoller.start();
          this.pollingActive = true;
          console.log(`Started verification polling for session ${sessionId}`);

          // Setup visibility change handler
          document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        } catch (error) {
          console.error('Error initializing verification poller:', error);
          this.fallbackToDirectFetch(sessionId);
        }
      }).catch(error => {
        console.error('Error importing verification poller module:', error);
        this.fallbackToDirectFetch(sessionId);
      });
    } catch (error) {
      console.error('Error starting verification polling:', error);
      this.fallbackToDirectFetch(sessionId);
    }
  }

  /**
   * Stop polling for verification status updates
   */
  stopVerificationPolling(): void {
    if (this.verificationPoller) {
      this.verificationPoller.stop();
      this.verificationPoller = null;
      this.pollingActive = false;
      console.log('Stopped verification polling');
      
      // Remove visibility change handler
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  /**
   * Force an immediate verification update with scanning
   */
  forceUpdate(): void {
    if (this.verificationPoller) {
      this.verificationPoller.forceUpdate();
      console.log('Forced verification update with scanning');
    }
  }

  /**
   * Get the verification status as an Observable
   */
  getVerificationStatus(): Observable<VerificationStatus | null> {
    return this.verificationStatus.asObservable();
  }

  /**
   * Handle page visibility changes to optimize polling
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.verificationPoller && this.pollingActive) {
        this.verificationPoller.stop();
        console.log('Paused verification polling due to page hidden');
      }
    } else if (this.verificationPoller && !this.pollingActive) {
      this.verificationPoller.start();
      this.pollingActive = true;
      console.log('Resumed verification polling due to page visible');
    }
  }

  /**
   * Fallback method to fetch verification status directly
   */
  private fallbackToDirectFetch(sessionId: number): void {
    console.log('Falling back to direct API call for verification status');
    this.fetchVerificationStatusDirect(sessionId);
  }

  /**
   * Fallback method to fetch verification status directly via HTTP
   * Used if the poller script is not available
   */
  private fetchVerificationStatusDirect(sessionId: number): void {
    const url = `${environment.apiUrl}/verification/${sessionId}/status/`;
    
    // Get authentication token from AuthService
    const token = this.authService.getToken();
    
    // Create headers with authentication token
    const headers = new HttpHeaders({
      'Authorization': `Token ${token}`,
      'X-Requested-With': 'XMLHttpRequest'
    });
    
    // Include both token and session credentials
    this.http.get<VerificationStatus>(url, {
      headers: headers,
      withCredentials: true // This enables sending cookies with cross-origin requests
    })
      .subscribe({
        next: (data) => {
          console.log('Fetched verification status directly:', data);
          this.verificationStatus.next(data);
        },
        error: (error) => {
          console.error('Error fetching verification status:', error);
          
          // If we get a 401 error, it means authentication failed
          if (error.status === 401) {
            console.error('Authentication failed. Please log in again.');
            // You could redirect to login page or show a notification here
          }
        }
      });
  }
}
