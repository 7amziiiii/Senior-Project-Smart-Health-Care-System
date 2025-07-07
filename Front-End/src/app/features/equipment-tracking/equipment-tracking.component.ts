import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EquipmentService } from '../../services/equipment.service';
import { SurgeryDataService } from '../../services/surgery-data.service';
import { LargeEquipment, SurgeryEquipment } from '../../models/large-equipment.model';

@Component({
  selector: 'app-equipment-tracking',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './equipment-tracking.component.html',
  styleUrl: './equipment-tracking.component.scss'
})
export class EquipmentTrackingComponent implements OnInit {
  surgeryId: number;
  surgeryName: string = '';
  equipmentList: SurgeryEquipment[] = [];
  availableEquipmentCount = 0;
  missingEquipmentCount = 0;
  loading = false;
  errorMessage = '';
  requestSent = false;
  requestInProgress = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private equipmentService: EquipmentService,
    private surgeryService: SurgeryDataService
  ) {
    this.surgeryId = Number(this.route.snapshot.paramMap.get('surgeryId'));
  }

  ngOnInit(): void {
    this.loadSurgeryEquipment();
    this.loadSurgeryName();
  }

  loadSurgeryName(): void {
    this.surgeryService.getSurgeryById(this.surgeryId).subscribe(surgery => {
      if (surgery) {
        this.surgeryName = surgery.name;
      }
    });
  }

  loadSurgeryEquipment(): void {
    this.loading = true;
    this.equipmentService.getSurgeryEquipment(this.surgeryId).subscribe({
      next: (data) => {
        this.equipmentList = data;
        
        // Calculate equipment counts
        this.availableEquipmentCount = data.filter(e => e.isAvailable).length;
        this.missingEquipmentCount = data.filter(e => !e.isAvailable).length;
        
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load equipment list';
        this.loading = false;
        console.error('Error loading equipment:', error);
      }
    });
  }

  requestEquipment(equipment: LargeEquipment): void {
    this.requestInProgress = true;
    this.equipmentService.requestEquipment(this.surgeryId, equipment).subscribe({
      next: () => {
        this.requestSent = true;
        this.requestInProgress = false;
        
        // Update the equipment status in the list
        const index = this.equipmentList.findIndex(e => e.equipment_id === equipment.id);
        if (index !== -1) {
          this.equipmentList[index].equipment.status = 'in_use';
        }
      },
      error: (error) => {
        this.errorMessage = 'Failed to request equipment';
        this.requestInProgress = false;
        console.error('Error requesting equipment:', error);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
