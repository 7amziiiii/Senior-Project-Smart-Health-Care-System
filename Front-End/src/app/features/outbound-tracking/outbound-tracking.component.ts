import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationExtras } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SurgeryDataService, Surgery } from '../../services/surgery-data.service';
import { OutboundTrackingService, OutboundTrackingResponse } from '../../services/outbound-tracking.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-outbound-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './outbound-tracking.component.html',
  styleUrls: ['./outbound-tracking.component.scss']
})

export class OutboundTrackingComponent implements OnInit, OnDestroy {
  selectedSurgery: Surgery | null = null;
  surgeries: Surgery[] = [];
  loading = false;
  scanning = false;
  scanComplete = false;
  roomCleared = false;
  activeTab: 'remaining' | 'leavet' | 'allreq' = 'remaining';
  
  // Data for tracking results
  remainingItems: any[] = [];
  remainingInstruments: any[] = [];
  remainingTrays: any[] = [];
  extraItems: any[] = [];
  extraInstruments: any[] = [];
  extraTrays: any[] = [];
  usedItems: any[] = [];
  lastScanTimestamp: string | null = null;
  
  // Polling
  private pollingSubscription: Subscription | null = null;
  private pollingInterval = 5000; // 5 seconds

  constructor(
    private surgeryDataService: SurgeryDataService,
    private outboundService: OutboundTrackingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loading = true;
    
    // First check if a surgery was selected from dashboard
    this.surgeryDataService.getSelectedSurgery().subscribe(surgery => {
      if (surgery) {
        // If we have a selected surgery from the dashboard, use that
        this.selectedSurgery = surgery;
        this.loading = false;
        // Start polling when surgery is selected
        this.startPolling();
      } else {
        // Fallback to getting all surgeries only if no selected surgery
        this.surgeryDataService.getAllSurgeries().subscribe(
          (data: Surgery[]) => {
            this.surgeries = data;
            this.loading = false;
          },
          (error: any) => {
            console.error('Error fetching surgeries', error);
            this.loading = false;
          }
        );
      }
    });
  }

  selectSurgery(surgery: Surgery): void {
    this.selectedSurgery = surgery;
    this.scanComplete = false;
    this.remainingItems = [];
    this.remainingInstruments = [];
    this.remainingTrays = [];
    this.extraItems = [];
    this.extraInstruments = [];
    this.extraTrays = [];
    this.usedItems = [];
    this.roomCleared = false;
    
    // Start polling when surgery is selected
    this.startPolling();
  }

  goBack(): void {
    // Always go back to the dashboard with surgery and features context preserved
    const navigationExtras: NavigationExtras = {
      queryParams: { 
        showFeatures: 'true',
        keepSurgeryContext: 'true'
      }
    };
    
    // Stop polling when going back
    this.stopPolling();
    
    // Navigate back to dashboard with the selected surgery preserved
    this.router.navigate(['/dashboard'], navigationExtras);
  }

  startScan(): void {
    if (!this.selectedSurgery) return;
    
    this.scanning = true;
    
    // Make actual API call to scan for outbound tracking
    this.outboundService.scanOutbound(this.selectedSurgery.id).subscribe({
      next: (response) => {
        this.scanning = false;
        this.scanComplete = true;
        this.processTrackingResponse(response);
      },
      error: (error) => {
        console.error('Error during outbound scanning:', error);
        this.scanning = false;
        // Consider showing an error message to the user
      }
    });
  }
  
  markComplete(): void {
    // This function would be updated when there's an API endpoint to mark items as retrieved
    // For now, we'll update the local state only
    if (this.selectedSurgery) {
      this.remainingItems = [];
      this.roomCleared = true;
    }
  }
  
  /**
   * Start polling for outbound tracking status updates
   */
  private startPolling(): void {
    // Stop any existing polling
    this.stopPolling();
    
    // Start a new polling interval
    this.pollingSubscription = interval(this.pollingInterval).subscribe(() => {
      if (this.selectedSurgery && !this.scanning) {
        this.refreshOutboundStatus();
      }
    });
  }
  
  /**
   * Stop polling for outbound tracking status updates
   */
  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }
  
  /**
   * Refresh the outbound tracking status from the API
   */
  private refreshOutboundStatus(): void {
    if (!this.selectedSurgery) return;
    
    this.outboundService.getOutboundStatus(this.selectedSurgery.id).subscribe({
      next: (response) => {
        this.processTrackingResponse(response);
      },
      error: (error) => {
        console.error('Error fetching outbound tracking status:', error);
      }
    });
  }
  
  /**
   * Process the response from the outbound tracking API
   */
  private processTrackingResponse(response: OutboundTrackingResponse): void {
    this.roomCleared = response.room_cleared;
    this.lastScanTimestamp = response.scan_time || null;
    
    console.log('Processing outbound tracking response:', response);
    
    // Process remaining items - convert dictionary to array with proper type tagging
    const formattedRemainingInstruments = Object.entries(response.remaining_items.instruments || {}).map(([name, item]) => ({
      ...item,
      name: name,  // Use the key (name) as the item name
      type: 'instrument',
      quantity: item.quantity || 0,
      ids: item.ids || []
    }));
    
    const formattedRemainingTrays = Object.entries(response.remaining_items.trays || {}).map(([name, item]) => ({
      ...item,
      name: name,  // Use the key (name) as the item name
      type: 'tray',
      quantity: item.quantity || 0,
      ids: item.ids || []
    }));
    
    // Set separate arrays for instruments and trays
    this.remainingInstruments = formattedRemainingInstruments;
    this.remainingTrays = formattedRemainingTrays;
    
    // Combine all remaining items for backward compatibility
    this.remainingItems = [...formattedRemainingInstruments, ...formattedRemainingTrays];
    
    // Process extra items - convert dictionary to array with proper type tagging
    const formattedExtraInstruments = Object.entries(response.extra_items.instruments || {}).map(([name, item]) => ({
      ...item,
      name: name,  // Use the key (name) as the item name
      type: 'instrument',
      quantity: item.quantity || 0,
      ids: item.ids || []
    }));
    
    const formattedExtraTrays = Object.entries(response.extra_items.trays || {}).map(([name, item]) => ({
      ...item,
      name: name,  // Use the key (name) as the item name
      type: 'tray',
      quantity: item.quantity || 0,
      ids: item.ids || []
    }));
    
    // Set separate arrays for instruments and trays
    this.extraInstruments = formattedExtraInstruments;
    this.extraTrays = formattedExtraTrays;
    
    // Combine all extra items for backward compatibility
    this.extraItems = [...formattedExtraInstruments, ...formattedExtraTrays];
    
    // Process used items - convert dictionary to array with proper type tagging
    const formattedUsedItems: Array<{
      name: string;
      type: string;
      quantity: number;
      ids: number[];
      [key: string]: any;
    }> = [];
    
    // Process used instruments
    Object.entries(response.used_items?.instruments || {}).forEach(([name, item]) => {
      formattedUsedItems.push({
        ...item,
        name: name,
        type: 'instrument',
        quantity: item.quantity || 0,
        ids: item.ids || []
      });
    });
    
    // Process used trays
    Object.entries(response.used_items?.trays || {}).forEach(([name, item]) => {
      formattedUsedItems.push({
        ...item,
        name: name,
        type: 'tray',
        quantity: item.quantity || 0,
        ids: item.ids || []
      });
    });
    
    this.usedItems = formattedUsedItems;
    
    console.log('Processed remaining instruments:', this.remainingInstruments);
    console.log('Processed remaining trays:', this.remainingTrays);
    console.log('Processed extra instruments:', this.extraInstruments);
    console.log('Processed extra trays:', this.extraTrays);
  }
  
  // Helper methods for template
  hasOngoingSurgeries(): boolean {
    return this.surgeries.some(s => s.status === 'ongoing');
  }
  
  hasCompletedSurgeries(): boolean {
    return this.surgeries.some(s => s.status === 'completed');
  }
  
  isSurgeryOngoing(surgery: Surgery): boolean {
    return surgery.status === 'ongoing';
  }
  
  isSurgeryCompleted(surgery: Surgery): boolean {
    return surgery.status === 'completed';
  }
  
  /**
   * Check if an item is remaining in the room
   * @param itemName Name of the item to check
   * @param itemType Type of the item (instrument or tray)
   * @returns True if the item is still in the room, false if retrieved
   */
  isItemRemaining(itemName: string, itemType: string): boolean {
    // Check instruments
    if (itemType.toLowerCase() === 'instrument') {
      return this.remainingInstruments.some(item => item.name === itemName);
    }
    // Check trays
    else if (itemType.toLowerCase() === 'tray') {
      return this.remainingTrays.some(item => item.name === itemName);
    }
    return false;
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.stopPolling();
  }
}
