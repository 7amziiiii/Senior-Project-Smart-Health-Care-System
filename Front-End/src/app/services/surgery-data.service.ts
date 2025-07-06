import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, delay, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
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
}

@Injectable({
  providedIn: 'root'
})
export class SurgeryDataService {
  private surgeriesSubject = new BehaviorSubject<Surgery[]>([]);
  private selectedSurgerySubject = new BehaviorSubject<Surgery | null>(null);
  private surgeries: Surgery[] = [];
  private simulationMode = false; // Toggle between real API and simulation

  constructor(private http: HttpClient) {
    // Initialize with mock data
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
          { id: 108, name: 'Tissue forceps (Non-Toothed)', inRoom: false },
          { id: 109, name: 'Army-Navy retractors', inRoom: true },
          { id: 110, name: 'Richardson retractors', inRoom: true },
          { id: 111, name: 'Laparoscopic trocars', inRoom: false },
          { id: 112, name: 'Laparoscopic graspers', inRoom: true },
          { id: 113, name: 'Laparoscopic scissors', inRoom: false },
          { id: 114, name: 'Laparoscopic clip appliers', inRoom: true },
          { id: 115, name: 'Laparoscopic camera and light cable', inRoom: false },
          { id: 116, name: 'Suction cannula', inRoom: true },
          { id: 117, name: 'Electrocautery pencil', inRoom: true },
          { id: 118, name: 'Instrument tray', inRoom: true }
        ]
      },
      {
        id: 2,
        name: 'Cesarean Section (C-Section)',
        description: 'Surgical delivery of a baby',
        status: 'scheduled',
        scheduledTime: '2023-11-16T10:15:00',
        roomNumber: '205',
        requiredInstruments: [
          { id: 201, name: 'Scalpel handle', inRoom: true },
          { id: 202, name: 'Mayo scissors', inRoom: false },
          { id: 203, name: 'Umbilical cord scissors', inRoom: true },
          { id: 204, name: 'Allis tissue forceps', inRoom: true },
          { id: 205, name: 'Babcock forceps', inRoom: false },
          { id: 206, name: 'Kocher clamps', inRoom: true },
          { id: 207, name: 'Needle holders', inRoom: true },
          { id: 208, name: 'Ring forceps', inRoom: false },
          { id: 209, name: 'Towel clamps', inRoom: true },
          { id: 210, name: 'DeBakey forceps', inRoom: false },
          { id: 211, name: 'Deaver retractors', inRoom: true },
          { id: 212, name: 'Doyen retractor', inRoom: true },
          { id: 213, name: 'Bladder blade', inRoom: false },
          { id: 214, name: 'Cesarean instrument tray', inRoom: true },
          { id: 215, name: 'Electrocautery pencil', inRoom: false },
          { id: 216, name: 'Light handles', inRoom: true },
          { id: 217, name: 'Suction tip', inRoom: true },
          { id: 218, name: 'Delivery forceps', inRoom: false }
        ]
      },
      {
        id: 3,
        name: 'Total Knee Replacement (TKR)',
        description: 'Surgical replacement of the knee joint',
        status: 'scheduled',
        scheduledTime: '2023-11-15T14:00:00',
        roomNumber: '206',
        requiredInstruments: [
          { id: 301, name: 'Oscillating saw handpiece', inRoom: true },
          { id: 302, name: 'Bone saw blades', inRoom: false },
          { id: 303, name: 'Reamers', inRoom: true },
          { id: 304, name: 'Rasp', inRoom: true },
          { id: 305, name: 'Orthopedic mallet', inRoom: false },
          { id: 306, name: 'Femoral cutting blocks', inRoom: true },
          { id: 307, name: 'Tibial cutting blocks', inRoom: false },
          { id: 308, name: 'Broaches', inRoom: true },
          { id: 309, name: 'Trial implants (femoral)', inRoom: true },
          { id: 310, name: 'Trial implants (tibial)', inRoom: false },
          { id: 311, name: 'Calipers', inRoom: true },
          { id: 312, name: 'Depth gauge', inRoom: false },
          { id: 313, name: 'Bone hooks', inRoom: true },
          { id: 314, name: 'Hohmann retractors', inRoom: true },
          { id: 315, name: 'Curettes', inRoom: false },
          { id: 316, name: 'Impactors', inRoom: true },
          { id: 317, name: 'Alignment guides', inRoom: false },
          { id: 318, name: 'Instrument trays', inRoom: true },
          { id: 319, name: 'Implant inserters', inRoom: true },
          { id: 320, name: 'Electrocautery pencil', inRoom: false },
          { id: 321, name: 'Drill and drill bits', inRoom: true },
          { id: 322, name: 'Cement mixing bowl', inRoom: false },
          { id: 323, name: 'Light handles', inRoom: true },
          { id: 324, name: 'Power tool system', inRoom: true }
        ]
      }
    ];
  
  // Load surgeries either from API or mock data
  loadSurgeries(): void {
    if (this.simulationMode) {
      this.simulateApiCall().subscribe(surgeries => {
        this.surgeries = surgeries;
        this.surgeriesSubject.next(surgeries);
      });
    } else {
      // Real API implementation - fetch operation sessions from backend
      this.http.get<any[]>(`${environment.apiUrl}/operation-sessions/`).subscribe(sessions => {
        // Map operation sessions to Surgery interface
        this.surgeries = sessions.map(session => ({
          id: session.id,
          name: session.operation_type || 'Unknown Operation',
          description: session.notes || '',
          status: this.mapOperationSessionStateToStatus(session.state),
          scheduledTime: session.start_time || new Date().toISOString(),
          roomNumber: session.room || 'Unknown',
          requiredInstruments: [],  // We'll populate this from other calls if needed
          patient_name: session.patient_name || 'Unknown Patient',
          state: session.state
        }));
        this.surgeriesSubject.next(this.surgeries);
      }, error => {
        console.error('Error fetching operation sessions:', error);
        // Fallback to mock data if API fails
        this.simulateApiCall().subscribe(surgeries => {
          this.surgeries = surgeries;
          this.surgeriesSubject.next(surgeries);
        });
      });
    }
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
    return of(this.surgeries.filter(surgery => surgery.status === status)).pipe(
      delay(300) // Simulate small network delay
    );
  }

  getSurgeryById(id: number): Observable<Surgery | undefined> {
    const surgery = this.surgeries.find(surgery => surgery.id === id);
    return of(surgery).pipe(delay(300)); // Simulate network delay
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
        return 'completed';
      default:
        return 'scheduled';
    }
  }
}
