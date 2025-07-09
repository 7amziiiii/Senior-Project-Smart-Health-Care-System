import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

/**
 * Interface for room scanning results
 */
export interface RoomScanResult {
  equipment_in_room: any[];
  unexpected_equipment: any[];
  missing_equipment: any[];
  last_scanned?: string;
  error?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EquipmentScannerService {
  private equipmentPoller: any = null;
  private scanResults = new BehaviorSubject<RoomScanResult | null>(null);
  private pollingActive = false;

  constructor(private http: HttpClient, private authService: AuthService) { }

  /**
   * Start polling for room equipment updates
   * @param roomId The room ID to scan
   * @param intervalMs Polling interval in milliseconds (default: 10000ms)
   * @param scanDuration Duration of each scan in seconds (default: 3s)
   */
  startRoomScanningPolling(roomId: string | null, intervalMs: number = 10000, scanDuration: number = 3): void {
    if (!roomId) {
      console.error('Cannot start room scanning: No room ID provided');
      return;
    }

    // Stop any existing polling
    this.stopRoomScanningPolling();

    try {
      // Validate room ID
      if (!roomId) {
        throw new Error('Invalid room ID');
      }

      // Create a new poller instance
      import('../utils/equipment-poller.js').then((module) => {
        // Access the default export correctly
        const EquipmentPoller = module.default;
        
        try {
          // Get authentication token to pass to the poller
          const token = this.authService.getToken() || ''; // Use empty string as fallback if token is null
          
          // We've already checked for null at the top of the method, but TypeScript needs reassurance
          const validRoomId = roomId as string; // Safe cast since we've already checked for null above
          this.equipmentPoller = new EquipmentPoller(validRoomId, intervalMs, token, scanDuration);

          // Register the update handler
          this.equipmentPoller.onUpdate((data: RoomScanResult | any) => {
            if (data) {
              // Add timestamp to track when scan happened
              data.last_scanned = new Date().toISOString();
              console.log('Received room scanning update:', data);
              this.scanResults.next(data);
            }
          });

          // Register error handler
          this.equipmentPoller.onError((error: any) => {
            console.error('Room scanning error:', error);
            const errorResult: RoomScanResult = {
              equipment_in_room: [],
              unexpected_equipment: [],
              missing_equipment: [],
              last_scanned: new Date().toISOString(),
              error: error
            };
            this.scanResults.next(errorResult);
          });

          // Start polling
          this.equipmentPoller.start();
          this.pollingActive = true;
          console.log(`Started room scanning polling for room ${roomId}`);

          // Setup visibility change handler
          document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        } catch (error) {
          console.error('Error initializing equipment poller:', error);
          this.fallbackToDirectScan(roomId);
        }
      }).catch(error => {
        console.error('Error importing equipment poller module:', error);
        this.fallbackToDirectScan(roomId);
      });
    } catch (error) {
      console.error('Error starting room scanning polling:', error);
      this.fallbackToDirectScan(roomId);
    }
  }

  /**
   * Stop polling for room scanning updates
   */
  stopRoomScanningPolling(): void {
    if (this.equipmentPoller) {
      this.equipmentPoller.stop();
      this.equipmentPoller.destroy();
      this.equipmentPoller = null;
      this.pollingActive = false;
      console.log('Stopped room scanning polling');
      
      // Remove visibility change handler
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  /**
   * Force an immediate room scan
   */
  forceScan(): void {
    if (this.equipmentPoller) {
      this.equipmentPoller.forceScan();
      console.log('Forced room scanning update');
    }
  }

  /**
   * Get the room scan results as an Observable
   */
  getRoomScanResults(): Observable<RoomScanResult | null> {
    return this.scanResults.asObservable();
  }

  /**
   * Handle page visibility changes to optimize polling
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.equipmentPoller && this.pollingActive) {
        this.equipmentPoller.stop();
        console.log('Paused room scanning polling due to page hidden');
      }
    } else if (this.equipmentPoller && !this.pollingActive) {
      this.equipmentPoller.start();
      this.pollingActive = true;
      console.log('Resumed room scanning polling due to page visible');
    }
  }

  /**
   * Fallback method to fetch room scan status directly
   */
  private fallbackToDirectScan(roomId: string): void {
    console.log('Falling back to direct API call for room scanning');
    this.scanRoomDirect(roomId);
  }

  /**
   * Fallback method to scan room directly via HTTP
   * Used if the poller script is not available
   */
  private scanRoomDirect(roomId: string): void {
    const url = `${environment.apiUrl}/equipment/scan-room/`;
    
    // Get authentication token from AuthService
    const token = this.authService.getToken();
    
    // Create headers with authentication token
    const headers = new HttpHeaders({
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    });
    
    // Include both token and session credentials
    this.http.post<RoomScanResult>(url, 
      { room_id: roomId, scan_duration: 3 },
      {
        headers: headers,
        withCredentials: true // This enables sending cookies with cross-origin requests
      }
    ).subscribe({
      next: (data) => {
        console.log('Scanned room directly:', data);
        data.last_scanned = new Date().toISOString();
        this.scanResults.next(data);
      },
      error: (error) => {
        console.error('Error scanning room:', error);
        
        // If we get a 401 error, it means authentication failed
        if (error.status === 401) {
          console.error('Authentication failed. Please log in again.');
          // You could redirect to login page or show a notification here
        }
        
        const errorResult: RoomScanResult = {
          equipment_in_room: [],
          unexpected_equipment: [],
          missing_equipment: [],
          last_scanned: new Date().toISOString(),
          error: error
        };
        this.scanResults.next(errorResult);
      }
    });
  }
}
