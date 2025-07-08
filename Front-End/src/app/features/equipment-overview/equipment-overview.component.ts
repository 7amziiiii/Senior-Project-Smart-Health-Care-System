import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EquipmentService } from '../../services/equipment.service';

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

  constructor(private router: Router, private equipmentService: EquipmentService) {}

  ngOnInit(): void {
    console.log('Loading equipment overview data from API');
    
    // Load equipment overview from API
    this.equipmentService.getEquipmentOverview().subscribe({
      next: (equipmentData) => {
        console.log('Received equipment overview data:', equipmentData);
        
        // Map API response to our Equipment interface
        this.allEquipment = equipmentData.map(item => {
          // Convert backend status to frontend status format
          let status: 'in_maintenance' | 'in_or' | 'not_found' | 'available' = 'available';
          
          if (item.status === 'In OR Room') {
            status = 'in_or';
          } else if (item.status === 'In Maintenance') {
            status = 'in_maintenance';
          } else if (item.status === 'Not Found') {
            status = 'not_found';
          } else if (item.status === 'Available') {
            status = 'available';
          }
          
          // Create Equipment object
          const equipment: Equipment = {
            id: item.id,
            name: item.name,
            type: item.type,
            status: status,
            lastMaintenance: item.last_maintenance,
            nextMaintenance: item.next_maintenance,
            notes: item.notes || ''
          };
          
          // Add optional fields if present
          if (item.location && item.location.startsWith('OR-')) {
            equipment.roomNumber = item.location;
          }
          
          if (item.last_seen) {
            equipment.lastSeen = item.last_seen;
          }
          
          return equipment;
        });
        
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error loading equipment overview data:', error);
        
        // Fallback to empty array in case of error
        this.allEquipment = [];
        this.applyFilters();
      }
    });
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
      // Since we're inside the if-block that checks selectedEquipment is not null,
      // we can safely assert that it exists with the non-null assertion operator
      const equipmentId = this.selectedEquipment!.id;
      const currentDate = new Date().toISOString().split('T')[0];
      const formattedNote = `${this.newNote} (Added on ${currentDate})\n\n${this.selectedEquipment!.notes}`;
      
      // Call the API to save the notes
      this.equipmentService.updateEquipmentNotes(equipmentId, formattedNote).subscribe({
        next: (response) => {
          console.log('Notes updated successfully:', response);
          
          // Update the UI with the saved notes
          this.selectedEquipment!.notes = formattedNote;
          this.newNote = '';
          
          // Update the equipment in the main array
          // Since we already checked selectedEquipment at the beginning of the method
          // and we're updating it in the callback, we know it's still not null
          const equipment = this.selectedEquipment!;
          const index = this.allEquipment.findIndex(e => e.id === equipment.id);
          if (index > -1) {
            this.allEquipment[index] = {...equipment};
          }
        },
        error: (error) => {
          console.error('Error updating equipment notes:', error);
          alert('Failed to save equipment notes. Please try again.');
        }
      });
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
