import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

// Import the VerificationPoller class
declare const VerificationPoller: any;

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
}

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private verificationPoller: any = null;
  private verificationStatus = new BehaviorSubject<VerificationStatus | null>(null);
  private pollingActive = false;

  constructor(private http: HttpClient) { }

  /**
   * Start polling for verification status updates
   * @param sessionId The operation session ID
   * @param updateInterval Polling interval in milliseconds (default: 5000ms)
   */
  startVerificationPolling(sessionId: number, updateInterval: number = 5000): void {
    // Stop any existing polling
    this.stopVerificationPolling();

    try {
      // Create a new poller instance
      this.verificationPoller = new VerificationPoller(sessionId, updateInterval);

      // Register the update handler
      this.verificationPoller.onUpdate((data: VerificationStatus) => {
        console.log('Received verification update:', data);
        this.verificationStatus.next(data);
      });

      // Start polling
      this.verificationPoller.start();
      this.pollingActive = true;
      console.log(`Started verification polling for session ${sessionId}`);

      // Setup visibility change handler
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    } catch (error) {
      console.error('Error starting verification polling:', error);
      
      // Fallback to REST API direct call if poller isn't available
      this.fetchVerificationStatusDirect(sessionId);
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
   * Fallback method to fetch verification status directly via HTTP
   * Used if the poller script is not available
   */
  private fetchVerificationStatusDirect(sessionId: number): void {
    const url = `${environment.apiUrl}/api/verification/${sessionId}/status/`;
    
    this.http.get<VerificationStatus>(url)
      .subscribe({
        next: (data) => {
          console.log('Fetched verification status directly:', data);
          this.verificationStatus.next(data);
        },
        error: (error) => {
          console.error('Error fetching verification status:', error);
        }
      });
  }
}
