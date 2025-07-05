import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SurgeryDataService, Surgery } from '../../services/surgery-data.service';

@Component({
  selector: 'app-outbound-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './outbound-tracking.component.html',
  styleUrls: ['./outbound-tracking.component.scss']
})
export class OutboundTrackingComponent implements OnInit {
  selectedSurgery: Surgery | null = null;
  surgeries: Surgery[] = [];
  loading = false;
  scanning = false;
  scanComplete = false;
  roomCleared = false;
  
  // Mock data for remaining items
  remainingItems: any[] = [];

  constructor(private surgeryDataService: SurgeryDataService) {}

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
    this.roomCleared = false;
  }

  goBack(): void {
    this.selectedSurgery = null;
    this.scanComplete = false;
  }

  startScan(): void {
    this.scanning = true;
    // Simulate scanning process
    setTimeout(() => {
      this.scanning = false;
      this.scanComplete = true;
      
      // In a real implementation, we would make an API call to:
      // POST /api/operation-sessions/{selectedSurgery.id}/outbound-check/
      
      // For now, let's simulate random results
      const hasRemainingItems = Math.random() > 0.5;
      this.roomCleared = !hasRemainingItems;
      
      if (hasRemainingItems) {
        // Simulate some remaining items
        const possibleItems = [
          { id: 1, name: 'Scalpel', type: 'instrument', location: 'Table' },
          { id: 2, name: 'Forceps', type: 'instrument', location: 'Floor' },
          { id: 3, name: 'Retractor', type: 'instrument', location: 'Sink' },
          { id: 4, name: 'Scissors', type: 'instrument', location: 'Counter' },
          { id: 5, name: 'Clamp', type: 'instrument', location: 'Cabinet' }
        ];
        
        const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items
        for (let i = 0; i < numItems; i++) {
          const randomIndex = Math.floor(Math.random() * possibleItems.length);
          this.remainingItems.push(possibleItems[randomIndex]);
          possibleItems.splice(randomIndex, 1);
        }
      }
    }, 2000);
  }
  
  markComplete(): void {
    if (this.selectedSurgery) {
      // In a real implementation, we would make an API call to mark all items retrieved
      // POST /api/instruments/retrieve-all/{surgery.id}
      
      this.remainingItems = [];
      this.roomCleared = true;
    }
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
}
