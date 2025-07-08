import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { EquipmentService } from '../../services/equipment.service';
import { EquipmentRequest } from '../../models/large-equipment.model';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-maintenance-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './maintenance-dashboard.component.html',
  styleUrls: ['./maintenance-dashboard.component.scss']
})
export class MaintenanceDashboardComponent implements OnInit, OnDestroy {
  username: string = '';
  featureSelected: string | null = null;
  
  // Equipment requests to be displayed in the dashboard
  equipmentRequests: EquipmentRequest[] = [];
  showRequestsTab = true;
  requestsLoading = false;
  hasNewRequests = false;
  
  // For polling requests
  private requestsSubscription: Subscription | null = null;
  private previousRequestCount = 0;
  
  // Features available in the maintenance dashboard
  features = [
    {
      id: 'equipment-overview',
      title: 'Equipment Overview',
      description: 'Monitor all hospital equipment status, location, and maintenance needs',
      icon: 'fa-tools',
      route: '/equipment-overview'
    },
    {
      id: 'predictive-maintenance',
      title: 'Predictive Maintenance',
      description: 'AI-powered maintenance predictions and recommendations',
      icon: 'fa-chart-line',
      route: '/predictive-maintenance'
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private equipmentService: EquipmentService
  ) {}

  isAdmin = false;

  ngOnInit(): void {
    // Check if user is authenticated and has maintenance role
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    const userData = this.authService.getUserData();
    if (userData) {
      this.username = userData.username || 'Maintenance Staff';
      // Check if user is admin (to display back button)
      this.isAdmin = this.authService.isAdmin();
    }
    
    // Load pending equipment requests
    this.loadPendingRequests();
    
    // Set up polling for new requests every 30 seconds
    this.requestsSubscription = interval(30000).subscribe(() => {
      this.loadPendingRequests();
    });
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.requestsSubscription) {
      this.requestsSubscription.unsubscribe();
    }
  }
  
  /**
   * Load all pending equipment requests
   */
  loadPendingRequests(): void {
    this.requestsLoading = true;
    console.log('Loading all equipment requests...');
    
    // Load all equipment requests
    this.equipmentService.getPendingRequests().subscribe({
      next: (requests) => {
        console.log(`Received ${requests.length} requests:`, requests);
        // Process all requests, no filtering
        this.processReceivedRequests(requests);
      },
      error: (error) => {
        console.error('Error loading requests:', error);
        this.requestsLoading = false;
      }
    });
  }
  
  /**
   * Process received equipment requests
   */
  private processReceivedRequests(requests: EquipmentRequest[]): void {
    // Check if we have new requests
    if (requests.length > this.previousRequestCount) {
      this.hasNewRequests = true;
    }
    
    this.previousRequestCount = requests.length;
    this.equipmentRequests = requests;
    this.requestsLoading = false;
    
    console.log('Processed equipment requests:', this.equipmentRequests);
  }
  
  goBack(): void {
    // Navigate back to admin dashboard
    this.router.navigate(['/admin']);
  }
  
  navigateToFeature(featureId: string): void {
    const feature = this.features.find(f => f.id === featureId);
    if (feature) {
      this.router.navigate([feature.route]);
    }
  }

  /**
   * Approve an equipment request
   */
  approveRequest(requestId: number): void {
    this.equipmentService.approveRequest(requestId).subscribe({
      next: (updatedRequest) => {
        console.log('Request approved:', updatedRequest);
        // Remove the request from our list (or update status)
        this.updateRequestInList(requestId, 'approved');
      },
      error: (error) => {
        console.error('Error approving request:', error);
      }
    });
  }
  
  /**
   * Reject an equipment request
   */
  rejectRequest(requestId: number, reason: string = 'Not available'): void {
    this.equipmentService.rejectRequest(requestId, reason).subscribe({
      next: (response) => {
        console.log('Request rejected:', response);
        // Remove the request from our list (or update status)
        this.updateRequestInList(requestId, 'rejected');
      },
      error: (error) => {
        console.error('Error rejecting request:', error);
      }
    });
  }
  
  /**
   * Mark a request as fulfilled (equipment checked out)
   * Note: This uses the approveRequest method for now, as a dedicated fulfillRequest endpoint isn't implemented yet
   */
  fulfillRequest(requestId: number): void {
    // Update request status - use approveRequest as a substitute since there's no dedicated fulfill endpoint yet
    this.equipmentService.approveRequest(requestId).subscribe({
      next: (updatedRequest) => {
        if (updatedRequest) {
          console.log('Request fulfilled:', updatedRequest);
          // Update the request in our local array
          this.updateRequestInList(requestId, 'in_use');
        }
      },
      error: (error) => {
        console.error('Error fulfilling request:', error);
      }
    });
  }
  
  /**
   * Helper method to update or remove a request from the list
   */
  /**
   * Helper method for template to safely check equipment request status
   * This helps Angular template type checking when comparing to status values
   */
  checkStatus(request: EquipmentRequest, status: string): boolean {
    return request && request.status === status;
  }
  
  private updateRequestInList(requestId: number, status: 'in_use' | 'requested' | 'returned' | 'maintenance' | 'approved' | 'rejected'): void {
    const index = this.equipmentRequests.findIndex(req => req.id === requestId);
    if (index !== -1) {
      if (status === 'approved' || status === 'rejected' || status === 'in_use') {
        // Remove the request from the pending list
        this.equipmentRequests.splice(index, 1);
      } else {
        // Just update the status
        this.equipmentRequests[index].status = status;
      }
    }
    
    // Update the previous count to avoid false new request alerts
    this.previousRequestCount = this.equipmentRequests.length;
  }
  
  logout(): void {
    this.authService.logout().subscribe(() => {
      // Navigation is handled in the auth service
    });
  }
}
