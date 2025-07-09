import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, User } from '../../services/admin.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  loading = false;
  error = '';
  successMessage = '';
  selectedRoleFilter = 'all';
  
  // Edit mode properties
  editMode = false;
  selectedUser: User | null = null;
  
  // Role options (matches backend choices)
  roleOptions = [
    { value: 'nurse', label: 'Nurse' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'admin', label: 'Admin' }
  ];
  
  // Processing flags
  processingUsers: { [key: number]: boolean } = {};

  // User role accessor for two-way binding
  get userRole(): string {
    if (!this.selectedUser) return '';
    return this.selectedUser.profile?.role || this.selectedUser.role || '';
  }

  set userRole(value: string) {
    if (!this.selectedUser) return;
    
    if (this.selectedUser.profile) {
      this.selectedUser.profile.role = value;
    } else {
      this.selectedUser.role = value;
    }
  }

  constructor(private adminService: AdminService) { }

  ngOnInit(): void {
    this.loadUsers();
  }
  
  /**
   * Load all users based on selected role filter
   */
  loadUsers(): void {
    this.loading = true;
    this.error = '';
    
    console.log(`Loading users with role filter: ${this.selectedRoleFilter}`);
    console.log('AdminService simulationMode:', (this.adminService as any).simulationMode);
    console.log('API URL:', (this.adminService as any).apiUrl);
    
    this.adminService.getAllUsers(this.selectedRoleFilter)
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: (users) => {
          console.log(`Received ${users.length} users:`, users);
          this.users = users;
        },
        error: (err) => {
          console.error('Error fetching users:', err);
          this.error = 'Failed to load users. Please try again.';
        }
      });
  }
  
  /**
   * Filter users by role
   */
  filterByRole(role: string): void {
    this.selectedRoleFilter = role;
    this.loadUsers();
  }
  
  /**
   * Edit a user
   */
  editUser(user: User): void {
    this.selectedUser = { ...user }; // Create a copy to avoid modifying the original
    this.editMode = true;
  }
  
  /**
   * Save user changes
   */
  saveUser(): void {
    if (!this.selectedUser) return;
    
    const userId = this.selectedUser.id;
    this.processingUsers[userId] = true;
    this.error = '';
    this.successMessage = '';
    
    // Extract the editable fields
    const userData: Partial<User> = {
      username: this.selectedUser.username,
      email: this.selectedUser.email,
      first_name: this.selectedUser.first_name,
      last_name: this.selectedUser.last_name,
      is_active: this.selectedUser.is_active,
      role: this.selectedUser.profile?.role || this.selectedUser.role
    };
    
    this.adminService.updateUser(userId, userData)
      .pipe(finalize(() => {
        this.processingUsers[userId] = false;
      }))
      .subscribe({
        next: (updatedUser) => {
          // Find and update the user in the list
          const index = this.users.findIndex(u => u.id === userId);
          if (index !== -1) {
            this.users[index] = updatedUser;
          }
          
          this.successMessage = `User ${updatedUser.username} updated successfully.`;
          this.editMode = false;
          this.selectedUser = null;
          
          // Auto-hide success message after 5 seconds
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          console.error('Error updating user:', err);
          this.error = `Failed to update user: ${err.error?.detail || err.message || 'Unknown error'}`;
          
          // Auto-hide error message after 5 seconds
          setTimeout(() => this.error = '', 5000);
        }
      });
  }
  
  /**
   * Delete a user
   */
  deleteUser(user: User): void {
    // Confirm before deleting
    if (!confirm(`Are you sure you want to delete user ${user.username}?`)) {
      return;
    }
    
    const userId = user.id;
    this.processingUsers[userId] = true;
    this.error = '';
    this.successMessage = '';
    
    this.adminService.deleteUser(userId)
      .pipe(finalize(() => {
        this.processingUsers[userId] = false;
      }))
      .subscribe({
        next: () => {
          // Remove the deleted user from the list
          this.users = this.users.filter(u => u.id !== userId);
          this.successMessage = `User ${user.username} deleted successfully.`;
          
          // Auto-hide success message after 5 seconds
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          console.error('Error deleting user:', err);
          this.error = `Failed to delete user: ${err.error?.detail || err.message || 'Unknown error'}`;
          
          // Auto-hide error message after 5 seconds
          setTimeout(() => this.error = '', 5000);
        }
      });
  }
  
  /**
   * Cancel editing and return to list view
   */
  cancelEdit(): void {
    this.editMode = false;
    this.selectedUser = null;
  }
  
  /**
   * Helper method to get role display name
   */
  getRoleDisplayName(roleValue: string): string {
    const role = this.roleOptions.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  }
}
