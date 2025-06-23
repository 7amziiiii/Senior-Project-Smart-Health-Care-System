import { Component, OnInit } from '@angular/core';
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
export class InstrumentsVerificationComponent implements OnInit {
  surgeries: Surgery[] = [];
  selectedSurgery: Surgery | null = null;
  
  constructor(private surgeryDataService: SurgeryDataService) {}
  
  ngOnInit(): void {
    this.surgeries = this.surgeryDataService.getAllSurgeries();
    
    // Subscribe to selected surgery changes
    this.surgeryDataService.getSelectedSurgery().subscribe((surgery: Surgery | null) => {
      this.selectedSurgery = surgery;
    });
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
}
