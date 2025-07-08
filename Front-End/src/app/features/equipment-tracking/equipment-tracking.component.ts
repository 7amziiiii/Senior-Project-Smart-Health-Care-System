import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EquipmentService } from '../../services/equipment.service';
import { SurgeryDataService } from '../../services/surgery-data.service';
import { LargeEquipment, SurgeryEquipment, EquipmentRequest } from '../../models/large-equipment.model';

@Component({
  selector: 'app-equipment-tracking',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './equipment-tracking.component.html',
  styleUrl: './equipment-tracking.component.scss'
})
export class EquipmentTrackingComponent implements OnInit {
  surgeryId: number = 0;
  surgeryName: string = '';
  equipmentList: SurgeryEquipment[] = [];
  inRoomEquipment: SurgeryEquipment[] = [];
  normalEquipment: SurgeryEquipment[] = [];
  loading: boolean = true;
  errorMessage: string = '';
  availableEquipmentCount: number = 0;
  missingEquipmentCount: number = 0;
  requestInProgress: boolean = false;
  requestSent: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private equipmentService: EquipmentService,
    private surgeryService: SurgeryDataService
  ) {
    this.surgeryId = Number(this.route.snapshot.paramMap.get('surgeryId'));
  }

  ngOnInit(): void {
    console.log('Equipment Tracking initialized with surgery ID:', this.surgeryId);
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
    console.log(`Fetching equipment for surgery ID: ${this.surgeryId}`);
    
    this.equipmentService.getOperationSessionEquipment(this.surgeryId).subscribe({
      next: (data) => {
        console.log('API Response Raw Data:', data);
        
        // Check if we got error response instead of data array
        if (data && typeof data === 'object' && 'error' in data) {
          this.errorMessage = typeof data.error === 'string' ? data.error : 'Unknown API error';
          this.loading = false;
          console.error('API returned error:', data.error);
          return;
        }
        
        this.equipmentList = Array.isArray(data) ? data : [];
        console.log(`Received ${this.equipmentList.length} equipment items`);
        
        // Initialize arrays to empty to prevent any stale data
        this.inRoomEquipment = [];
        this.normalEquipment = [];
        
        // Only populate arrays if we have actual data
        if (this.equipmentList.length > 0) {
          // Check first item to debug expected structure
          const sample = this.equipmentList[0];
          console.log('Sample equipment item structure:', JSON.stringify(sample || {}));
          
          // Separate equipment into in-room and normal lists
          this.inRoomEquipment = this.equipmentList.filter(e => {
            return e.equipment && e.equipment.location && 
              e.equipment.location.toLowerCase().includes('room');
          });
          
          this.normalEquipment = this.equipmentList.filter(e => {
            return e.equipment && (!e.equipment.location || 
              !e.equipment.location.toLowerCase().includes('room'));
          });
          
          // Get current request statuses for all equipment
          this.loadEquipmentRequestStatuses();
          
          console.log(`Filtered ${this.inRoomEquipment.length} items for in-room equipment`);
          console.log(`Filtered ${this.normalEquipment.length} items for normal equipment`);
        } else {
          console.log('No equipment data received from API');
        }
        
        // Calculate equipment counts
        this.availableEquipmentCount = this.equipmentList.filter(e => e.isAvailable).length;
        this.missingEquipmentCount = this.equipmentList.filter(e => !e.isAvailable).length;
        
        console.log(`Available: ${this.availableEquipmentCount}, Missing: ${this.missingEquipmentCount}`);
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load equipment list';
        this.loading = false;
        console.error('Network error loading equipment:', error);
      }
    });
  }

  // Load equipment request statuses - this method will be called on initialization and can be manually triggered
  loadEquipmentRequestStatuses(): void {
    if (!this.surgeryId) {
      console.warn('Cannot load equipment requests - no surgery ID available');
      return;
    }
    
    console.log(`Loading equipment request statuses for surgery ID: ${this.surgeryId}`);
    
    // Get all equipment requests for this surgery - ALWAYS force a fresh API call
    this.equipmentService.getEquipmentRequests(true).subscribe({
      next: (requests: EquipmentRequest[]) => {
        console.log(`Got ${requests?.length || 0} total equipment requests from API`);
        
        if (!requests || !Array.isArray(requests)) {
          console.warn('No equipment requests found or invalid response');
          return;
        }
        
        // DEBUG: Log all equipment requests to check their structure
        console.log('All equipment requests:', JSON.stringify(requests));
        
        // Filter requests for this surgery
        const surgeryRequests = requests.filter(req => 
          req.operation_session === this.surgeryId);
        
        console.log(`Found ${surgeryRequests.length} requests for surgery ${this.surgeryId}:`, 
          JSON.stringify(surgeryRequests));
        
        // Update request status for each equipment item
        const updateRequestStatus = (list: SurgeryEquipment[]) => {
          if (!list || !Array.isArray(list)) {
            console.warn('Cannot update equipment list - invalid list provided');
            return;
          }
          
          list.forEach(item => {
            if (!item || !item.equipment) {
              console.warn('Skipping invalid equipment item');
              return;
            }
            
            // Find if this equipment has a request (any status)
            const matchingRequest = surgeryRequests.find(req => {
              // Check both req.equipment.id and req.equipment (if it's a direct ID reference)
              const reqEquipId = req.equipment?.id || req.equipment;
              return reqEquipId === item.equipment.id;
            });
            
            // Check if we found a request and update the item
            if (matchingRequest) {
              // Store the request ID for future reference
              item.requestId = matchingRequest.id;
              
              // Set both the new requestStatus and legacy isRequested flag
              item.requestStatus = matchingRequest.status;
              item.isRequested = true;
              
              console.log(`Updated equipment status: ${item.equipment.name} ` + 
                `(ID: ${item.equipment.id}) - Status: ${matchingRequest.status}, ` + 
                `Request ID: ${matchingRequest.id}`);
            } else {
              // No matching request found, ensure requestStatus is cleared
              item.requestStatus = undefined;
              item.isRequested = false;
              item.requestId = undefined;
              
              console.log(`No request found for equipment: ${item.equipment.name} ` + 
                `(ID: ${item.equipment.id})`);
            }
          });
        };
        
        // Apply updates to both lists
        updateRequestStatus(this.inRoomEquipment);
        updateRequestStatus(this.normalEquipment);
      },
      error: (error: any) => {
        console.error('Error loading equipment requests:', error);
      },
      complete: () => {
        console.log('Equipment request status update complete');
      }
    });
  }

  requestEquipment(equipment: LargeEquipment): void {
    this.requestInProgress = true;
    this.errorMessage = ''; // Clear any previous error messages
    
    console.log(`Requesting equipment ${equipment.id} for surgery ${this.surgeryId}`);
    
    // First, update UI state immediately to prevent button disappearing
    const updateEquipmentInList = (list: SurgeryEquipment[]) => {
      const index = list.findIndex(e => e.equipment && e.equipment.id === equipment.id);
      if (index !== -1) {
        console.log('Setting temporary requested state for equipment:', equipment.id);
        list[index].requestStatus = 'requested';
        list[index].isRequested = true;
      }
    };
    
    // Apply immediate UI updates
    updateEquipmentInList(this.inRoomEquipment);
    updateEquipmentInList(this.normalEquipment);
    
    // Then make the API call
    this.equipmentService.requestEquipment(this.surgeryId, equipment.id).subscribe({
      next: (response: any) => {
        console.log('Request successful:', response);
        this.requestSent = true;
        this.requestInProgress = false;
        
        // Process the response to extract the new request ID and status
        const requestId = response?.id;
        const requestStatus = response?.status || 'requested';
        
        console.log(`Created request ID: ${requestId}, Status: ${requestStatus}`);
        
        // Update the equipment status in both lists with confirmed data
        const finalizeEquipmentInList = (list: SurgeryEquipment[]) => {
          const index = list.findIndex(e => e.equipment && e.equipment.id === equipment.id);
        
          if (index !== -1) {
            console.log('Updating equipment state:', {
              id: list[index].equipment.id,
              oldStatus: list[index].requestStatus || 'none',
              newStatus: requestStatus
            });
            
            // Set request status to server response status
            list[index].requestStatus = requestStatus;
            // Maintain backwards compatibility with isRequested flag
            list[index].isRequested = true;
            
            // Store the request ID for future reference
            list[index].requestId = requestId;
            
            // Always preserve the actual equipment status
            if (response && response.equipment_status) {
              // Cast the status to the appropriate type to avoid TypeScript errors
              list[index].equipment.status = response.equipment_status as 'available' | 'in_use' | 'under_repair' | 'scheduled_maintenance';
            }
            
            // Equipment is available if it has an 'available' status
            // This is independent of whether it's been requested
            list[index].isAvailable = (list[index].equipment.status === 'available');
          }
        };
        
        // Update in both lists
        updateEquipmentInList(this.inRoomEquipment);
        updateEquipmentInList(this.normalEquipment);
        
        // Recalculate counts
        this.availableEquipmentCount = this.equipmentList.filter(e => e.isAvailable).length;
        this.missingEquipmentCount = this.equipmentList.filter(e => !e.isAvailable).length;
        
        // Refresh equipment requests from server to ensure all components have latest data
        this.equipmentService.loadEquipmentRequests(true).subscribe({
          next: () => console.log('Equipment requests refreshed after request'),
          error: (refreshError) => console.error('Error refreshing requests after operation:', refreshError)
        });
        
        // Automatically clear success message after 5 seconds
        setTimeout(() => {
          this.requestSent = false;
        }, 5000);
      },
      error: (error) => {
        this.errorMessage = 'Failed to request equipment: ' + 
          (error.error && error.error.detail ? error.error.detail : 'Server error');
        this.requestInProgress = false;
        console.error('Error requesting equipment:', error);
        
        // Automatically clear error message after 5 seconds
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
  

}
