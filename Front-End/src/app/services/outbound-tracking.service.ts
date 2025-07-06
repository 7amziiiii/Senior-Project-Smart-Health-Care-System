import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface OutboundTrackingResponse {
  session_id: number;
  room_cleared: boolean;
  remaining_items: {
    instruments: any[];
    trays: any[];
  };
  used_items: {
    instruments: any[];
    trays: any[];
  };
  scan_timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OutboundTrackingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Start a scan for outbound tracking for the given operation session
   * @param sessionId Operation session ID
   * @param scanDuration Optional scan duration in seconds (default is 3 seconds)
   */
  scanOutbound(sessionId: number, scanDuration: number = 3): Observable<OutboundTrackingResponse> {
    const url = `${this.apiUrl}/operation-sessions/${sessionId}/outbound-tracking/`;
    const payload = { scan_duration: scanDuration };

    return this.http.post<OutboundTrackingResponse>(url, payload).pipe(
      map(response => this.transformResponse(response)),
      catchError(error => {
        console.error('Outbound tracking scan error:', error);
        return throwError(() => new Error(`Outbound tracking scan failed: ${error.message}`));
      })
    );
  }

  /**
   * Get the current status of outbound tracking for an operation session
   * @param sessionId Operation session ID
   */
  getOutboundStatus(sessionId: number): Observable<OutboundTrackingResponse> {
    const url = `${this.apiUrl}/operation-sessions/${sessionId}/outbound-tracking/`;
    
    return this.http.get<OutboundTrackingResponse>(url).pipe(
      map(response => this.transformResponse(response)),
      catchError(error => {
        console.error('Outbound status error:', error);
        return throwError(() => new Error(`Failed to get outbound status: ${error.message}`));
      })
    );
  }

  /**
   * Transform the backend response to match frontend structure
   */
  private transformResponse(response: any): OutboundTrackingResponse {
    // Ensure the response has the expected structure
    return {
      session_id: response.session_id || response.id,
      room_cleared: response.room_cleared || false,
      remaining_items: response.remaining_items || { instruments: [], trays: [] },
      used_items: response.used_items || { instruments: [], trays: [] },
      scan_timestamp: response.scan_timestamp
    };
  }
}
