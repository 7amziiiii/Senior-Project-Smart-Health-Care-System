import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AdminService, PendingUser } from '../../services/admin.service';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  pendingUsers: PendingUser[] = [];
  loading = false;
  error = '';
  successMessage = '';
  processingUsers: { [key: number]: boolean } = {};
  
  constructor(
    private adminService: AdminService, 
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPendingUsers();
  }

  loadPendingUsers(): void {
    this.loading = true;
    this.error = '';
    
    this.adminService.getPendingUsers()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (users) => {
          this.pendingUsers = users;
        },
        error: (err) => {
          console.error('Error fetching pending users:', err);
          this.error = 'Failed to load pending users. Please try again.';
        }
      });
  }
  
  approveUser(user: PendingUser): void {
    if (this.processingUsers[user.id]) {
      return; // Already processing this user
    }
    
    this.processingUsers[user.id] = true;
    this.error = '';
    this.successMessage = '';
    
    this.adminService.approveUser(user.id)
      .pipe(finalize(() => this.processingUsers[user.id] = false))
      .subscribe({
        next: () => {
          // Remove the approved user from the list
          this.pendingUsers = this.pendingUsers.filter(u => u.id !== user.id);
          this.successMessage = `User ${user.username} has been approved successfully.`;
        },
        error: (err) => {
          console.error('Error approving user:', err);
          this.error = `Failed to approve user ${user.username}. Please try again.`;
        }
      });
  }
  
  /**
   * Log out the current user and redirect to login page
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

}
