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
  showLogs = false;
  
  // Registration panel properties
  showInstrumentReg = false;
  showLargeEquipmentReg = false;
  showTrayReg = false;
  showReaderReg = false;
  showOperationTypeReg = false;
  scanningRfid = false;
  rfidFound = false;
  foundRfidId = '';
  
  // RFID Reader properties
  availablePorts = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6'];
  availableLocations = ['OR Room 1', 'OR Room 2', 'Recovery Room', 'Equipment Room', 'Sterilization Area'];
  baudRates = [9600, 19200, 38400, 57600, 115200];
  selectedPort = '';
  selectedLocation = '';
  selectedBaudRate: number | null = null;
  
  // Operation Type properties
  operationTypes = ['Appendectomy', 'Cataract Surgery', 'Coronary Bypass', 'Hip Replacement', 'Knee Arthroscopy'];
  availableInstruments = [
    { name: 'Scalpel', id: 1 },
    { name: 'Clamp', id: 2 },
    { name: 'Forceps', id: 3 },
    { name: 'Retractor', id: 4 },
    { name: 'Scissors', id: 5 },
    { name: 'Needle Holder', id: 6 },
    { name: 'Suction Tube', id: 7 }
  ];
  selectedOperationType = '';
  selectedInstruments: {id: number, name: string, quantity: number}[] = [];
  
  // Methods for Operation Type registration
  addInstrument(instrument: {id: number, name: string}) {
    if (!this.isInstrumentSelected(instrument.id)) {
      this.selectedInstruments.push({...instrument, quantity: 1});
    }
  }
  
  removeInstrument(instrumentId: number) {
    this.selectedInstruments = this.selectedInstruments.filter(i => i.id !== instrumentId);
  }
  
  handleInstrumentSelection(event: Event, instrument: {id: number, name: string}) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox && checkbox.checked) {
      this.addInstrument(instrument);
    } else {
      this.removeInstrument(instrument.id);
    }
  }
  
  handleRemoveInstrument(id: number): void {
    // Remove from selectedInstruments array
    this.removeInstrument(id);
    
    // Also uncheck the checkbox
    const checkbox = document.getElementById('instrument-' + id) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = false;
    }
  }
  
  isInstrumentSelected(instrumentId: number): boolean {
    return this.selectedInstruments.some(i => i.id === instrumentId);
  }
  
  getInstrumentQuantity(instrumentId: number): number {
    const instrument = this.selectedInstruments.find(i => i.id === instrumentId);
    return instrument ? instrument.quantity : 1;
  }
  
  updateInstrumentQuantity(instrumentId: number, quantity: any) {
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity < 1) return;
    
    const index = this.selectedInstruments.findIndex(i => i.id === instrumentId);
    if (index !== -1) {
      this.selectedInstruments[index].quantity = numQuantity;
    }
  }
  
  // Event handler for quantity input
  
  // Event handler for quantity input
  handleQuantityChange(event: Event, instrumentId: number) {
    const input = event.target as HTMLInputElement;
    if (input && input.value) {
      this.updateInstrumentQuantity(instrumentId, input.value);
    }
  }
  
  // Increment quantity for an instrument
  incrementQuantity(instrumentId: number) {
    const instrument = this.selectedInstruments.find(i => i.id === instrumentId);
    if (instrument) {
      instrument.quantity += 1;
    }
  }
  
  // Decrement quantity for an instrument
  decrementQuantity(instrumentId: number) {
    const instrument = this.selectedInstruments.find(i => i.id === instrumentId);
    if (instrument && instrument.quantity > 1) {
      instrument.quantity -= 1;
    }
  }
  
  // Instrument registration properties
  
  // Instrument registration properties
  selectedInstrumentType = '';
  newInstrumentStatus = 'available';
  selectedTrayId = '';
  
  // Large Equipment registration properties
  newEquipmentName = '';
  newEquipmentId = '';
  newEquipmentType = '';
  newEquipmentStatus = 'available';
  newEquipmentNotes = '';
  
  // Tray registration properties
  newTrayType = '';
  
  // Logs properties
  activeLogType = 'verification';
  
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
    console.log(`Navigating to panel: ${panel}`);
    
    // Reset all panel states
    this.showApprovalPanel = false;
    this.showDashboard = false;
    this.showInstruments = false;
    this.showLogs = false;
    
    switch(panel) {
      case 'approval':
        this.showApprovalPanel = true;
        this.loadPendingUsers();
        break;
      case 'dashboard':
        this.showDashboard = true;
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1000);
        break;
      case 'maintenance':
        // Redirect to maintenance dashboard directly
        this.router.navigate(['/maintenance']);
        break;
      case 'instruments':
        this.showInstruments = true;
        break;
      case 'equipment-requests':
        // Show instruments panel for equipment requests
        this.showInstruments = true;
        break;
      case 'logs':
        this.showLogs = true;
        break;
    }
  }
  
  backToMainMenu(): void {
    this.showApprovalPanel = false;
    this.showDashboard = false;
    this.showInstruments = false;
    this.hideAllRegistrationForms();
    this.resetRegistrationForms();
  }
  
  // Registration panel methods
  showInstrumentRegistration(): void {
    this.hideAllRegistrationForms();
    this.showInstrumentReg = true;
    this.resetRegistrationForms();
  }
  
  /**
   * Shows the large equipment registration form
   */
  showLargeEquipmentRegistration(): void {
    this.hideAllRegistrationForms();
    this.showLargeEquipmentReg = true;
    this.resetRegistrationForms();
  }

  /**
   * Shows the tray registration form
   */
  showTrayRegistration(): void {
    this.hideAllRegistrationForms();
    this.showTrayReg = true;
    this.resetRegistrationForms();
  }

  /**
   * Shows the RFID Reader registration form
   */
  showReaderRegistration(): void {
    this.hideAllRegistrationForms();
    this.showReaderReg = true;
    this.resetRegistrationForms();
  }

  /**
   * Shows the Operation Type registration form
   */
  showOperationTypeRegistration(): void {
    this.hideAllRegistrationForms();
    this.showOperationTypeReg = true;
    this.resetRegistrationForms();
  }

  /**
   * Hides all registration form panels
   */
  private hideAllRegistrationForms(): void {
    this.showInstrumentReg = false;
    this.showLargeEquipmentReg = false;
    this.showTrayReg = false;
    this.showReaderReg = false;
    this.showOperationTypeReg = false;
  }

  /**
   * Resets all form inputs
   */
  private resetRegistrationForms(): void {
    this.rfidFound = false;
    this.foundRfidId = '';
    
    // Reset instrument form
    this.selectedInstrumentType = '';
    this.newInstrumentStatus = 'available';
    this.selectedTrayId = '';
    
    // Reset equipment form
    this.newEquipmentName = '';
    this.newEquipmentId = '';
    this.newEquipmentType = '';
    this.newEquipmentStatus = 'available';
    this.newEquipmentNotes = '';
    
    // Reset tray form
    this.newTrayType = '';
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
    this.resetRegistrationForms();
  }
  
  /**
   * @deprecated Use resetRegistrationForms() instead
   */
  resetInstrumentForm(): void {
    // Keep this for backward compatibility
    this.foundRfidId = '';
    this.selectedInstrumentType = '';
    this.newInstrumentStatus = 'available';
    this.selectedTrayId = '';
  }
  
  /**
   * Save a large equipment registration with RFID tag
   */
  saveLargeEquipment(): void {
    if (!this.newEquipmentName || !this.newEquipmentId || !this.newEquipmentType) {
      alert('Please fill in all required fields');
      return;
    }
    
    const equipment = {
      id: Math.floor(1000 + Math.random() * 9000),
      rfidTagId: this.foundRfidId,
      name: this.newEquipmentName,
      equipment_id: this.newEquipmentId,
      equipment_type: this.newEquipmentType,
      status: this.newEquipmentStatus,
      notes: this.newEquipmentNotes
    };
    
    // Simulate saving the equipment
    console.log('Saving large equipment:', equipment);
    alert(`Large equipment ${equipment.name} registered successfully with RFID tag ${equipment.rfidTagId}`);
    
    // Reset the form
    this.resetRegistrationForms();
  }
  
  /**
   * Save a tray registration with RFID tag
   */
  saveTray(): void {
    if (!this.newTrayType) {
      alert('Please select a tray type');
      return;
    }
    
    const tray = {
      id: 'tray-' + Math.floor(100 + Math.random() * 900),
      rfidTagId: this.foundRfidId,
      type: this.newTrayType,
      name: `${this.newTrayType} Tray ${Math.floor(100 + Math.random() * 900)}`
    };
    
    // Simulate saving the tray
    console.log('Saving tray:', tray);
    alert(`Tray ${tray.name} registered successfully with RFID tag ${tray.rfidTagId}`);
    
    // Reset the form
    this.resetRegistrationForms();
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
  
  // Logs panel methods
  selectLogType(logType: 'verification' | 'outbound' | 'system'): void {
    this.activeLogType = logType;
    // In a real implementation, this would fetch the selected log type from the backend
    console.log(`Selected log type: ${logType}`);
  }

}
