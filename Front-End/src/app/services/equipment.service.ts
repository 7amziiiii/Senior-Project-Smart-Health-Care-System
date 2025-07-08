import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError, map, tap, throwError } from 'rxjs';
import { LargeEquipment, EquipmentRequest, SurgeryEquipment } from '../models/large-equipment.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EquipmentService {
  // API endpoints
  private apiUrl = environment.apiUrl;
  private equipmentUrl = `${this.apiUrl}/equipment`;
  private largeEquipmentUrl = `${this.apiUrl}/large-equipment`;
  private equipmentRequestsUrl = `${this.apiUrl}/equipment-requests`;
  private scanRoomUrl = `${this.apiUrl}/equipment/scan-room/`;
  
  // Track equipment requests locally for real-time updates
  private equipmentRequestsSubject = new BehaviorSubject<EquipmentRequest[]>([]);

  constructor(private http: HttpClient) {
    // Initially load equipment requests
    this.loadEquipmentRequests();
  }
  
  /**
   * Load equipment requests from API
   * @param forceRefresh Whether to force a refresh of the data
   * @returns Observable of the requests for optional chaining
   */
  public loadEquipmentRequests(forceRefresh: boolean = false): Observable<EquipmentRequest[]> {
    console.log('Loading equipment requests from API, forceRefresh:', forceRefresh);
    
    // Create an observable we can return
    return this.http.get<EquipmentRequest[]>(`${this.equipmentRequestsUrl}/`)
      .pipe(
        tap(requests => {
          console.log(`Received ${requests.length} equipment requests from API`);
          // Update our subject with the latest data
          this.equipmentRequestsSubject.next(requests);
        }),
        catchError(error => {
          console.error('Error loading equipment requests:', error);
          // Don't update the subject on error, just return empty array
          return of([]);
        })
      );
  }

  /**
   * Get all large equipment
   */
  getLargeEquipment(): Observable<LargeEquipment[]> {
    return this.http.get<LargeEquipment[]>(`${this.largeEquipmentUrl}/`)
      .pipe(
        map(equipment => equipment.map(item => ({
          ...item,
          isAvailable: item.status === 'available'
        }))),
        catchError(error => {
          console.error('Error loading large equipment:', error);
          return of([]);
        })
      );
  }

  /**
   * Get available equipment for a specific operation date and/or type
   */
  getAvailableEquipment(operationDate?: string, operationType?: string): Observable<LargeEquipment[]> {
    let params = new HttpParams();
    
    if (operationDate) {
      params = params.append('operation_date', operationDate);
    }
    
    if (operationType) {
      params = params.append('operation_type', operationType);
    }
    
    return this.http.get<LargeEquipment[]>(`${this.equipmentRequestsUrl}/available/`, { params })
      .pipe(
        map(equipment => equipment.map(item => ({
          ...item,
          isAvailable: true // All returned equipment should be available
        }))),
        catchError(error => {
          console.error('Error loading available equipment:', error);
          return of([]);
        })
      );
  }

  /**
   * Get equipment needed for a specific operation session
   */
  getOperationSessionEquipment(sessionId: number): Observable<SurgeryEquipment[]> {
    return this.http.get<SurgeryEquipment[]>(`${this.apiUrl}/operation-sessions/${sessionId}/equipment/`)
      .pipe(
        map(equipmentList => {
          // Ensure isAvailable is set based on equipment status
          return equipmentList.map(item => ({
            ...item,
            isAvailable: item.equipment && item.equipment.status === 'available'
          }));
        }),
        tap(equipmentList => {
          console.log('Operation session equipment with availability:', equipmentList);
        }),
        catchError(error => {
          console.error(`Error loading equipment for operation session ${sessionId}:`, error);
          return of([]);
        })
      );
  }

  /**
   * Request equipment for an operation session
   */
  requestEquipment(operationSessionId: number, equipmentId: number): Observable<EquipmentRequest> {
    console.log(`Requesting equipment ${equipmentId} for operation session ${operationSessionId}`);
    
    const requestData = {
      equipment: equipmentId,
      operation_session: operationSessionId
    };
    
    // Use the correct endpoint based on the backend router configuration
    // The router registers 'equipment-requests' directly under the API root, not under /equipment/
    return this.http.post<any>(`${environment.apiUrl}/equipment-requests/`, requestData)
      .pipe(
        map(response => {
          // Log the complete response for debugging
          console.log('Equipment request raw response:', JSON.stringify(response));
          
          // Handle the new response structure that contains request, message, and equipment_status
          if (response && response.request) {
            // Add the equipment_status to the request object so components can access it
            const request = response.request;
            request.equipment_status = response.equipment_status;
            return request;
          } else if (response && typeof response === 'object') {
            // Assuming the response is the request object itself
            // Set default status if missing
            if (!response.status) {
              response.status = 'requested';
            }
            return response;
          }
          
          // Fall back to a minimal valid object if response format is unexpected
          console.warn('Unexpected response format:', response);
          return {
            id: Math.floor(Math.random() * 10000), // Temporary ID for UI purposes
            equipment: equipmentId,
            operation_session: operationSessionId,
            status: 'requested',
            requested_at: new Date().toISOString()
          };
        }),
        tap(request => {
          console.log('Equipment request processed:', request);
          
          // Update our local subject with the new request
          // First remove any existing request for the same equipment/session if present
          let currentRequests = this.equipmentRequestsSubject.value;
          currentRequests = currentRequests.filter(req => 
            !(req.equipment?.id === equipmentId && req.operation_session === operationSessionId));
          
          // Then add the new request
          this.equipmentRequestsSubject.next([...currentRequests, request]);
          
          // Force a refresh to sync with backend
          this.loadEquipmentRequests(true).subscribe(() => {
            console.log('Equipment requests reloaded after new request');
          });
        }),
        catchError(error => {
          console.error('Error requesting equipment:', error);
          console.error('Error details:', error.error);
          console.error('Status:', error.status);
          console.error('Status text:', error.statusText);
          console.error('URL:', error.url);
          throw error; // Rethrow to allow handling in components
        })
      );
  }

  /**
   * Get all equipment requests
   * @param forceRefresh Whether to force a fresh API call (default: true)
   * @returns Observable of equipment requests
   */
  getEquipmentRequests(forceRefresh: boolean = true): Observable<EquipmentRequest[]> {
    console.log('Getting equipment requests, forceRefresh:', forceRefresh);
    
    if (forceRefresh) {
      // If we want to refresh, make the API call and return that observable directly
      // This ensures we always get fresh data from the server
      console.log('Forcing refresh from API for equipment requests');
      return this.loadEquipmentRequests(true);
    } else {
      // Check if we have any requests in the subject already
      const currentRequests = this.equipmentRequestsSubject.getValue();
      
      if (currentRequests && currentRequests.length > 0) {
        console.log(`Returning ${currentRequests.length} cached equipment requests`);
        return of(currentRequests);
      } else {
        // If no cached requests, still do a refresh
        console.log('No cached requests available, loading from API');
        return this.loadEquipmentRequests(true);
      }
    }
  }

  /**
   * Get pending equipment requests
   */
  getPendingRequests(): Observable<EquipmentRequest[]> {
    // Using the correct backend endpoint for pending requests
    return this.http.get<EquipmentRequest[]>(`${environment.apiUrl}/equipment-requests/`)
      .pipe(
        tap(requests => {
          console.log(`Loaded ${requests.length} equipment requests`);
          
          // Group requests by status for better debugging
          if (requests && requests.length > 0) {
            const statusGroups: {[key: string]: number} = {};
            requests.forEach(req => {
              if (!statusGroups[req.status]) statusGroups[req.status] = 0;
              statusGroups[req.status]++;
            });
            
            console.log('Requests by status:', statusGroups);
            console.log('Sample requests:', requests.slice(0, 3));
          } else {
            console.log('No equipment requests found');
          }
        }),
        catchError(error => {
          console.error('Error loading requests:', error);
          return of([]);
        })
      );
  }

  /**
   * Get equipment currently in use
   */
  getEquipmentInUse(): Observable<EquipmentRequest[]> {
    return this.http.get<EquipmentRequest[]>(`${this.equipmentRequestsUrl}/in-use/`)
      .pipe(
        catchError(error => {
          console.error('Error loading equipment in use:', error);
          return of([]);
        })
      );
  }

  /**
   * Approve an equipment request
   */
  approveRequest(requestId: number): Observable<EquipmentRequest> {
    return this.http.post<EquipmentRequest>(`${this.equipmentRequestsUrl}/${requestId}/approve/`, {})
      .pipe(
        tap(() => this.loadEquipmentRequests()), // Reload all requests after approval
        catchError(error => {
          console.error(`Error approving request ${requestId}:`, error);
          throw error;
        })
      );
  }

  /**
   * Reject an equipment request
   */
  rejectRequest(requestId: number, reason?: string): Observable<any> {
    const requestData = reason ? { reason } : {};
    
    return this.http.post(`${this.equipmentRequestsUrl}/${requestId}/reject/`, requestData)
      .pipe(
        tap(() => this.loadEquipmentRequests()), // Reload all requests after rejection
        catchError(error => {
          console.error(`Error rejecting request ${requestId}:`, error);
          throw error;
        })
      );
  }

  /**
   * Mark equipment as returned
   */
  returnEquipment(requestId: number): Observable<EquipmentRequest> {
    return this.http.post<EquipmentRequest>(`${this.equipmentRequestsUrl}/${requestId}/return/`, {})
      .pipe(
        tap(() => this.loadEquipmentRequests()), // Reload all requests after return
        catchError(error => {
          console.error(`Error returning equipment for request ${requestId}:`, error);
          throw error;
        })
      );
  }

  /**
   * Mark equipment for maintenance
   */
  markForMaintenance(requestId: number, maintenanceType: string): Observable<EquipmentRequest> {
    return this.http.post<EquipmentRequest>(
      `${this.equipmentRequestsUrl}/${requestId}/maintenance/`, 
      { maintenance_type: maintenanceType }
    ).pipe(
      tap(() => this.loadEquipmentRequests()), // Reload all requests after maintenance mark
      catchError(error => {
        console.error(`Error marking request ${requestId} for maintenance:`, error);
        throw error;
      })
    );
  }

  /**
   * Complete maintenance for equipment
   */
  completeMaintenance(requestId: number, notes?: string): Observable<any> {
    const requestData = notes ? { notes } : {};
    
    return this.http.post(`${this.equipmentRequestsUrl}/${requestId}/complete-maintenance/`, requestData)
      .pipe(
        tap(() => this.loadEquipmentRequests()), // Reload all requests after maintenance completion
        catchError(error => {
          console.error(`Error completing maintenance for request ${requestId}:`, error);
          throw error;
        })
      );
  }
  
  /**
   * Fulfill an equipment request (mark as in_use)
   */
  fulfillRequest(requestId: number): Observable<EquipmentRequest> {
    return this.http.post<EquipmentRequest>(`${this.equipmentRequestsUrl}/${requestId}/fulfill/`, {})
      .pipe(
        tap(() => this.loadEquipmentRequests()), // Reload all requests after fulfillment
        catchError(error => {
          console.error(`Error fulfilling request ${requestId}:`, error);
          throw error;
        })
      );
  }

  /**
   * Scan a room for equipment using RFID technology
   * @param roomId ID or name of the room to scan
   * @param scanDuration Duration of the scan in seconds (default: 3)
   * @returns Observable with equipment found in the room
   */
  scanRoom(roomId: string, scanDuration: number = 3): Observable<any> {
    console.log(`Scanning room ${roomId} for equipment...`);
    
    return this.http.post<any>(this.scanRoomUrl, {
      room_id: roomId,
      scan_duration: scanDuration
    }).pipe(
      tap(results => {
        console.log('Room scan results:', results);
      }),
      catchError(error => {
        console.error('Error scanning room:', error);
        return of({ 
          equipment_in_room: [], 
          unexpected_equipment: [], 
          missing_equipment: [] 
        });
      })
    );
  }
  
  /**
   * Get consolidated equipment overview for the dashboard
   * @returns Observable with equipment overview data
   */
  getEquipmentOverview(): Observable<any[]> {
    const overviewUrl = `${this.equipmentUrl}/overview/`;
    console.log('Calling equipment overview endpoint:', overviewUrl);
    
    return this.http.get<any[]>(overviewUrl).pipe(
      tap(overview => {
        console.log('Equipment overview loaded:', overview);
        console.log('Number of equipment items returned:', Array.isArray(overview) ? overview.length : 'Not an array');
        if (Array.isArray(overview) && overview.length === 0) {
          console.warn('Equipment overview returned empty array from backend');
        }
      }),
      catchError(error => {
        console.error('Error loading equipment overview:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        if (error.error) {
          console.error('Server error details:', error.error);
        }
        return of([]);
      })
    );
  }
  
  /**
   * Update notes for a specific piece of equipment
   * @param equipmentId ID of the equipment to update
   * @param notes New notes to save
   * @returns Observable with update response
   */
  updateEquipmentNotes(equipmentId: number, notes: string): Observable<any> {
    const url = `${this.equipmentUrl}/${equipmentId}/update-notes/`;
    console.log(`Updating notes for equipment ${equipmentId}:`, notes);
    
    return this.http.post<any>(url, { notes }).pipe(
      tap(response => {
        console.log('Equipment notes updated:', response);
      }),
      catchError(error => {
        console.error('Error updating equipment notes:', error);
        return throwError(() => new Error(`Failed to update equipment notes: ${error.message}`));
      })
    );
  }
}
