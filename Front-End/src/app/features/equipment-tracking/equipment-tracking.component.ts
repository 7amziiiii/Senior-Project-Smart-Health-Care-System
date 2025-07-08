import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, NavigationExtras } from '@angular/router';
import { EquipmentService } from '../../services/equipment.service';
import { SurgeryDataService } from '../../services/surgery-data.service';
import { LargeEquipment, SurgeryEquipment, EquipmentRequest } from '../../models/large-equipment.model';

@Component({
  selector: 'app-equipment-tracking',
  standalone: true,
  imports: [CommonModule],
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
  roomScanInProgress: boolean = false;
  roomScanComplete: boolean = false;
  roomId: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private equipmentService: EquipmentService,
    private surgeryDataService: SurgeryDataService
  ) {
    this.surgeryId = Number(this.route.snapshot.paramMap.get('surgeryId'));
  }

  ngOnInit(): void {
    console.log('Equipment Tracking initialized with surgery ID:', this.surgeryId);
    this.loadSurgeryEquipment();
    this.loadSurgeryName();
    // Get the room associated with the surgery and scan it
    this.loadRoomAndScan();
  }

  loadSurgeryName(): void {
    this.surgeryDataService.getSurgeryById(this.surgeryId).subscribe((surgery: any) => {
      if (surgery) {
        this.surgeryName = surgery.name;
        
        // If the surgery has a room specified, store it for scanning
        if (surgery.roomNumber) {
          this.roomId = surgery.roomNumber;
        }
      }
    });
  }

  /**
   * Loads surgery equipment from the API
   */
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
          
          // Initially separate equipment into normal list only
          // (in-room will come from the room scan)
          this.normalEquipment = [...this.equipmentList];
          
          // Get current request statuses for all equipment
          this.loadEquipmentRequestStatuses();
          
          console.log(`Loaded ${this.equipmentList.length} total equipment items`);
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
              
              // If equipment is approved, always mark it as available
              // This ensures approved equipment isn't shown as missing
              if (matchingRequest.status === 'approved') {
                item.isAvailable = true;
                console.log(`Equipment ${item.equipment.name} is approved, setting isAvailable=true`);
              }
              
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
    // Always go back to the dashboard with surgery and features context preserved
    const navigationExtras: NavigationExtras = {
      queryParams: { 
        showFeatures: 'true',
        keepSurgeryContext: 'true'
      }
    };
    
    // Navigate back to dashboard with the selected surgery preserved
    this.router.navigate(['/dashboard'], navigationExtras);
  }
  
  /**
   * Load the room associated with the surgery and scan it for equipment
   */
  loadRoomAndScan(): void {
    if (this.surgeryId <= 0) {
      console.error('Cannot scan room: Invalid surgery ID');
      return;
    }
    
    // Wait for room ID to be available from surgery data
    setTimeout(() => {
      if (!this.roomId) {
        console.warn('No room ID associated with this surgery. Using surgery ID as fallback.');
        this.roomId = this.surgeryId.toString();
      }
      
      this.scanRoom();
    }, 1000); // Wait a second for other data to load
  }
  
  /**
   * Scan the room for equipment using RFID technology
   */
  scanRoom(): void {
    if (!this.roomId) {
      console.error('Cannot scan room: No room ID available');
      return;
    }
    
    console.log(`Scanning room ${this.roomId} for equipment...`);
    this.roomScanInProgress = true;
    
    // Scan duration of 3 seconds
    this.equipmentService.scanRoom(this.roomId, 3).subscribe({
      next: (results) => {
        console.log('Room scan results:', results);
        console.log('Raw equipment_in_room data:', JSON.stringify(results.equipment_in_room || []));
        this.roomScanComplete = true;
        this.roomScanInProgress = false;
        
        // Reset in-room equipment list
        this.inRoomEquipment = [];
        
        // Process equipment found in the room (both expected and unexpected)
        // First, process equipment properly assigned to this room
        if (results && results.equipment_in_room && Array.isArray(results.equipment_in_room)) {
          console.log(`Found ${results.equipment_in_room.length} equipment items properly assigned to room`);
          
          // Map the equipment in room to our component model
          results.equipment_in_room.forEach((item: any) => {
            console.log('Processing scanned equipment item:', item.id, item.name);
            
            // Find the equipment in our full list (if it exists)
            const existingItem = this.equipmentList.find(e => 
              e.equipment && e.equipment.id === item.id
            );
            
            if (existingItem) {
              console.log('Found matching equipment in existing list:', existingItem);
              this.inRoomEquipment.push(existingItem);
              
              // Remove from normal list to avoid duplication
              const index = this.normalEquipment.findIndex(e => 
                e.equipment && e.equipment.id === item.id
              );
              if (index !== -1) {
                this.normalEquipment.splice(index, 1);
              }
            } else {
              console.log('Equipment not in full list, creating new object');
              // Handle equipment that was scanned but isn't in our full list
              // We need to create a new object that matches our component model
              const newEquipment: SurgeryEquipment = {
                equipment: item,
                surgery_id: this.surgeryId,
                equipment_id: item.id,
                isRequired: false,
                isAvailable: item.status === 'available',
                isRequested: false,
                requestStatus: undefined
              };
              
              console.log('Created new equipment object:', newEquipment);
              this.inRoomEquipment.push(newEquipment);
            }
          });
        }
        
        // Also process unexpected equipment (physically in the room but not assigned to it)
        if (results && results.unexpected_equipment && Array.isArray(results.unexpected_equipment)) {
          console.log(`Found ${results.unexpected_equipment.length} unexpected equipment items in room`);
          
          // Map the unexpected equipment to our component model
          results.unexpected_equipment.forEach((item: any) => {
            console.log('Processing unexpected equipment item:', item.id, item.name);
            
            // Find the equipment in our full list (if it exists)
            const existingItem = this.equipmentList.find(e => 
              e.equipment && e.equipment.id === item.id
            );
            
            if (existingItem) {
              console.log('Found matching equipment in existing list:', existingItem);
              this.inRoomEquipment.push(existingItem);
              
              // Remove from normal list to avoid duplication
              const index = this.normalEquipment.findIndex(e => 
                e.equipment && e.equipment.id === item.id
              );
              if (index !== -1) {
                this.normalEquipment.splice(index, 1);
              }
            } else {
              console.log('Unexpected equipment not in full list, creating new object');
              // Create a new object for this unexpected equipment
              const newEquipment: SurgeryEquipment = {
                equipment: item,
                surgery_id: this.surgeryId,
                equipment_id: item.id,
                isRequired: false,
                isAvailable: item.status === 'available',
                isRequested: false,
                requestStatus: undefined
              };
              
              console.log('Created new equipment object for unexpected item:', newEquipment);
              this.inRoomEquipment.push(newEquipment);
            }
          });
        }
        
        console.log(`Total: Found ${this.inRoomEquipment.length} items in room via RFID scan (including unexpected items)`);
        console.log(`${this.normalEquipment.length} equipment items not in room`);
        
        // Update request statuses for the new items
        this.loadEquipmentRequestStatuses();
      },
      error: (error) => {
        console.error('Error scanning room:', error);
        this.errorMessage = 'Failed to scan room for equipment: ' + 
          (error.error && error.error.detail ? error.error.detail : 'Server error');
        this.roomScanInProgress = false;
        
        // Fallback to location-based filtering
        this.fallbackToLocationFiltering();
      }
    });
  }
  
  /**
   * Fallback method that uses location string filtering if room scan fails
   * This is only used if the RFID scan fails completely
   */
  fallbackToLocationFiltering(): void {
    console.log('Falling back to location-based filtering...');
    
    // Reset arrays
    this.inRoomEquipment = [];
    this.normalEquipment = [];
    
    // Filter based on location string (original implementation)
    this.inRoomEquipment = this.equipmentList.filter(e => {
      return e.equipment && e.equipment.location && 
        e.equipment.location.toLowerCase().includes('room');
    });
    
    this.normalEquipment = this.equipmentList.filter(e => {
      return e.equipment && (!e.equipment.location || 
        !e.equipment.location.toLowerCase().includes('room'));
    });
    
    console.log(`Filtered ${this.inRoomEquipment.length} items for in-room equipment (fallback)`);
    console.log(`Filtered ${this.normalEquipment.length} items for normal equipment (fallback)`);
  }

}
