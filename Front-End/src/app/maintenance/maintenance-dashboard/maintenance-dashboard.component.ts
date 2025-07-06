import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-maintenance-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './maintenance-dashboard.component.html',
  styleUrls: ['./maintenance-dashboard.component.scss']
})
export class MaintenanceDashboardComponent implements OnInit {
  username: string = '';
  featureSelected: string | null = null;
  
  // Features available in the maintenance dashboard
  features = [
    {
      id: 'equipment-overview',
      title: 'Equipment Overview',
      description: 'Monitor all hospital equipment status, location, and maintenance needs',
      icon: 'fa-tools',
      route: '/equipment-overview'
    },
    {
      id: 'predictive-maintenance',
      title: 'Predictive Maintenance',
      description: 'AI-powered maintenance predictions and recommendations',
      icon: 'fa-chart-line',
      route: '/predictive-maintenance'
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated and has maintenance role
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    const userData = this.authService.getUserData();
    if (userData) {
      this.username = userData.username || 'Maintenance Staff';
    }
  }
  
  navigateToFeature(featureId: string): void {
    const feature = this.features.find(f => f.id === featureId);
    if (feature) {
      this.router.navigate([feature.route]);
    }
  }
  
  logout(): void {
    this.authService.logout().subscribe(() => {
      // Navigation is handled in the auth service
    });
  }
}
