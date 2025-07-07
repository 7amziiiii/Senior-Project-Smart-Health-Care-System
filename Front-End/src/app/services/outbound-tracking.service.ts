import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface OutboundTrackingResponse {
  operation_session_id: number;
  outbound_check_id: number;
  room_cleared: boolean;
  check_time: string;
  remaining_items: {
    instruments: { [key: string]: OutboundItem };
    trays: { [key: string]: OutboundItem };
  };
  extra_items: {
    instruments: { [key: string]: OutboundItem };
    trays: { [key: string]: OutboundItem };
  };
  used_items: {
    instruments: any[];
    trays: any[];
  };
  scan_time: string;
  scan_history?: {
    timestamp: string;
    found_instrument_count: number;
    found_tray_count: number;
  };
}

export interface OutboundItem {
  id: number;
  name: string;
  serial_number: string;
  category?: string;
  found_at: string;
  last_seen?: string;
  missing_since?: string;
  currently_present?: boolean;
  scan_count?: number;
  rfid_tag?: string;
  quantity?: number;
  ids?: number[];
  type?: string; // instrument or tray
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
    const url = `${this.apiUrl}/outbound-tracking/${sessionId}/status/`;
    const params = { scan_duration: scanDuration.toString() };
    console.log(`Making outbound tracking scan request to: ${url}`);

    return this.http.get<OutboundTrackingResponse>(url, { 
      params,
      headers: {'Content-Type': 'application/json'}
    }).pipe(
      // Add timeout to prevent hanging requests (30 seconds)
      timeout(30000),
      map(response => {
        console.log('Received outbound tracking scan response:', response);
        return this.transformResponse(response);
      }),
      catchError(error => {
        console.error('Outbound tracking scan error:', error);
        // Provide more specific error info based on the error type
        let errorMessage = 'Unknown error';
        if (error instanceof TimeoutError) {
          errorMessage = 'Request timed out after 30 seconds. RFID scanner may not be responding.';
        } else if (error.status) {
          errorMessage = `Server error ${error.status}: ${error.statusText}`;
        } else if (error.message) {
          errorMessage = error.message;
        }
        return throwError(() => new Error(`Outbound tracking scan failed: ${errorMessage}`));
      })
    );
  }

  /**
   * Get the current status of outbound tracking for an operation session
   * @param sessionId Operation session ID
   */
  getOutboundStatus(sessionId: number): Observable<OutboundTrackingResponse> {
    const url = `${this.apiUrl}/outbound-tracking/${sessionId}/status/`;
    console.log(`Making outbound status request to: ${url}`);
    
    return this.http.get<OutboundTrackingResponse>(url, {
      headers: {'Content-Type': 'application/json'}
    }).pipe(
      // Add timeout to prevent hanging requests (30 seconds)
      timeout(30000),
      map(response => {
        console.log('Received outbound status response:', response);
        return this.transformResponse(response);
      }),
      catchError(error => {
        console.error('Outbound status error:', error);
        // Provide more specific error info based on the error type
        let errorMessage = 'Unknown error';
        if (error instanceof TimeoutError) {
          errorMessage = 'Request timed out after 30 seconds. RFID scanner may not be responding.';
        } else if (error.status) {
          errorMessage = `Server error ${error.status}: ${error.statusText}`;
        } else if (error.message) {
          errorMessage = error.message;
        }
        return throwError(() => new Error(`Failed to get outbound status: ${errorMessage}`));
      })
    );
  }

  /**
   * Transform the backend response to match frontend structure
   */
  private transformResponse(response: any): OutboundTrackingResponse {
    // Ensure the response has the expected structure
    return {
      operation_session_id: response.operation_session_id || response.id,
      outbound_check_id: response.outbound_check_id || 0,
      room_cleared: response.room_cleared || false,
      check_time: response.check_time || new Date().toISOString(),
      remaining_items: response.remaining_items || { instruments: {}, trays: {} },
      extra_items: response.extra_items || { instruments: {}, trays: {} },
      used_items: response.used_items || { instruments: [], trays: [] },
      scan_time: response.scan_time || new Date().toISOString(),
      scan_history: response.scan_history || {
        timestamp: new Date().toISOString(),
        found_instrument_count: 0,
        found_tray_count: 0
      }
    };
  }
}
