import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, delay, tap, catchError } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Instrument {
  id: number;
  name: string;
  inRoom: boolean;
}

export interface Surgery {
  id: number;
  name: string;
  description: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  scheduledTime: string;
  roomNumber: string;
  requiredInstruments: Instrument[];
  patient_name?: string;
  state?: string;
  state_display?: string;
}

// Define the possible operation states from the backend
type OperationSessionState = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string;

// Define interface for API response
interface OperationSession {
  id: number;
  operation_type: {
    id: number;
    name: string;
    description: string;
  } | number | string;
  operation_room: {
    id: number;
    name: string;
  } | number | string;
  scheduled_time: string;
  state: OperationSessionState;
  state_display?: string;
  users?: Array<{
    id: number;
    username: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class SurgeryDataService {
  private surgeriesSubject = new BehaviorSubject<Surgery[]>([]);
  private selectedSurgerySubject = new BehaviorSubject<Surgery | null>(null);
  private surgeries: Surgery[] = [];
  private simulationMode = false; // DISABLED - using real API only

  constructor(private http: HttpClient) {
    // Initialize with data from API
    this.loadSurgeries();
  }
  
  private mockSurgeries: Surgery[] = [
    {
      id: 1,
      name: 'Appendectomy',
      description: 'Surgical removal of the appendix',
      status: 'ongoing',
      scheduledTime: '2023-11-15T09:30:00',
      roomNumber: '301',
      requiredInstruments: [
        { id: 101, name: 'Scalpel handle', inRoom: true },
        { id: 102, name: 'Metzenbaum scissors', inRoom: true },
        { id: 103, name: 'Mayo scissors', inRoom: false },
        { id: 104, name: 'Kelly clamps', inRoom: true },
        { id: 105, name: 'Mosquito forceps', inRoom: true },
        { id: 106, name: 'Needle holders', inRoom: false },
        { id: 107, name: 'Tissue forceps (Toothed)', inRoom: true },
        { id: 108, name: 'Tissue forceps (Non-Toothed)', inRoom: false }
      ]
    },
    {
      id: 2,
      name: 'Cesarean Section',
      description: 'Surgical delivery of a baby',
      status: 'scheduled',
      scheduledTime: '2023-11-16T10:15:00',
      roomNumber: '205',
      requiredInstruments: [
        { id: 201, name: 'Scalpel handle', inRoom: true },
        { id: 202, name: 'Mayo scissors', inRoom: false },
        { id: 203, name: 'Umbilical cord scissors', inRoom: true },
        { id: 204, name: 'Allis tissue forceps', inRoom: true }
      ]
    },
    {
      id: 3,
      name: 'Total Hip Replacement',
      description: 'Replacement of hip joint with prosthesis',
      status: 'completed',
      scheduledTime: '2023-11-14T08:00:00',
      roomNumber: '405',
      requiredInstruments: [
        { id: 301, name: 'Hip retractor set', inRoom: true },
        { id: 302, name: 'Acetabular reamer set', inRoom: true },
        { id: 303, name: 'Femoral broach set', inRoom: false },
        { id: 304, name: 'Femoral head/neck resection guide', inRoom: true }
      ]
    }
  ];

  // Load surgeries from API
  private loadSurgeries(): void {
    // Check if authentication token exists
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No authentication token found');
      // Fall back to mock data since no token available
      this.fallbackToMockData();
      return;
    }

    // Create headers with authentication token
    const headers = new HttpHeaders().set('Authorization', `Token ${token}`);
    
    // Make HTTP request to get operation sessions from backend
    this.http.get<OperationSession[] | {results: OperationSession[]}>(
      `${environment.apiUrl}/operation-sessions/`, 
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error fetching operation sessions:', error);
        // Fall back to mock data if API fails
        return this.simulateApiCall();
      })
    ).subscribe(
      (response) => {
        // Handle both array response and paginated response
        const operationSessions = Array.isArray(response) ? response : (response as {results: OperationSession[]}).results || [];
        // Ensure we're working with OperationSession[] type
        const sessions = operationSessions as OperationSession[];
        
        // Map operation session data to Surgery objects
        this.surgeries = sessions.map((session: OperationSession): Surgery => ({
          id: session.id,
          name: typeof session.operation_type === 'object' ? 
                  (session.operation_type?.name || 'Unknown Operation') : 
                  String(session.operation_type || 'Unknown Operation'),
          description: typeof session.operation_type === 'object' ? 
                      (session.operation_type?.description || '') : 
                      '',
          status: this.mapOperationSessionStateToStatus(session.state),
          scheduledTime: session.scheduled_time || new Date().toISOString(),
          roomNumber: typeof session.operation_room === 'object' ? 
                     (session.operation_room?.name || 'Unknown Room') : 
                     String(session.operation_room || 'Unknown Room'),
          requiredInstruments: [], // We'll populate this from other calls if needed
          patient_name: session.users && Array.isArray(session.users) && session.users.length > 0 ? 
                       `Patient of ${session.users[0].username || 'Unknown'}` : 
                       'Unknown Patient',
          state: session.state,
          state_display: session.state_display || this.capitalizeFirstLetter(session.state || '')
        }));
        
        // Update the subject
        this.surgeriesSubject.next(this.surgeries);
      }, 
      error => {
        console.error('Error processing operation sessions:', error);
        this.fallbackToMockData();
      }
    );
  }
  
  // Fallback to mock data if API fails
  private fallbackToMockData(): void {
    console.warn('Using mock surgery data');
    this.surgeries = this.mockSurgeries;
    this.surgeriesSubject.next(this.surgeries);
  }
  
  // Simulate API call with mock data
  private simulateApiCall(): Observable<Surgery[]> {
    return of(this.mockSurgeries).pipe(
      delay(600), // Simulate network delay
      tap(() => console.log('Simulated API call completed'))
    );
  }

  getAllSurgeries(): Observable<Surgery[]> {
    return this.surgeriesSubject.asObservable();
  }
  
  getSurgeriesByStatus(status: 'scheduled' | 'ongoing' | 'completed'): Observable<Surgery[]> {
    // Return filtered surgeries immediately from the cached data
    return of(this.surgeries.filter(surgery => surgery.status === status));
  }

  getSurgeryById(id: number): Observable<Surgery | undefined> {
    const surgery = this.surgeries.find(surgery => surgery.id === id);
    return of(surgery); // Return immediately from cached data
  }

  setSelectedSurgery(surgery: Surgery | null): void {
    this.selectedSurgerySubject.next(surgery);
  }

  getSelectedSurgery(): Observable<Surgery | null> {
    return this.selectedSurgerySubject.asObservable();
  }

  getInstrumentsInRoom(surgery: Surgery): Instrument[] {
    return surgery.requiredInstruments.filter(instrument => instrument.inRoom);
  }

  getInstrumentsNotInRoom(surgery: Surgery): Instrument[] {
    return surgery.requiredInstruments.filter(instrument => !instrument.inRoom);
  }
  
  /**
   * Maps the operation session state from the backend to a status that can be used in the frontend
   * @param state The operation session state from the backend
   */
  private mapOperationSessionStateToStatus(state: string): 'scheduled' | 'ongoing' | 'completed' {
    if (!state) return 'scheduled';
    
    // Map states based on the backend states
    switch (state) {
      case 'created':
      case 'scheduled':
      case 'pending':
        return 'scheduled';
      case 'verified':
      case 'in_progress':
      case 'verification_needed':
        return 'ongoing';
      case 'completed':
      case 'outbound_cleared':
      case 'cancelled':
        return 'completed';
      default:
        return 'scheduled';
    }
  }
  
  /**
   * Helper function to capitalize the first letter of a string
   * @param text The string to capitalize
   */
  private capitalizeFirstLetter(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, ' ');
  }
}
