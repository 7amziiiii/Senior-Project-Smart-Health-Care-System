import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SurgeryDataService, Surgery } from '../../services/surgery-data.service';
import { SurgeryFilterPipe } from '../../pipes/surgery-filter.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SurgeryFilterPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  surgeries: Surgery[] = [];
  ongoingSurgeries: Surgery[] = [];
  upcomingSurgeries: Surgery[] = [];
  selectedSurgery: Surgery | null = null;
  showFeatures: boolean = false;
  isAdmin: boolean = false;
  searchTerm: string = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private surgeryDataService: SurgeryDataService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    // Check if the user is an admin
    this.isAdmin = this.authService.isAdmin();
    
    // Load all surgeries
    const surgeriesSub = this.surgeryDataService.getAllSurgeries().subscribe(surgeries => {
      this.surgeries = surgeries;
      
      // Filter surgeries by status
      this.ongoingSurgeries = this.surgeries.filter(surgery => surgery.status === 'ongoing');
      this.upcomingSurgeries = this.surgeries.filter(surgery => surgery.status === 'scheduled');
      
      // Check query params for navigation context
      this.route.queryParams.subscribe(params => {
        const showFeatures = params['showFeatures'] === 'true';
        const keepContext = params['keepSurgeryContext'] === 'true';
        
        if (showFeatures) {
          this.showFeatures = true;
          
          // If returning from a feature and keeping context, don't clear the surgery
          if (!keepContext) {
            // Only clear if we're not preserving context
            this.surgeryDataService.setSelectedSurgery(null);
          } else {
            // Get the currently selected surgery from service
            const currentSelectedSurgerySub = this.surgeryDataService.getSelectedSurgery().subscribe(surgery => {
              if (surgery) {
                this.selectedSurgery = surgery;
              }
            });
            this.subscriptions.push(currentSelectedSurgerySub);
          }
        } else {
          this.showFeatures = false;
          if (!keepContext) {
            this.surgeryDataService.setSelectedSurgery(null);
          }
        }
      });
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
