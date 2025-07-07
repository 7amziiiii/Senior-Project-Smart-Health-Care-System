import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { LargeEquipment, EquipmentRequest, SurgeryEquipment } from '../models/large-equipment.model';

@Injectable({
  providedIn: 'root'
})
export class EquipmentService {
  // Mock data for equipment requests (would connect to backend in real implementation)
  private mockLargeEquipment: LargeEquipment[] = [
    {
      id: 1,
      name: 'C-Arm X-Ray Machine',
      equipment_id: 'CA-001',
      equipment_type: 'Imaging',
      status: 'available',
      last_maintenance_date: '2025-06-15T10:30:00',
      next_maintenance_date: '2025-09-15T00:00:00',
      isAvailable: true
    },
    {
      id: 2,
      name: 'Surgical Microscope',
      equipment_id: 'SM-002',
      equipment_type: 'Optical',
      status: 'in_use',
      last_maintenance_date: '2025-06-01T08:15:00',
      next_maintenance_date: '2025-08-01T00:00:00',
      isAvailable: false
    },
    {
      id: 3,
      name: 'Patient Warming System',
      equipment_id: 'PWS-003',
      equipment_type: 'Patient Care',
      status: 'available',
      last_maintenance_date: '2025-06-20T14:45:00',
      next_maintenance_date: '2025-08-20T00:00:00',
      isAvailable: true
    },
    {
      id: 4,
      name: 'Robotic Surgery System',
      equipment_id: 'RSS-004',
      equipment_type: 'Surgical',
      status: 'under_repair',
      last_maintenance_date: '2025-07-01T09:00:00',
      next_maintenance_date: '2025-07-10T00:00:00',
      isAvailable: false
    }
  ];

  // Mock surgery equipment requirements
  private mockSurgeryEquipment: { [surgeryId: number]: SurgeryEquipment[] } = {
    1: [ // Heart Surgery
      {
        surgery_id: 1,
        equipment_id: 1,
        equipment: this.mockLargeEquipment[0],
        isRequired: true,
        isAvailable: true
      },
      {
        surgery_id: 1,
        equipment_id: 2,
        equipment: this.mockLargeEquipment[1],
        isRequired: true,
        isAvailable: false
      }
    ],
    2: [ // Knee Replacement
      {
        surgery_id: 2,
        equipment_id: 1,
        equipment: this.mockLargeEquipment[0],
        isRequired: true,
        isAvailable: true
      },
      {
        surgery_id: 2,
        equipment_id: 3,
        equipment: this.mockLargeEquipment[2],
        isRequired: true,
        isAvailable: true
      }
    ],
    3: [ // Brain Surgery
      {
        surgery_id: 3,
        equipment_id: 2,
        equipment: this.mockLargeEquipment[1],
        isRequired: true,
        isAvailable: false
      },
      {
        surgery_id: 3,
        equipment_id: 4,
        equipment: this.mockLargeEquipment[3],
        isRequired: true,
        isAvailable: false
      }
    ]
  };

  // Track equipment requests
  private equipmentRequests: EquipmentRequest[] = [];
  private equipmentRequestsSubject = new BehaviorSubject<EquipmentRequest[]>([]);

  constructor() { }

  // Get all large equipment
  getLargeEquipment(): Observable<LargeEquipment[]> {
    return of(this.mockLargeEquipment);
  }

  // Get equipment needed for a specific surgery
  getSurgeryEquipment(surgeryId: number): Observable<SurgeryEquipment[]> {
    return of(this.mockSurgeryEquipment[surgeryId] || []);
  }

  // Request equipment for a surgery
  requestEquipment(surgeryId: number, equipment: LargeEquipment): Observable<EquipmentRequest> {
    const request: EquipmentRequest = {
      id: this.equipmentRequests.length + 1,
      equipment: equipment,
      operation_session: surgeryId,
      status: 'requested',
      check_out_time: new Date().toISOString()
    };

    this.equipmentRequests.push(request);
    this.equipmentRequestsSubject.next([...this.equipmentRequests]);
    return of(request);
  }

  // Get all equipment requests
  getEquipmentRequests(): Observable<EquipmentRequest[]> {
    return this.equipmentRequestsSubject.asObservable();
  }

  // Mark equipment request as fulfilled
  fulfillRequest(requestId: number): Observable<EquipmentRequest | null> {
    const index = this.equipmentRequests.findIndex(req => req.id === requestId);
    if (index !== -1) {
      this.equipmentRequests[index].status = 'in_use';
      this.equipmentRequestsSubject.next([...this.equipmentRequests]);
      return of(this.equipmentRequests[index]);
    }
    return of(null);
  }
}
