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
      const user = this.authService.getUserData();
      this.isAdmin = user?.is_staff || user?.is_superuser || false;
      
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
      
      // Update currentFeature based on URL
      if (url.includes('/dashboard') || url === '/') {
        this.currentFeature = 'OR Dashboard';
      } else if (url.includes('/instruments-verification')) {
        this.currentFeature = 'Instruments Verification';
      } else if (url.includes('/outbound-tracking')) {
        this.currentFeature = 'Outbound Tracking';
      } else if (url.includes('/large-equipment-tracking')) {
        this.currentFeature = 'Large Equipment Tracking';
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
    // If we're in a feature, go back to the feature selection for this surgery
    if (this.currentFeature && this.currentFeature !== 'OR Dashboard') {
      // Navigate back to dashboard with the surgery still selected
      this.router.navigate(['/dashboard'], { 
        queryParams: { 
          showFeatures: 'true', 
          keepSurgeryContext: 'true' 
        }
      });
    } 
    // If we're in the surgery selection view (dashboard with a selected surgery)
    else if (this.selectedSurgery && this.currentFeature === 'OR Dashboard') {
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
