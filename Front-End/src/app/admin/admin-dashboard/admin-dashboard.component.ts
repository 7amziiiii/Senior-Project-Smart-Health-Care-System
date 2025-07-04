import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AdminService, PendingUser } from '../../services/admin.service';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  // User approval panel properties
  pendingUsers: PendingUser[] = [];
  loading = false;
  error = '';
  successMessage = '';
  processingUsers: { [key: number]: boolean } = {};
  
  // Navigation properties
  showApprovalPanel = false;
  showDashboard = false;
  showInstruments = false;
  
  // Instrument registration properties
  showInstrumentReg = false;
  scanningRfid = false;
  rfidFound = false;
  foundRfidId = '';
  selectedInstrumentType = '';
  newInstrumentStatus = 'available';
  selectedTrayId = '';
  
  // Available instrument types
  instrumentTypes = [
    { id: 'scalpel', name: 'Scalpel' },
    { id: 'forceps', name: 'Forceps' },
    { id: 'retractor', name: 'Retractor' },
    { id: 'scissors', name: 'Surgical Scissors' },
    { id: 'needle_holder', name: 'Needle Holder' },
    { id: 'clamp', name: 'Clamp' },
    { id: 'suction', name: 'Suction Tube' },
    { id: 'electrocautery', name: 'Electrocautery Device' },
    { id: 'dilator', name: 'Dilator' },
    { id: 'speculum', name: 'Speculum' }
  ];
  
  availableTrays = [
    { id: 'tray1', name: 'Surgical Tray A' },
    { id: 'tray2', name: 'Orthopedic Tray' },
    { id: 'tray3', name: 'Cardiac Tray' }
  ];
  
  constructor(
    private adminService: AdminService, 
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initial state shows the menu, not any specific panel
    this.showApprovalPanel = false;
    this.showDashboard = false;
    this.showInstruments = false;
    
    // Only load pending users if approval panel is shown
    if (this.showApprovalPanel) {
      this.loadPendingUsers();
    }
  }

  // Navigation methods
  navigateToPanel(panel: string): void {
    // Reset all panels first
    this.showApprovalPanel = false;
    this.showDashboard = false;
    this.showInstruments = false;
    
    // Show selected panel
    switch(panel) {
      case 'approval':
        this.showApprovalPanel = true;
        this.loadPendingUsers();
        break;
      case 'dashboard':
        this.showDashboard = true;
        // Redirect to the OR dashboard
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1000);
        break;
      case 'instruments':
        this.showInstruments = true;
        break;
    }
  }
  
  backToMainMenu(): void {
    this.showApprovalPanel = false;
    this.showDashboard = false;
    this.showInstruments = false;
    this.showInstrumentReg = false;
    this.rfidFound = false;
    this.resetInstrumentForm();
  }
  
  // Instrument registration methods
  showInstrumentRegistration(): void {
    this.showInstrumentReg = true;
  }
  
  scanForRfid(): void {
    this.scanningRfid = true;
    this.rfidFound = false;
    
    // Simulate RFID scanning
    setTimeout(() => {
      // Generate a random RFID tag ID
      this.foundRfidId = 'RFID-' + Math.floor(100000 + Math.random() * 900000);
      this.scanningRfid = false;
      this.rfidFound = true;
    }, 2000);
  }
  
  saveInstrument(): void {
    if (!this.selectedInstrumentType) {
      alert('Please select an instrument type');
      return;
    }
    
    // Find the selected instrument type name from the array
    const selectedType = this.instrumentTypes.find(type => type.id === this.selectedInstrumentType);
    
    const instrument = {
      id: Math.floor(1000 + Math.random() * 9000),
      rfidTagId: this.foundRfidId,
      name: selectedType ? selectedType.name : this.selectedInstrumentType,
      status: this.newInstrumentStatus,
      trayId: this.selectedTrayId || null
    };
    
    // Simulate saving the instrument
    console.log('Saving instrument:', instrument);
    alert(`Instrument ${instrument.name} registered successfully with RFID tag ${instrument.rfidTagId}`);
    
    // Reset the form
    this.resetInstrumentForm();
  }
  
  cancelRegistration(): void {
    this.rfidFound = false;
    this.resetInstrumentForm();
  }
  
  resetInstrumentForm(): void {
    this.foundRfidId = '';
    this.selectedInstrumentType = '';
    this.newInstrumentStatus = 'available';
    this.selectedTrayId = '';
  }
  
  loadPendingUsers(): void {
    this.loading = true;
    this.error = '';
    
    console.log('Loading pending users...');
    this.adminService.getPendingUsers()
      .pipe(finalize(() => {
        this.loading = false;
        console.log('Loading finished, loading state is now:', this.loading);
      }))
      .subscribe({
        next: (users) => {
          console.log('Received pending users:', users);
          this.pendingUsers = users;
          console.log('pendingUsers array length:', this.pendingUsers.length);
          console.log('pendingUsers array content:', this.pendingUsers);
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
          
          // Extract more detailed error information
          let errorMessage = `Failed to approve user ${user.username}.`;
          
          if (err.error && err.error.detail) {
            errorMessage += ` ${err.error.detail}`;
          } else if (err.error && typeof err.error === 'string') {
            errorMessage += ` ${err.error}`;
          } else if (err.message) {
            errorMessage += ` ${err.message}`;
          } else if (err.status) {
            errorMessage += ` Server returned status code ${err.status}.`;
          }
          
          this.error = errorMessage;
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
