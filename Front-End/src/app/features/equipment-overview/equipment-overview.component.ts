import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Equipment {
  id: number;
  name: string;
  type: string;
  status: 'in_maintenance' | 'in_or' | 'not_found' | 'available';
  lastSeen?: string;
  roomNumber?: string;
  lastMaintenance: string;
  nextMaintenance: string;
  notes: string;
}

@Component({
  selector: 'app-equipment-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipment-overview.component.html',
  styleUrls: ['./equipment-overview.component.scss']
})
export class EquipmentOverviewComponent implements OnInit {
  allEquipment: Equipment[] = [];
  filteredEquipment: Equipment[] = [];
  searchTerm: string = '';
  filterStatus: string = 'all';
  selectedEquipment: Equipment | null = null;
  newNote: string = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Simulated data - in a real app this would come from a service
    this.allEquipment = [
      {
        id: 1,
        name: 'MRI Scanner',
        type: 'Imaging',
        status: 'in_or',
        roomNumber: 'OR-101',
        lastMaintenance: '2025-05-15',
        nextMaintenance: '2025-08-15',
        notes: 'Regular maintenance completed. Cooling system checked.'
      },
      {
        id: 2,
        name: 'Ventilator #A2234',
        type: 'Respiratory',
        status: 'in_maintenance',
        lastMaintenance: '2025-06-01',
        nextMaintenance: '2025-09-01',
        notes: 'Filter replacement needed. Currently under repair.'
      },
      {
        id: 3,
        name: 'ECG Monitor',
        type: 'Cardiac',
        status: 'not_found',
        lastSeen: 'OR-203 on 2025-07-01',
        lastMaintenance: '2025-04-10',
        nextMaintenance: '2025-07-10',
        notes: 'Battery replacement recommended on next service.'
      },
      {
        id: 4,
        name: 'Surgical Robot',
        type: 'Surgery',
        status: 'available',
        lastMaintenance: '2025-06-28',
        nextMaintenance: '2025-09-28',
        notes: 'Software updated to v4.2.1. Calibration performed.'
      },
      {
        id: 5,
        name: 'Defibrillator #D5678',
        type: 'Emergency',
        status: 'in_or',
        roomNumber: 'OR-105',
        lastMaintenance: '2025-05-22',
        nextMaintenance: '2025-08-22',
        notes: 'Battery capacity at 95%. No issues found.'
      },
      {
        id: 6,
        name: 'Anesthesia Machine',
        type: 'Anesthesiology',
        status: 'not_found',
        lastSeen: 'Storage Room B on 2025-06-25',
        lastMaintenance: '2025-04-15',
        nextMaintenance: '2025-07-15',
        notes: 'Requires immediate location and inspection. Maintenance overdue.'
      },
      {
        id: 7,
        name: 'X-Ray Machine',
        type: 'Imaging',
        status: 'in_maintenance',
        lastMaintenance: '2025-07-02',
        nextMaintenance: '2025-10-02',
        notes: 'Calibration in progress. Expected back in service on 2025-07-08.'
      },
      {
        id: 8,
        name: 'Ultrasound Scanner',
        type: 'Imaging',
        status: 'available',
        lastMaintenance: '2025-06-10',
        nextMaintenance: '2025-09-10',
        notes: 'New transducer installed. Working optimally.'
      }
    ];

    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredEquipment = this.allEquipment.filter(equipment => {
      // Apply search term filter
      if (this.searchTerm && !equipment.name.toLowerCase().includes(this.searchTerm.toLowerCase()) &&
          !equipment.type.toLowerCase().includes(this.searchTerm.toLowerCase())) {
        return false;
      }

      // Apply status filter
      if (this.filterStatus !== 'all' && equipment.status !== this.filterStatus) {
        return false;
      }

      return true;
    });
  }

  selectEquipment(equipment: Equipment): void {
    this.selectedEquipment = equipment;
    this.newNote = '';
  }

  goBack(): void {
    this.selectedEquipment = null;
  }

  addNote(): void {
    if (this.selectedEquipment && this.newNote.trim()) {
      // In a real app, this would call an API to update the notes
      this.selectedEquipment.notes = `${this.newNote} (Added on ${new Date().toISOString().split('T')[0]})\n\n${this.selectedEquipment.notes}`;
      this.newNote = '';

      // Update the equipment in the main array
      const index = this.allEquipment.findIndex(e => e.id === this.selectedEquipment?.id);
      if (index > -1) {
        this.allEquipment[index] = {...this.selectedEquipment};
      }
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'in_maintenance': return 'In Maintenance';
      case 'in_or': return 'In OR Room';
      case 'not_found': return 'Not Found';
      case 'available': return 'Available';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'in_maintenance': return 'status-maintenance';
      case 'in_or': return 'status-in-use';
      case 'not_found': return 'status-not-found';
      case 'available': return 'status-available';
      default: return '';
    }
  }

  navigateToMaintenanceDashboard(): void {
    this.router.navigate(['/maintenance']);
  }
}
