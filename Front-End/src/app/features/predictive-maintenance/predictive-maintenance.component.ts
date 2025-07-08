import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MlService, PredictionRequest } from '../../services/ml-service.service';
import { EquipmentService } from '../../services/equipment.service';
import { EquipmentRequest } from '../../models/large-equipment.model';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface Equipment {
  id: number;
  name: string;
  type: string;
  location: string;
  lastService: string;
  needsMaintenance: boolean;
  confidence?: number;
  equipmentId: string;
  daysSinceMaintenance: number;
  totalUsageHours: number;
  avgDailyUsage: number;
  procedureCount: number;
}

@Component({
  selector: 'app-predictive-maintenance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './predictive-maintenance.component.html',
  styleUrls: ['./predictive-maintenance.component.scss']
})
export class PredictiveMaintenanceComponent implements OnInit, OnDestroy {
  today = new Date();
  equipmentList: Equipment[] = [
    {
      id: 1,
      name: 'Ventilator #A2234',
      type: 'Respiratory',
      location: 'OR Room 3',
      lastService: '2025-01-15',
      needsMaintenance: true,
      confidence: 0.96,
      equipmentId: 'EQ0001',
      daysSinceMaintenance: 173,
      totalUsageHours: 432,
      avgDailyUsage: 2.5,
      procedureCount: 87
    },
    {
      id: 2,
      name: 'X-Ray Machine',
      type: 'Imaging',
      location: 'Radiology Department',
      lastService: '2024-12-10',
      needsMaintenance: true,
      confidence: 0.89,
      equipmentId: 'EQ0002',
      daysSinceMaintenance: 209,
      totalUsageHours: 520,
      avgDailyUsage: 2.5,
      procedureCount: 104
    },
    {
      id: 3,
      name: 'ECG Monitor',
      type: 'Cardiac',
      location: 'ICU',
      lastService: '2025-05-08',
      needsMaintenance: false,
      confidence: 0.12,
      equipmentId: 'EQ0003',
      daysSinceMaintenance: 60,
      totalUsageHours: 150,
      avgDailyUsage: 2.5,
      procedureCount: 30
    },
    {
      id: 4,
      name: 'Anesthesia Machine',
      type: 'Anesthesiology',
      location: 'OR Room 2',
      lastService: '2025-04-20',
      needsMaintenance: false,
      confidence: 0.08,
      equipmentId: 'EQ0004',
      daysSinceMaintenance: 78,
      totalUsageHours: 186,
      avgDailyUsage: 2.4,
      procedureCount: 45
    },
    {
      id: 5,
      name: 'MRI Scanner',
      type: 'Imaging',
      location: 'Radiology Department',
      lastService: '2025-05-15',
      needsMaintenance: false,
      confidence: 0.22,
      equipmentId: 'EQ0005',
      daysSinceMaintenance: 53,
      totalUsageHours: 130,
      avgDailyUsage: 2.5,
      procedureCount: 28
    },
    {
      id: 6,
      name: 'Surgical Robot',
      type: 'Robotics',
      location: 'OR Room 1',
      lastService: '2025-04-01',
      needsMaintenance: false,
      confidence: 0.31,
      equipmentId: 'EQ0006',
      daysSinceMaintenance: 97,
      totalUsageHours: 212,
      avgDailyUsage: 2.2,
      procedureCount: 53
    }
  ];
  
  needMaintenanceCount = 0;
  goodConditionCount = 0;
  totalEquipmentCount = 0;
  mlApiAvailable = false;
  selectedFilter: string = 'all';
  loading = false;
  
  // Equipment request notifications
  equipmentRequests: EquipmentRequest[] = [];
  hasNewRequests = false;
  showNotifications = false;
  requestedEquipmentCount = 0;
  private requestsSubscription: Subscription = new Subscription();

  constructor(
    private router: Router,
    private mlService: MlService,
    private equipmentService: EquipmentService,
    private authService: AuthService
  ) { }
  
  ngOnInit(): void {
    this.totalEquipmentCount = this.equipmentList.length;
    this.checkMlApiAvailability();
    this.refreshPredictions();
    this.subscribeToEquipmentRequests();
  }
  
  ngOnDestroy(): void {
    if (this.requestsSubscription) {
      this.requestsSubscription.unsubscribe();
    }
  }
  
  subscribeToEquipmentRequests(): void {
    this.requestsSubscription = this.equipmentService.getEquipmentRequests().subscribe(requests => {
      this.equipmentRequests = requests;
      
      // Calculate requested equipment count
      this.requestedEquipmentCount = requests.filter(req => req.status === 'requested').length;
      
      // Mark as new if there are any requests with status 'requested'
      this.hasNewRequests = this.requestedEquipmentCount > 0;
    });
  }
  
  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.hasNewRequests = false; // Reset notification badge when viewed
    }
  }
  
  fulfillRequest(requestId: number): void {
    this.equipmentService.fulfillRequest(requestId).subscribe(updatedRequest => {
      if (updatedRequest) {
        // Request was successfully fulfilled
        const index = this.equipmentRequests.findIndex(req => req.id === requestId);
        if (index !== -1) {
          this.equipmentRequests[index].status = 'in_use';
        }
      }
    });
  }
  
  goBack() {
    if (this.authService.isAdmin()) {
      this.router.navigate(['/admin']);
    } else if (this.authService.isMaintenance()) {
      this.router.navigate(['/maintenance']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
  
  updateMaintenanceCounts(): void {
    this.needMaintenanceCount = this.equipmentList.filter(eq => eq.needsMaintenance).length;
    this.goodConditionCount = this.equipmentList.filter(eq => !eq.needsMaintenance).length;
  }
  
  // Filter methods to replace pipe usage
  getMaintenanceEquipment(): Equipment[] {
    return this.equipmentList.filter(equipment => equipment.needsMaintenance);
  }
  
  getGoodConditionEquipment(): Equipment[] {
    return this.equipmentList.filter(equipment => !equipment.needsMaintenance);
  }
  
  checkMlApiAvailability(): void {
    // This would normally check if the API is available
    // For demo purposes, we'll just simulate it
    this.mlApiAvailable = true;
  }
  
  refreshPredictions(): void {
    // In a real application, this would call the ML API for each piece of equipment
    for (const equipment of this.equipmentList) {
      this.getPrediction(equipment);
    }
  }
  
  getPrediction(equipment: Equipment): void {
    const request: PredictionRequest = {
      equipment_id: equipment.equipmentId,
      days_since_maintenance: equipment.daysSinceMaintenance,
      total_usage_hours: equipment.totalUsageHours,
      avg_daily_usage: equipment.avgDailyUsage,
      procedure_count: equipment.procedureCount
    };
    
    // If the API is available, make a real call; otherwise use the simulated data
    if (this.mlApiAvailable) {
      try {
        this.mlService.getPrediction(request).subscribe({
          next: (result) => {
            equipment.needsMaintenance = result.maintenance_needed_soon;
            equipment.confidence = result.confidence;
            this.updateMaintenanceCounts();
          },
          error: (err) => {
            console.error('Error fetching prediction:', err);
            // Fall back to simulated data - already set
          }
        });
      } catch (error) {
        console.error('Error calling ML service:', error);
        // Fall back to simulated data - already set
      }
    }
  }
  
  scheduleService(equipment: Equipment): void {
    alert(`Service scheduled for ${equipment.name}`);
    // In a real app, this would open a form or dialog to schedule maintenance
  }
  
  navigateToMaintenanceDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
