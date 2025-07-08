import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { LargeEquipment, EquipmentRequest } from '../../models/large-equipment.model';
import { EquipmentService } from '../../services/equipment.service';
import { Surgery } from '../../services/surgery-data.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-equipment-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipment-request.component.html',
  styleUrls: ['./equipment-request.component.scss']
})
export class EquipmentRequestComponent implements OnInit, OnDestroy {
  @Input() surgery: Surgery | null = null;
  
  availableEquipment: LargeEquipment[] = [];
  requests: EquipmentRequest[] = [];
  selectedEquipment: LargeEquipment | null = null;
  loading = false;
  error = '';
  success = '';
  
  private subscriptions: Subscription[] = [];

  constructor(
    private equipmentService: EquipmentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (this.surgery) {
      this.loadAvailableEquipment();
      this.loadExistingRequests();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadAvailableEquipment(): void {
    this.loading = true;
    this.error = '';
    
    if (!this.surgery || !this.surgery.scheduledTime) {
      this.error = 'Surgery information is incomplete';
      this.loading = false;
      return;
    }
    
    // Format date for API
    const operationDate = new Date(this.surgery.scheduledTime).toISOString().split('T')[0];
    
    // Use surgery name instead of type (which doesn't exist in Surgery model)
    const operationType = this.surgery.name;
    
    const sub = this.equipmentService.getAvailableEquipment(operationDate, operationType)
      .subscribe({
        next: (equipment) => {
          this.availableEquipment = equipment;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading available equipment:', err);
          this.error = 'Failed to load available equipment. Please try again.';
          this.loading = false;
        }
      });
      
    this.subscriptions.push(sub);
  }

  loadExistingRequests(): void {
    if (!this.surgery) return;
    
    const sub = this.equipmentService.getEquipmentRequests()
      .subscribe(requests => {
        // Filter requests for current surgery
        this.requests = requests.filter(req => req.operation_session === this.surgery?.id);
      });
      
    this.subscriptions.push(sub);
  }

  requestEquipment(equipment: LargeEquipment): void {
    if (!this.surgery) {
      this.error = 'No surgery selected';
      return;
    }
    
    this.loading = true;
    this.error = '';
    this.success = '';
    
    const sub = this.equipmentService.requestEquipment(this.surgery.id, equipment.id)
      .subscribe({
        next: (request) => {
          this.success = `${equipment.name} has been requested successfully`;
          this.loading = false;
          this.loadAvailableEquipment(); // Refresh available equipment
          this.loadExistingRequests(); // Refresh requests list
        },
        error: (err) => {
          console.error('Error requesting equipment:', err);
          this.error = 'Failed to request equipment. Please try again.';
          this.loading = false;
        }
      });
      
    this.subscriptions.push(sub);
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'requested': return 'Requested';
      case 'in_use': return 'In Use';
      case 'returned': return 'Returned';
      case 'maintenance': return 'Maintenance';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'requested': return 'status-requested';
      case 'in_use': return 'status-in-use';
      case 'returned': return 'status-returned';
      case 'maintenance': return 'status-maintenance';
      default: return '';
    }
  }
}
