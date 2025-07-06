import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  
  // Data for tracking results
  remainingItems: any[] = [];
  usedItems: any[] = [];
  lastScanTimestamp: string | null = null;
  
  // Polling
  private pollingSubscription: Subscription | null = null;
  private pollingInterval = 5000; // 5 seconds

  constructor(
    private surgeryDataService: SurgeryDataService,
    private outboundService: OutboundTrackingService
  ) {}

  ngOnInit(): void {
    this.loading = true;
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

  selectSurgery(surgery: Surgery): void {
    this.selectedSurgery = surgery;
    this.scanComplete = false;
    this.remainingItems = [];
    this.usedItems = [];
    this.roomCleared = false;
    
    // Start polling when surgery is selected
    this.startPolling();
  }

  goBack(): void {
    this.selectedSurgery = null;
    this.scanComplete = false;
    
    // Stop polling when going back
    this.stopPolling();
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
    this.lastScanTimestamp = response.scan_timestamp || null;
    
    // Process remaining items
    this.remainingItems = [
      ...(response.remaining_items.instruments || []),
      ...(response.remaining_items.trays || [])
    ];
    
    // Process used items
    this.usedItems = [
      ...(response.used_items.instruments || []),
      ...(response.used_items.trays || [])
    ];
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
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.stopPolling();
  }
}
