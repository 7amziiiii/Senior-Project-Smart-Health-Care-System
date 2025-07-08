import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MlService, PredictionRequest, MaintenancePrediction } from '../../services/ml-service.service';
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
  equipmentList: Equipment[] = [];
  
  needMaintenanceCount = 0;
  goodConditionCount = 0;
  totalEquipmentCount = 0;
  mlApiAvailable = false;
  selectedFilter: string = 'all';
  loading = false;
  dataLoading = true; // Added for loading state during data fetching
  
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
    console.log('Predictive Maintenance Dashboard initializing...');
    // Load real equipment data from backend
    this.loadEquipment();
    this.checkMlApiAvailability();
    this.subscribeToEquipmentRequests();
  }
  
  private loadEquipment(): void {
    console.log('Loading equipment from backend...');
    this.equipmentService.getLargeEquipment().subscribe({
      next: (equipment) => {
        console.log('Received equipment from backend:', equipment);
        
        // Map backend equipment data to our Equipment interface
        this.equipmentList = equipment.map(item => {
          // Calculate days since maintenance based on last_maintenance_date
          const lastMaintenance = item.last_maintenance_date ? new Date(item.last_maintenance_date) : new Date();
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - lastMaintenance.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          return {
            id: item.id,
            name: item.name,
            type: item.equipment_type || 'Unknown',
            location: item.location || 'Hospital',
            lastService: item.last_maintenance_date || 'Never',
            needsMaintenance: false, // Will be set by ML prediction
            confidence: 0,
            equipmentId: item.equipment_id || `EQ${item.id.toString().padStart(4, '0')}`,
            daysSinceMaintenance: diffDays,
            // Set default values for ML features since they aren't in the LargeEquipment interface
            totalUsageHours: 0, // Will track actual usage over time
            avgDailyUsage: 0,   // Will calculate based on usage data
            procedureCount: 0    // Will track from equipment requests
          };
        });
        
        this.totalEquipmentCount = this.equipmentList.length;
        console.log('Mapped equipment list:', this.equipmentList);
        
        // Now get predictions for each piece of equipment
        this.refreshPredictions();
      },
      error: (error) => {
        console.error('Error loading equipment:', error);
        // Show error message to user
      }
    });
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
    console.log('Refreshing predictions with real ML service...');
    if (!this.equipmentList || this.equipmentList.length === 0) {
      console.log('No equipment to predict for');
      this.dataLoading = false;
      return;
    }
    
    this.needMaintenanceCount = 0;
    this.goodConditionCount = 0;
    let pendingPredictions = this.equipmentList.length;
    
    // Process each equipment item through the ML service
    this.equipmentList.forEach((equipment) => {
      // Create prediction request from equipment data
      const predictionRequest: PredictionRequest = {
        equipment_id: equipment.equipmentId,
        days_since_maintenance: equipment.daysSinceMaintenance,
        total_usage_hours: equipment.totalUsageHours,
        avg_daily_usage: equipment.avgDailyUsage,
        procedure_count: equipment.procedureCount
      };
      
      console.log(`Requesting prediction for ${equipment.name}:`, predictionRequest);
      
      this.mlService.getPrediction(predictionRequest).subscribe({
        next: (prediction: MaintenancePrediction) => {
          console.log(`Received prediction for ${equipment.name}:`, prediction);
          
          // Update equipment with ML prediction
          equipment.needsMaintenance = prediction.maintenance_needed_soon;
          equipment.confidence = prediction.confidence;
          
          // Count equipment by maintenance status
          if (equipment.needsMaintenance) {
            this.needMaintenanceCount++;
          } else {
            this.goodConditionCount++;
          }
          
          // When all predictions are complete
          pendingPredictions--;
          if (pendingPredictions === 0) {
            this.finalizePredictionResults();
          }
        },
        error: (error) => {
          console.error(`Error getting prediction for ${equipment.name}:`, error);
          
          // Fall back to simplified prediction for this item
          this.applySimplifiedPrediction(equipment);
          
          // When all predictions are complete
          pendingPredictions--;
          if (pendingPredictions === 0) {
            this.finalizePredictionResults();
          }
        }
      });
    });
  }
  
  private finalizePredictionResults(): void {
    console.log('All predictions complete. Sorting and updating charts...');
    
    // Sort equipment by maintenance need and confidence
    this.equipmentList.sort((a, b) => {
      if (a.needsMaintenance !== b.needsMaintenance) {
        return a.needsMaintenance ? -1 : 1;
      }
      // Handle possibly undefined confidence values
      const confA = a.confidence || 0;
      const confB = b.confidence || 0;
      return confB - confA;
    });
    
    this.updateMaintenanceCounts(); // Use existing method instead of missing updateCharts
    this.dataLoading = false;
  }
  
  private applySimplifiedPrediction(equipment: Equipment): void {
    // Simplified fallback when ML service is unavailable
    console.log(`Using simplified prediction for ${equipment.name}`);
    const maintenanceScore = (
      (equipment.daysSinceMaintenance / 200) * 0.4 +
      (equipment.totalUsageHours / 500) * 0.4 +
      (equipment.procedureCount / 100) * 0.2
    );
    
    equipment.needsMaintenance = maintenanceScore > 0.5;
    equipment.confidence = equipment.needsMaintenance 
      ? 0.5 + (maintenanceScore - 0.5) * 0.8 // Scale to 0.5-0.98 range for maintenance needed
      : 0.5 - (0.5 - maintenanceScore) * 0.8; // Scale to 0.02-0.5 range for good condition
      
    // Round to 2 decimal places
    equipment.confidence = Math.round(equipment.confidence * 100) / 100;
    
    // Count equipment by maintenance status
    if (equipment.needsMaintenance) {
      this.needMaintenanceCount++;
    } else {
      this.goodConditionCount++;
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
