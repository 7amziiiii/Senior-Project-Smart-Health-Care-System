import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { SurgeryDataService, Surgery } from './services/surgery-data.service';
import { filter, map } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'or-front';
  isLoggedIn = false;
  isAdmin = false;
  currentFeature: string | null = null;
  isAuthPage = false;
  isMaintenanceRoute = false;
  selectedSurgery: Surgery | null = null;
  private subscriptions: Subscription[] = [];
  
  constructor(
    private router: Router,
    private authService: AuthService,
    private surgeryDataService: SurgeryDataService
  ) {}
  
  ngOnInit() {
    // Check authentication status
    this.isLoggedIn = !!this.authService.getToken();
    
    if (this.isLoggedIn) {
      // Use authService's isAdmin method instead of simplified check
      this.isAdmin = this.authService.isAdmin();
      
      // Subscribe to selected surgery for breadcrumb navigation
      const surgerySub = this.surgeryDataService.getSelectedSurgery().subscribe(surgery => {
        this.selectedSurgery = surgery;
        console.log('Selected surgery updated:', surgery);
      });
      this.subscriptions.push(surgerySub);
    }
    
    // Track current page and feature for navigation
    const routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => event as NavigationEnd)
    ).subscribe(event => {
      // Get current URL
      const url = event.urlAfterRedirects || event.url;
      
      // Check if on auth page (login or register)
      this.isAuthPage = url.includes('/login') || url.includes('/register');
      
      // Check if on maintenance routes
      this.isMaintenanceRoute = url.includes('/maintenance') || 
                               url.includes('/equipment-overview') || 
                               url.includes('/predictive-maintenance');
      
      // Update currentFeature based on URL
      if (url.includes('/dashboard') || url === '/') {
        this.currentFeature = 'OR Dashboard';
      } else if (url.includes('/instruments-verification')) {
        this.currentFeature = 'Instruments Verification';
      } else if (url.includes('/outbound-tracking')) {
        this.currentFeature = 'Outbound Tracking';
      } else if (url.includes('/large-equipment-tracking')) {
        this.currentFeature = 'Large Equipment Tracking';
      } else if (url.includes('/maintenance')) {
        this.currentFeature = 'Maintenance Dashboard';
      } else if (url.includes('/equipment-overview')) {
        this.currentFeature = 'Equipment Overview';
      } else if (url.includes('/predictive-maintenance')) {
        this.currentFeature = 'Predictive Maintenance';
      } else {
        this.currentFeature = null;
      }
      
      console.log('Navigation:', { 
        url, 
        isAuthPage: this.isAuthPage, 
        feature: this.currentFeature,
        selectedSurgery: this.selectedSurgery?.name
      });
    });
    
    this.subscriptions.push(routerSub);
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  navigateBack() {
    // If we're in a maintenance sub-feature, go back to main maintenance dashboard
    if (this.isMaintenanceRoute && this.currentFeature && this.currentFeature !== 'Maintenance Dashboard') {
      this.router.navigate(['/maintenance']);
      return;
    }
    // If we're in the main maintenance dashboard (as admin), go back to admin dashboard
    else if (this.isMaintenanceRoute && this.currentFeature === 'Maintenance Dashboard' && this.isAdmin) {
      this.router.navigate(['/admin']);
      return;
    }
    // If we're in an OR feature, go back to feature selection for this surgery
    else if (!this.isMaintenanceRoute && this.currentFeature && this.currentFeature !== 'OR Dashboard') {
      // Navigate back to dashboard with the surgery still selected
      this.router.navigate(['/dashboard'], { 
        queryParams: { 
          showFeatures: 'true', 
          keepSurgeryContext: 'true' 
        }
      });
    } 
    // If we're in the surgery selection view (dashboard with a selected surgery)
    else if (!this.isMaintenanceRoute && this.selectedSurgery && this.currentFeature === 'OR Dashboard') {
      // Clear selected surgery and go back to surgeries list
      this.selectedSurgery = null;
      this.surgeryDataService.setSelectedSurgery(null);
      this.router.navigate(['/dashboard'], {
        queryParams: {
          showFeatures: 'false'
        }
      });
      console.log('Navigating back to surgeries list');
    }
  }
  
  ngOnDestroy() {
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
