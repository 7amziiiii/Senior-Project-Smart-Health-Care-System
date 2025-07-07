export interface LargeEquipment {
  id: number;
  name: string;
  equipment_id: string;
  equipment_type: string;
  status: 'available' | 'in_use' | 'under_repair' | 'scheduled_maintenance';
  notes?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  isAvailable?: boolean; // For frontend use
}

export interface EquipmentRequest {
  id?: number;
  equipment: LargeEquipment;
  operation_session: number;
  requested_by?: number;
  status: 'requested' | 'in_use' | 'returned' | 'maintenance';
  check_out_time?: string;
  check_in_time?: string;
  duration_minutes?: number;
  maintenance_type?: string;
  maintenance_date?: string;
}

export interface SurgeryEquipment {
  surgery_id: number;
  equipment_id: number;
  equipment: LargeEquipment;
  isRequired: boolean;
  isAvailable: boolean;
}
