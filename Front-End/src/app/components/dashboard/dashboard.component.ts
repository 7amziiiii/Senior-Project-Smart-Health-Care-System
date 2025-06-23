import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SurgeryDataService, Surgery } from '../../services/surgery-data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  surgeries: Surgery[] = [];
  ongoingSurgeries: Surgery[] = [];
  upcomingSurgeries: Surgery[] = [];
  selectedSurgery: Surgery | null = null;
  showFeatures: boolean = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private surgeryDataService: SurgeryDataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    // Load all surgeries
    const surgeriesSub = this.surgeryDataService.getAllSurgeries().subscribe(surgeries => {
      this.surgeries = surgeries;
      
      // Filter surgeries by status
      this.ongoingSurgeries = this.surgeries.filter(surgery => surgery.status === 'ongoing');
      this.upcomingSurgeries = this.surgeries.filter(surgery => surgery.status === 'scheduled');
      
      // Clear any previously selected surgery
      this.surgeryDataService.setSelectedSurgery(null);
      this.showFeatures = false;
    });
    
    this.subscriptions.push(surgeriesSub);
  }

  selectSurgery(surgery: Surgery): void {
    this.selectedSurgery = surgery;
    this.surgeryDataService.setSelectedSurgery(surgery);
    this.showFeatures = true;
  }

  navigateToFeature(featurePath: string): void {
    if (!this.selectedSurgery) {
      alert('Please select a surgery first');
      return;
    }
    this.router.navigate([`/${featurePath}`]);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
