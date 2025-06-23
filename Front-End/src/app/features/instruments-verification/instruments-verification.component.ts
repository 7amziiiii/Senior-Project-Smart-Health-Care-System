import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SurgeryDataService, Surgery, Instrument } from '../../services/surgery-data.service';

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
  private subscriptions: Subscription[] = [];
  
  constructor(private surgeryDataService: SurgeryDataService) {}
  
  ngOnInit(): void {
    // Get surgeries as Observable and subscribe to changes
    const surgeriesSub = this.surgeryDataService.getAllSurgeries().subscribe(surgeries => {
      this.surgeries = surgeries;
    });
    
    // Subscribe to selected surgery changes
    const selectedSurgerySub = this.surgeryDataService.getSelectedSurgery().subscribe((surgery: Surgery | null) => {
      this.selectedSurgery = surgery;
    });
    
    // Store subscriptions for cleanup
    this.subscriptions.push(surgeriesSub, selectedSurgerySub);
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
  }
}
