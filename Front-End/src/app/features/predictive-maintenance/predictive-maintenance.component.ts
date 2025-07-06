import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Equipment {
  id: number;
  name: string;
  type: string;
  location: string;
  lastService: string;
  needsMaintenance: boolean;
}

@Component({
  selector: 'app-predictive-maintenance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './predictive-maintenance.component.html',
  styleUrls: ['./predictive-maintenance.component.scss']
})
export class PredictiveMaintenanceComponent {
  today = new Date();
  equipmentList: Equipment[] = [
    {
      id: 1,
      name: 'Ventilator #A2234',
      type: 'Respiratory',
      location: 'OR Room 3',
      lastService: '2025-01-15',
      needsMaintenance: true
    },
    {
      id: 2,
      name: 'X-Ray Machine',
      type: 'Imaging',
      location: 'Radiology Department',
      lastService: '2024-12-10',
      needsMaintenance: true
    },
    {
      id: 3,
      name: 'ECG Monitor',
      type: 'Cardiac',
      location: 'ICU',
      lastService: '2025-05-08',
      needsMaintenance: false
    },
    {
      id: 4,
      name: 'Anesthesia Machine',
      type: 'Anesthesiology',
      location: 'OR Room 2',
      lastService: '2025-04-20',
      needsMaintenance: false
    },
    {
      id: 5,
      name: 'MRI Scanner',
      type: 'Imaging',
      location: 'Radiology Department',
      lastService: '2025-05-15',
      needsMaintenance: false
    },
    {
      id: 6,
      name: 'Surgical Robot',
      type: 'Robotics',
      location: 'OR Room 1',
      lastService: '2025-03-28',
      needsMaintenance: false
    }
  ];

  constructor(private router: Router) {}
  
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
  
  navigateToMaintenanceDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
