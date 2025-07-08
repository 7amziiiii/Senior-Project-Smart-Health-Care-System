import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// SystemLog interface matching the backend structure
export interface SystemLog {
  id?: number;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  status: 'complete' | 'pending' | 'issue';
  logType: 'verification' | 'outbound' | 'system';
}

@Injectable({
  providedIn: 'root'
})
export class SystemLogsService {
  private apiUrl = `${environment.apiUrl}/system-logs`;

  constructor(private http: HttpClient) { }

  /**
   * Get all system logs from all sources
   */
  getAllLogs(): Observable<SystemLog[]> {
    return this.http.get<SystemLog[]>(`${this.apiUrl}/all/`)
      .pipe(
        tap(_ => console.log('Fetched all system logs')),
        catchError(this.handleError<SystemLog[]>('getAllLogs', []))
      );
  }

  /**
   * Get verification session logs
   */
  getVerificationLogs(): Observable<SystemLog[]> {
    return this.http.get<SystemLog[]>(`${this.apiUrl}/verification-logs/`)
      .pipe(
        tap(_ => console.log('Fetched verification logs')),
        catchError(this.handleError<SystemLog[]>('getVerificationLogs', []))
      );
  }

  /**
   * Get outbound tracking logs
   */
  getOutboundLogs(): Observable<SystemLog[]> {
    return this.http.get<SystemLog[]>(`${this.apiUrl}/outbound-logs/`)
      .pipe(
        tap(_ => console.log('Fetched outbound tracking logs')),
        catchError(this.handleError<SystemLog[]>('getOutboundLogs', []))
      );
  }

  /**
   * Get equipment request logs
   */
  getEquipmentRequestLogs(): Observable<SystemLog[]> {
    return this.http.get<SystemLog[]>(`${this.apiUrl}/equipment-request-logs/`)
      .pipe(
        tap(_ => console.log('Fetched equipment request logs')),
        catchError(this.handleError<SystemLog[]>('getEquipmentRequestLogs', []))
      );
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      // Return empty result so the app keeps running
      return of(result as T);
    };
  }
}
