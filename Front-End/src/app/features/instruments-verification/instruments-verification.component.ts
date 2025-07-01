import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SurgeryDataService, Surgery, Instrument } from '../../services/surgery-data.service';
import { VerificationService, VerificationStatus } from '../../services/verification.service';

@Component({
  selector: 'app-instruments-verification',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './instruments-verification.component.html',
  styleUrls: ['./instruments-verification.component.scss']
})
export class InstrumentsVerificationComponent implements OnInit, OnDestroy {
  surgeries: Surgery[] = [];
  selectedSurgery: Surgery | null = null;
  verificationStatus: VerificationStatus | null = null;
  isVerifying: boolean = false;
  private subscriptions: Subscription[] = [];
  
  constructor(
    private surgeryDataService: SurgeryDataService,
    private verificationService: VerificationService
  ) {}
  
  ngOnInit(): void {
    // Get surgeries as Observable and subscribe to changes
    const surgeriesSub = this.surgeryDataService.getAllSurgeries().subscribe(surgeries => {
      this.surgeries = surgeries;
    });
    
    // Subscribe to selected surgery changes
    const selectedSurgerySub = this.surgeryDataService.getSelectedSurgery().subscribe((surgery: Surgery | null) => {
      this.selectedSurgery = surgery;
      
      // When a surgery is selected, start verification polling
      if (surgery) {
        this.startVerificationPolling(surgery.id);
      } else {
        this.stopVerificationPolling();
      }
    });
    
    // Subscribe to verification status updates
    const verificationSub = this.verificationService.getVerificationStatus().subscribe(status => {
      this.verificationStatus = status;
      console.log('Verification status updated:', status);
    });
    
    // Store subscriptions for cleanup
    this.subscriptions.push(surgeriesSub, selectedSurgerySub, verificationSub);
  }
  
  selectSurgery(surgery: Surgery | null): void {
    this.surgeryDataService.setSelectedSurgery(surgery);
  }
  
  getInstrumentsInRoom(): Instrument[] {
    if (!this.selectedSurgery) return [];
    return this.surgeryDataService.getInstrumentsInRoom(this.selectedSurgery);
  }
  
  getInstrumentsNotInRoom(): Instrument[] {
    if (!this.selectedSurgery) return [];
    return this.surgeryDataService.getInstrumentsNotInRoom(this.selectedSurgery);
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Stop any active verification polling
    this.stopVerificationPolling();
  }
  
  /**
   * Start polling for verification status
   */
  startVerificationPolling(sessionId: number): void {
    this.isVerifying = true;
    this.verificationService.startVerificationPolling(sessionId);
  }
  
  /**
   * Stop verification polling
   */
  stopVerificationPolling(): void {
    this.isVerifying = false;
    this.verificationService.stopVerificationPolling();
  }
  
  /**
   * Force an immediate verification scan
   */
  forceVerificationScan(): void {
    if (this.selectedSurgery) {
      this.verificationService.forceUpdate();
    }
  }
  
  /**
   * Get items count by category
   */
  getItemsCount(category: 'used' | 'missing' | 'extra' | 'available', type: 'instruments' | 'trays'): number {
    if (!this.verificationStatus) return 0;
    
    const itemsMap = this.verificationStatus[`${category}_items`][type];
    if (!itemsMap) return 0;
    
    return Object.values(itemsMap).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
  }
}
