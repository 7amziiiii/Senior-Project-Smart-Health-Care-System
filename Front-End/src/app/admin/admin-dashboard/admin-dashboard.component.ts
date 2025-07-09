import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AdminService, PendingUser, User } from '../../services/admin.service';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { RFIDTagService, RFIDTag, Asset } from '../../services/rfid-tag.service';
import { InstrumentService, Instrument } from '../../services/instrument.service';
import { TrayService } from '../../services/tray.service';
import { HttpClientModule } from '@angular/common/http';
import { SystemLogsComponent } from '../system-logs/system-logs.component';
// Using alerts for notifications

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HttpClientModule, SystemLogsComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  // Instrument registration properties
  instrumentTypes = [
    { id: 1, name: 'Scalpel' },
    { id: 2, name: 'Forceps' },
    { id: 3, name: 'Scissors' },
    { id: 4, name: 'Clamp' },
    { id: 5, name: 'Retractor' }
  ];
  selectedInstrumentType = '';
  newInstrumentName = '';
  newInstrumentStatus = 'available';
  availableTrays: any[] = [];
  selectedTrayId = '';
  editMode = false;
  // User approval panel properties
  pendingUsers: PendingUser[] = [];
  allUsers: User[] = [];
  loading = false;
  error = '';
  successMessage = '';
  processingUsers: { [key: number]: boolean } = {};
  editingUser: User | null = null;
  confirmDelete = false;
  deleteUserId: number | null = null;
  newPassword: string = ''; // Property for password update
  
  // Pagination properties
  currentPage = 1;
  totalPages = 1;
  
  // Filter properties
  roleFilter = '';
  searchFilter = '';
  
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
  foundTag: RFIDTag | null = null;
  tagIsLinked = false;
  linkedAssetType: string | null = null;
  linkedAsset: Asset | null = null;
  scanError = '';  
  registrationInProgress = false; // Flag to track when registration is in progress
  
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
  
  updateInstrumentQuantity(instrumentId: number, quantity: number) {
    const index = this.selectedInstruments.findIndex(i => i.id === instrumentId);
    if (index !== -1) {
      this.selectedInstruments[index].quantity = quantity;
    }
  }
  
  // Event handler for quantity input
  
  // Event handler for quantity input
  handleQuantityChange(event: Event, instrumentId: number) {
    const input = event.target as HTMLInputElement;
    if (input && input.value) {
      this.updateInstrumentQuantity(instrumentId, parseInt(input.value, 10));
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
  
  constructor(
    private adminService: AdminService, 
    private authService: AuthService,
    private router: Router,
    private rfidTagService: RFIDTagService,
    private instrumentService: InstrumentService,
    private trayService: TrayService
  ) {}

  ngOnInit(): void {
    console.log('Admin dashboard initializing...');
    
    // Reset view state to show the main menu by default
    this.showDashboard = false;
    this.showApprovalPanel = false;
    this.showInstruments = false;
    this.showLogs = false;
    
    // Load any necessary data for the dashboard
    this.loadPendingUsers();
    this.loadAvailableTrays();
    this.loadAllUsers(); // Load all users for the admin table
    
    console.log('Admin dashboard initialized with main menu view');
  }
  
  /**
   * Load available trays from the backend
   */
  loadAvailableTrays(): void {
    console.log('Attempting to load trays...');
    this.trayService.getTrays().subscribe({
      next: (trays: any[]) => {
        this.availableTrays = trays || [];
        console.log('Loaded available trays:', this.availableTrays);
        
        if (this.availableTrays.length === 0) {
          console.warn('No trays were returned from the backend');
          // Add some mock trays for testing if none are returned
          this.availableTrays = [
            { id: 1, name: 'General Surgery Tray', type: 'Surgery' },
            { id: 2, name: 'Orthopedic Tray', type: 'Orthopedic' },
            { id: 3, name: 'Cardiac Tray', type: 'Cardiac' }
          ];
          console.log('Added mock trays for testing:', this.availableTrays);
        }
      },
      error: (error: any) => {
        console.error('Error loading trays:', error);
        // Add some mock trays for testing in case of error
        this.availableTrays = [
          { id: 1, name: 'General Surgery Tray', type: 'Surgery' },
          { id: 2, name: 'Orthopedic Tray', type: 'Orthopedic' },
          { id: 3, name: 'Cardiac Tray', type: 'Cardiac' }
        ];
        console.log('Added mock trays after error:', this.availableTrays);
      }
    });
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
        // Redirect to the OR dashboard component
        console.log('Navigating to OR dashboard');
        this.router.navigate(['/dashboard']);
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
        // Navigate to the standalone System Logs page
        this.router.navigate(['/system-logs']);
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
    this.foundTag = null;
    this.tagIsLinked = false;
    this.linkedAssetType = null;
    this.linkedAsset = null;
    this.scanError = '';
    
    // Reset instrument form
    this.selectedInstrumentType = '';
    this.newInstrumentName = '';
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
 

  // Edit mode flag for linked instruments/equipment is declared at the top of the class
  
  scanForRfid(): void {
    if (this.scanningRfid) return;
    
    this.scanningRfid = true;
    this.rfidFound = false;
    this.foundRfidId = '';
    this.foundTag = null;
    this.tagIsLinked = false;
    this.linkedAssetType = null;
    this.linkedAsset = null;
    this.scanError = '';
    this.editMode = false; // Reset edit mode when starting a new scan
    
    console.log('Starting RFID scan...');
    
    // Scan for 5 seconds
    this.rfidTagService.scanAndRegisterTag(5)
      .subscribe({
        next: (response) => {
          this.scanningRfid = false;
          console.log('RFID scan successful:', response);
          
          if (response.tag && response.tag.tag_id) {
            this.rfidFound = true;
            this.foundTag = response.tag;
            
            // Try to parse the tag_id if it's a JSON string
            try {
              if (response.tag.tag_id && 
                  (response.tag.tag_id.includes('{') || 
                   response.tag.tag_id.includes('"epc"') || 
                   response.tag.tag_id.includes("'epc'"))) 
              {
                // Try to parse the JSON string
                const tagData = JSON.parse(response.tag.tag_id.replace(/'/g, '"'));
                this.foundRfidId = tagData.epc || response.tag.tag_id;
              } else {
                // Use the tag_id as is
                this.foundRfidId = response.tag.tag_id;
              }
            } catch (e) {
              console.warn('Failed to parse tag_id:', e);
              this.foundRfidId = response.tag.tag_id;
            }
            
            // Check if the tag is linked to an asset
            if (response.is_linked) {
              this.tagIsLinked = true;
              this.linkedAssetType = response.asset_type || null;
              this.linkedAsset = response.asset || null;
              
              console.log('Tag is linked to asset:', this.linkedAssetType, this.linkedAsset);
              
              // If it's linked to an instrument, fetch the instrument details and pre-populate form
              if (this.linkedAssetType === 'instrument' && this.linkedAsset?.['id']) {
                this.fetchInstrumentDetails(this.linkedAsset['id']);
                
                // Pre-populate form fields with instrument data
                this.newInstrumentName = this.linkedAsset['name'] || '';
                this.selectedInstrumentType = this.linkedAsset['instrument_type_id']?.toString() || '';
                this.newInstrumentStatus = this.linkedAsset['status'] || 'available';
                this.selectedTrayId = this.linkedAsset['tray_id']?.toString() || '';
              }
            }
          } else {
            this.scanError = 'No RFID tag detected during scan.';
            console.warn('No RFID tag detected during scan.');
          }
        },
        error: (error) => {
          this.scanningRfid = false;
          this.scanError = error.message || 'Failed to scan for RFID tags. Please try again.';
          console.error('RFID scan error:', error);
        }
      });
  }

  cancelRegistration(): void {
    this.rfidFound = false;
    this.editMode = false;
    this.resetRegistrationForms();
  }
  
  // Enable edit mode for linked instruments
  enableEditMode(): void {
    this.editMode = true;
  }
  
  // Cancel edit mode
  cancelEditMode(): void {
    this.editMode = false;
    // Reset form fields to original values from linkedAsset
    if (this.linkedAsset && this.linkedAssetType === 'instrument') {
      this.newInstrumentName = this.linkedAsset['name'] || '';
      this.selectedInstrumentType = this.linkedAsset['instrument_type_id']?.toString() || '';
      this.newInstrumentStatus = this.linkedAsset['status'] || 'available';
      this.selectedTrayId = this.linkedAsset['tray_id']?.toString() || '';
    }
  }
  
  // Update an existing instrument
  updateInstrument(): void {
    if (!this.foundTag || !this.linkedAsset) return;
    
    const instrumentId = this.linkedAsset['id'];
    const updatedInstrument: any = {
      name: this.newInstrumentName,
      status: this.newInstrumentStatus
    };
    
    // Only include tray if selected
    if (this.selectedTrayId) {
      updatedInstrument.tray = this.selectedTrayId;
    }
    
    this.instrumentService.updateInstrument(instrumentId, updatedInstrument)
      .subscribe({
        next: (response) => {
          console.log('Instrument updated successfully:', response);
          this.editMode = false;
          // Refresh the instrument details
          this.fetchInstrumentDetails(instrumentId);
          alert('Instrument updated successfully');
        },
        error: (error) => {
          console.error('Failed to update instrument:', error);
          alert('Failed to update instrument. Please try again.');
        }
      });
  }
  
  // Delete an instrument
  deleteInstrument(): void {
    if (!this.foundTag || !this.linkedAsset) return;
    
    const instrumentId = this.linkedAsset.id;
    
    // Confirm before deleting
    if (confirm('Are you sure you want to delete this instrument? This action cannot be undone.')) {
      this.instrumentService.deleteInstrument(this.linkedAsset['id'])
        .subscribe({
          next: () => {
            console.log('Instrument deleted successfully');
            alert('Instrument deleted successfully');
            this.cancelRegistration();
          },
          error: (error) => {
            console.error('Failed to delete instrument:', error);
            alert('Failed to delete instrument. Please try again.');
          }
        });
    }
  }
  
  /**
   * @deprecated Use resetRegistrationForms() instead
   */
  resetInstrumentForm(): void {
    // Keep this for backward compatibility
    this.foundRfidId = '';
    this.foundTag = null;
    this.tagIsLinked = false;
    this.linkedAssetType = null;
    this.linkedAsset = null;
    this.selectedInstrumentType = '';
    this.newInstrumentStatus = 'available';
    this.selectedTrayId = '';
  }
  
  /**
   * Save instrument registration with RFID tag
   */
  saveInstrument(): void {
    if (!this.rfidFound || !this.foundTag) {
      alert('Please scan an RFID tag first');
      return;
    }
    
    if (this.registrationInProgress) return;
    
    const selectedType = this.instrumentTypes.find(type => type.id.toString() === this.selectedInstrumentType);
    
    // Check if the tag is already linked to an asset
    if (this.tagIsLinked) {
      alert(`This RFID tag is already linked to a ${this.linkedAssetType}. Please use a different tag.`);
      return;
    }
    
    // Create instrument object for API
    const instrument: Instrument = {
      name: selectedType ? selectedType.name : this.selectedInstrumentType,
      status: this.newInstrumentStatus,
      rfid_tag: this.foundTag.id
    };
    
    // Add tray association if selected
    if (this.selectedTrayId && this.selectedTrayId !== 'null') {
      instrument.tray_id = parseInt(this.selectedTrayId);
    }
    
    this.registrationInProgress = true;
    
    // Call the API to create the instrument
    this.instrumentService.createInstrument(instrument)
      .pipe(
        finalize(() => {
          this.registrationInProgress = false;
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Instrument registered successfully:', response);
          alert(`Instrument ${response.name} registered successfully with RFID tag ${this.foundRfidId}`);
          
          // Reset the form
          this.resetRegistrationForms();
        },
        error: (error) => {
          console.error('Error registering instrument:', error);
          let errorMessage = 'Failed to register instrument. ';
          
          if (error.error && error.error.detail) {
            errorMessage += error.error.detail;
          } else if (error.error && typeof error.error === 'string') {
            errorMessage += error.error;
          } else if (error.message) {
            errorMessage += error.message;
          }
          
          alert(errorMessage);
        }
      });
  }
  
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
  
  /**
   * Load all users from the backend
   */
  loadAllUsers(): void {
    this.loading = true;
    this.error = '';
    
    console.log('Loading all users...');
    this.adminService.getAllUsers()
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: (users) => {
          console.log('Received all users:', users);
          this.allUsers = users;
          // Calculate total pages based on 10 users per page
          this.totalPages = Math.ceil(users.length / 10);
        },
        error: (err) => {
          console.error('Error fetching all users:', err);
          this.error = 'Failed to load users. Please try again.';
        }
      });
  }
  
  /**
   * Apply role filter to users list
   */
  applyRoleFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.roleFilter = select.value;
    this.currentPage = 1; // Reset to first page when filtering
  }
  
  /**
   * Apply search filter to users list
   */
  applySearchFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchFilter = input.value.toLowerCase();
    this.currentPage = 1; // Reset to first page when filtering
  }
  
  /**
   * Get filtered users based on current filter settings
   */
  getFilteredUsers(): User[] {
    return this.allUsers.filter(user => {
      // Apply role filter if selected
      if (this.roleFilter && user.profile) {
        if (user.profile.role.toLowerCase() !== this.roleFilter.toLowerCase()) {
          return false;
        }
      }
      
      // Apply search filter if entered
      if (this.searchFilter) {
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        const email = user.email.toLowerCase();
        const username = user.username.toLowerCase();
        
        if (!fullName.includes(this.searchFilter) && 
            !email.includes(this.searchFilter) && 
            !username.includes(this.searchFilter)) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Get paginated users for current page
   */
  getPaginatedUsers(): User[] {
    const filteredUsers = this.getFilteredUsers();
    const startIndex = (this.currentPage - 1) * 10;
    return filteredUsers.slice(startIndex, startIndex + 10);
  }
  
  /**
   * Get total number of pages based on filtered users
   */
  getTotalPages(): number {
    return Math.ceil(this.getFilteredUsers().length / 10) || 1;
  }
  
  /**
   * Navigate to previous page
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }
  
  /**
   * Navigate to next page
   */
  nextPage(): void {
    const filteredUsers = this.getFilteredUsers();
    const totalFilteredPages = Math.ceil(filteredUsers.length / 10);
    if (this.currentPage < totalFilteredPages) {
      this.currentPage++;
    }
  }
  
  /**
   * Format date for display
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  /**
   * Open edit user form
   */
  editUser(user: User): void {
    this.editingUser = {...user};
    
    // Ensure profile object exists to avoid undefined errors in two-way binding
    if (!this.editingUser.profile) {
      this.editingUser.profile = {
        role: 'nurse', // Default role
        approved_status: 'approved'
      };
    }
  }
  
  /**
   * Cancel editing user
   */
  cancelEdit(): void {
    this.editingUser = null;
  }
  
  /**
   * Save edited user
   */
  saveUser(): void {
    if (!this.editingUser) return;
    
    this.loading = true;
    this.error = '';
    this.successMessage = '';
    
    // Create a copy of the user data to send to the backend
    // Use type assertion to allow adding password property
    const userData: any = {...this.editingUser};
    
    // Add password only if it was entered
    if (this.newPassword && this.newPassword.trim() !== '') {
      userData.password = this.newPassword;
    }
    
    this.adminService.updateUser(this.editingUser.id, userData)
      .pipe(finalize(() => {
        this.loading = false;
        this.newPassword = ''; // Clear the password field after save
      }))
      .subscribe({
        next: (updatedUser) => {
          // Update user in the local array
          const index = this.allUsers.findIndex(u => u.id === updatedUser.id);
          if (index !== -1) {
            this.allUsers[index] = updatedUser;
          }
          
          this.successMessage = `User ${updatedUser.username} has been updated successfully.`;
          this.editingUser = null;
        },
        error: (err) => {
          console.error('Error updating user:', err);
          this.error = 'Failed to update user. Please try again.';
        }
      });
  }
  
  /**
   * Prepare to delete user
   */
  prepareDeleteUser(userId: number): void {
    this.deleteUserId = userId;
    this.confirmDelete = true;
  }
  
  /**
   * Cancel delete user
   */
  cancelDelete(): void {
    this.deleteUserId = null;
    this.confirmDelete = false;
  }
  
  /**
   * Confirm and delete user
   */
  confirmDeleteUser(): void {
    if (!this.deleteUserId) return;
    
    this.loading = true;
    this.error = '';
    this.successMessage = '';
    
    this.adminService.deleteUser(this.deleteUserId)
      .pipe(finalize(() => {
        this.loading = false;
        this.confirmDelete = false;
      }))
      .subscribe({
        next: () => {
          // Remove user from local array
          this.allUsers = this.allUsers.filter(u => u.id !== this.deleteUserId);
          this.successMessage = 'User has been deleted successfully.';
          this.deleteUserId = null;
        },
        error: (err) => {
          console.error('Error deleting user:', err);
          this.error = 'Failed to delete user. Please try again.';
          this.deleteUserId = null;
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
  
  /**
   * Fetch instrument details when a tag linked to an instrument is scanned
   */
  fetchInstrumentDetails(instrumentId: number): void {
    this.instrumentService.getInstrument(instrumentId)
      .subscribe({
        next: (instrument) => {
          console.log('Fetched instrument details:', instrument);
          // Update linkedAsset with complete instrument details
          // Ensure the object conforms to the Asset interface with required properties
          this.linkedAsset = {
            id: instrument.id || 0,  // Ensure id is always a number
            name: instrument.name,
            status: instrument.status,
            status_display: instrument.status_display,
            rfid_tag: instrument.rfid_tag,
            tray_id: instrument.tray_id
          };
          
          // Show a message to the user about the linked instrument
          alert(`This RFID tag is already linked to instrument: ${instrument.name} (Status: ${instrument.status_display || instrument.status})`);
        },
        error: (error) => {
          console.error('Error fetching instrument details:', error);
        }
      });
  }

}
