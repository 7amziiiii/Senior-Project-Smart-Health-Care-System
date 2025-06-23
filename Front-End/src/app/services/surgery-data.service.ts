import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Instrument {
  id: number;
  name: string;
  inRoom: boolean;
}

export interface Surgery {
  id: number;
  name: string;
  description: string;
  requiredInstruments: Instrument[];
}

@Injectable({
  providedIn: 'root'
})
export class SurgeryDataService {
  private surgeries: Surgery[];
  private selectedSurgerySubject = new BehaviorSubject<Surgery | null>(null);

  constructor() {
    this.surgeries = [
      {
        id: 1,
        name: 'Appendectomy',
        description: 'Surgical removal of the appendix',
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
  }

  getAllSurgeries(): Surgery[] {
    return [...this.surgeries];
  }

  getSurgeryById(id: number): Surgery | undefined {
    return this.surgeries.find(surgery => surgery.id === id);
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
}
