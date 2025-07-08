import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RFIDTag {
  id: number;
  tag_id: string;
  status: string;
  last_detected_by?: any;
  last_detection_time?: string;
  created_at: string;
  updated_at: string;
  last_known_location?: string;
}

export interface Asset {
  id: number;
  name: string;
  status: string;
  [key: string]: any; // Allow for other properties specific to each asset type
}

export interface RFIDScanResponse {
  message: string;
  tag: RFIDTag;
  exists: boolean;
  is_linked?: boolean;
  asset_type?: 'instrument' | 'tray' | 'large_equipment';
  asset?: Asset;
}

@Injectable({
  providedIn: 'root'
})
export class RFIDTagService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Scan for RFID tags and register a new one or retrieve an existing one
   * @param scanDuration Duration to scan for in seconds
   * @param port Optional COM port for the reader
   * @param baudRate Optional baud rate for the reader
   * @returns Observable with the scan response
   */
  scanAndRegisterTag(scanDuration: number = 3, port: string = '', baudRate: number = 0): Observable<RFIDScanResponse> {
    const url = `${this.apiUrl}/rfid-tags/scan/`;
    const data = {
      scan_duration: scanDuration,
      port: port,
      baud_rate: baudRate
    };

    console.log(`Making RFID tag scan request to: ${url}`);
    
    return this.http.post<RFIDScanResponse>(url, data).pipe(
      timeout(30000), // 30 second timeout
      catchError(error => {
        let errorMessage = 'Unknown error';
        if (error.name === 'TimeoutError') {
          errorMessage = 'Request timed out after 30 seconds. RFID scanner may not be responding.';
        } else if (error.status) {
          errorMessage = `Server error ${error.status}: ${error.statusText}`;
        } else if (error.message) {
          errorMessage = error.message;
        }
        return throwError(() => new Error(`RFID tag scan failed: ${errorMessage}`));
      })
    );
  }

  /**
   * Get all RFID tags
   * @returns Observable with array of RFID tags
   */
  getAllTags(): Observable<RFIDTag[]> {
    return this.http.get<RFIDTag[]>(`${this.apiUrl}/rfid-tags/`).pipe(
      catchError(error => {
        return throwError(() => new Error(`Failed to get RFID tags: ${error.message}`));
      })
    );
  }

  /**
   * Get a specific RFID tag by ID
   * @param id RFID tag ID
   * @returns Observable with RFID tag data
   */
  getTag(id: number): Observable<RFIDTag> {
    return this.http.get<RFIDTag>(`${this.apiUrl}/rfid-tags/${id}/`).pipe(
      catchError(error => {
        return throwError(() => new Error(`Failed to get RFID tag: ${error.message}`));
      })
    );
  }
}
