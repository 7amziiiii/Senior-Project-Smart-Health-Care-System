import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SurgeryDataService, Surgery, Instrument } from '../../services/surgery-data.service';
import { VerificationService, VerificationStatus } from '../../services/verification.service';

@Component({
  selector: 'app-instruments-verification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instruments-verification.component.html',
  styleUrls: ['./instruments-verification.component.scss']
})
export class InstrumentsVerificationComponent implements OnInit, OnDestroy {
  surgeries: Surgery[] = [];
  selectedSurgery: Surgery | null = null;
  verificationStatus: VerificationStatus | null = null;
  isVerifying: boolean = false;
  activeTab: 'missing' | 'present' | 'extra' | 'all' = 'missing';
  private subscriptions: Subscription[] = [];
  
  constructor(
    private surgeryDataService: SurgeryDataService,
    private verificationService: VerificationService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Get surgeries as Observable and subscribe to changes
    const surgeriesSub = this.surgeryDataService.getAllSurgeries().subscribe(surgeries => {
      this.surgeries = surgeries;
    });
    
    // Subscribe to selected surgery changes
    const selectedSurgerySub = this.surgeryDataService.getSelectedSurgery().subscribe((surgery: Surgery | null) => {
      this.selectedSurgery = surgery;
      
      // When a surgery is selected, start verification polling
      if (surgery) {
        this.startVerificationPolling(surgery.id);
      } else {
        this.stopVerificationPolling();
      }
    });
    
    // Subscribe to verification status updates
    const verificationSub = this.verificationService.getVerificationStatus().subscribe(status => {
      this.verificationStatus = status;
      console.log('Verification status updated:', status);
    });
    
    // Store subscriptions for cleanup
    this.subscriptions.push(surgeriesSub, selectedSurgerySub, verificationSub);
  }
  
  selectSurgery(surgery: Surgery | null): void {
    this.surgeryDataService.setSelectedSurgery(surgery);
  }
  
  getInstrumentsInRoom(): Instrument[] {
    if (!this.selectedSurgery) return [];
    return this.surgeryDataService.getInstrumentsInRoom(this.selectedSurgery);
  }
  
  getInstrumentsNotInRoom(): Instrument[] {
    if (!this.selectedSurgery) return [];
    return this.surgeryDataService.getInstrumentsNotInRoom(this.selectedSurgery);
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Stop any active verification polling
    this.stopVerificationPolling();
  }
  
  /**
   * Start polling for verification status
   */
  startVerificationPolling(sessionId: number): void {
    this.isVerifying = true;
    this.verificationService.startVerificationPolling(sessionId);
  }
  
  /**
   * Stop verification polling
   */
  stopVerificationPolling(): void {
    this.isVerifying = false;
    this.verificationService.stopVerificationPolling();
  }
  
  /**
   * Force an immediate verification scan
   */
  forceVerificationScan(): void {
    if (this.selectedSurgery) {
      this.verificationService.forceUpdate();
    }
  }
  
  /**
   * Get items count by category
   */
  getItemsCount(category: 'used' | 'missing' | 'extra', type: 'instruments' | 'trays'): number {
    if (!this.verificationStatus) return 0;
    
    // Use the new tabs structure if available
    if (this.verificationStatus.tabs) {
      const tabMapping = {
        'missing': 'missing' as const,
        'used': 'present' as const,
        'extra': 'extra' as const
      };
      
      const tabKey = tabMapping[category];
      if (tabKey && this.verificationStatus.tabs[tabKey]) {
        // For the tabs structure, we already have the total count
        // But we need to filter by type if requested
        if (type === 'instruments' || type === 'trays') {
          return this.verificationStatus.tabs[tabKey].items?.filter(
            item => item.type.toLowerCase() === (type === 'instruments' ? 'instrument' : 'tray')
          ).length || 0;
        }
        return this.verificationStatus.tabs[tabKey].count || 0;
      }
    }
    
    // Use the counts field if available
    if (this.verificationStatus.counts && 
        this.verificationStatus.counts[category] && 
        this.verificationStatus.counts[category][type] !== undefined) {
      return this.verificationStatus.counts[category][type];
    }
    
    // Fallback to the old method
    try {
      const itemsMap = this.verificationStatus[`${category}_items`][type];
      if (!itemsMap) return 0;
      
      // Return the count of items
      return Object.keys(itemsMap).length;
    } catch (e) {
      console.error(`Error getting ${category} items count:`, e);
      return 0;
    }
  }
  
  /**
   * Get the total number of required items (instruments + trays)
   */
  getTotalRequiredItems(): number {
    if (!this.verificationStatus) return 0;
    
    // Use the new tabs structure if available
    if (this.verificationStatus.tabs && this.verificationStatus.tabs.required) {
      return this.verificationStatus.tabs.required.count || 0;
    }
    
    // New format using required_items_status
    if (this.verificationStatus.required_items_status) {
      let total = 0;
      
      // Count required instruments
      if (this.verificationStatus.required_items_status.instruments) {
        total += Object.keys(this.verificationStatus.required_items_status.instruments).length;
      }
      
      // Count required trays
      if (this.verificationStatus.required_items_status.trays) {
        total += Object.keys(this.verificationStatus.required_items_status.trays).length;
      }
      
      return total;
    }
    
    // Fallback to local data - only use requiredInstruments as that's what's available in the Surgery type
    return this.selectedSurgery?.requiredInstruments?.length || 0;
  }
  
  /**
   * Get the quantity of an item (instrument or tray)
   */
  getItemQuantity(item: any): number {
    if (!item) return 0;
    return item.quantity || 1;
  }
  
  /**
   * Get the item type (instrument or tray)
   */
  getItemType(item: any): string {
    if (!item) return '';
    return item.is_tray ? 'Tray' : 'Instrument';
  }

  /**
   * Get combined items for a category (both instruments and trays)
   */
  getCombinedItems(category: 'missing' | 'used' | 'extra' | 'required'): any[] {
    if (!this.verificationStatus) return [];
    
    // First, check if we have the new tabs structure
    if (this.verificationStatus && this.verificationStatus.tabs) {
      // Map the category to the corresponding tab
      const tabKey = {
        'missing': 'missing' as const,
        'used': 'present' as const,
        'extra': 'extra' as const,
        'required': 'required' as const
      }[category];
      
      // Type-safe access using the mapped tab key
      if (tabKey && this.verificationStatus.tabs[tabKey]) {
        return this.verificationStatus.tabs[tabKey].items || [];
      }
    }
    
    // Fallback to old logic if tabs structure is not available
    let result: any[] = [];
    
    // Handle each category differently
    if (category === 'missing') {
      // Handle instruments
      if (this.verificationStatus.missing_items?.instruments) {
        for (const name in this.verificationStatus.missing_items.instruments) {
          const item = this.verificationStatus.missing_items.instruments[name];
          result.push({
            name,
            type: 'instrument',
            quantity: this.getItemQuantity(item)
          });
        }
      }
      
      // Handle trays
      if (this.verificationStatus.missing_items?.trays) {
        for (const name in this.verificationStatus.missing_items.trays) {
          const item = this.verificationStatus.missing_items.trays[name];
          result.push({
            name,
            type: 'tray',
            quantity: this.getItemQuantity(item)
          });
        }
      }
    } else if (category === 'used') {
      // Handle instruments
      if (this.verificationStatus.used_items?.instruments) {
        for (const name in this.verificationStatus.used_items.instruments) {
          const item = this.verificationStatus.used_items.instruments[name];
          result.push({
            name,
            type: 'instrument',
            quantity: this.getItemQuantity(item)
          });
        }
      }
      
      // Handle trays
      if (this.verificationStatus.used_items?.trays) {
        for (const name in this.verificationStatus.used_items.trays) {
          const item = this.verificationStatus.used_items.trays[name];
          result.push({
            name,
            type: 'tray',
            quantity: this.getItemQuantity(item)
          });
        }
      }
    } else if (category === 'required') {
      return this.getRequiredItems();
    }
    
    return result;
  }

  /**
   * Helper method to get required items from the required_items_status field
   */
  getRequiredItems(): any[] {
    if (!this.verificationStatus || !this.verificationStatus.required_items_status) return [];
    
    const combinedItems: any[] = [];
    const { required_items_status } = this.verificationStatus;
    
    // Process instruments
    if (required_items_status.instruments) {
      Object.entries(required_items_status.instruments).forEach(([name, data]: [string, any]) => {
        combinedItems.push({
          name: name,
          type: 'instrument',
          quantity: data.required_quantity || 1,
          found_quantity: data.found_quantity || 0,
          data: data
        });
      });
    }
    
    // Process trays
    if (required_items_status.trays) {
      Object.entries(required_items_status.trays).forEach(([name, data]: [string, any]) => {
        combinedItems.push({
          name: name,
          type: 'tray',
          quantity: data.required_quantity || 1,
          found_quantity: data.found_quantity || 0,
          data: data
        });
      });
    }
    
    return combinedItems;
  }
  
  // Helper method to check if items exist
  hasItems(category: 'missing' | 'used' | 'extra' | 'required', type: 'instruments' | 'trays'): boolean {
    if (!this.verificationStatus) return false;
    
    // Safely access the items based on category
    let items: any;
    if (category === 'missing' && this.verificationStatus.missing_items) {
      items = this.verificationStatus.missing_items[type];
    } else if (category === 'used' && this.verificationStatus.used_items) {
      items = this.verificationStatus.used_items[type];
    } else if (category === 'extra' && this.verificationStatus.extra_items) {
      items = this.verificationStatus.extra_items[type];
    } else if (category === 'required' && this.verificationStatus.required_items_status) {
      items = this.verificationStatus.required_items_status[type];
    } else if (category === 'required' && this.verificationStatus.required_items) {
      // Fallback to required_items if required_items_status is not available
      items = this.verificationStatus.required_items[type];
    }
    
    return items && Object.keys(items).length > 0;
  }
  
  /**
   * Check if we have items for a category
   */
  hasCombinedItems(category: 'missing' | 'used' | 'extra' | 'required'): boolean {
    if (!this.verificationStatus) return false;
    
    // Use the new tabs structure if available
    if (this.verificationStatus.tabs) {
      const tabMapping = {
        'missing': 'missing' as const,
        'used': 'present' as const,
        'extra': 'extra' as const,
        'required': 'required' as const
      };
      
      const tabKey = tabMapping[category];
      if (tabKey && this.verificationStatus.tabs[tabKey]) {
        return (this.verificationStatus.tabs[tabKey].count || 0) > 0;
      }
    }
    
    // Fallback to old method
    return this.getCombinedItems(category).length > 0;
  }
  
  // Helper to safely get instrument name
  getInstrumentName(item: any): string {
    if (item && typeof item === 'object' && item.name) {
      return item.name;
    }
    return 'Unknown Instrument';
  }
  
  // Helper method to check if an item (instrument or tray) is missing
  isItemMissing(itemName: string): boolean {
    if (!this.verificationStatus) return false;
    
    // Check if we have the required_items_status field (new API format)
    if (this.verificationStatus.required_items_status) {
      // Check instruments
      if (this.verificationStatus.required_items_status.instruments && 
          this.verificationStatus.required_items_status.instruments[itemName]) {
        // Check if any instance of this item is in the room
        const itemStatus = this.verificationStatus.required_items_status.instruments[itemName];
        return itemStatus.found_quantity < itemStatus.required_quantity;
      }
      
      // Check trays
      if (this.verificationStatus.required_items_status.trays && 
          this.verificationStatus.required_items_status.trays[itemName]) {
        // Check if any instance of this item is in the room
        const itemStatus = this.verificationStatus.required_items_status.trays[itemName];
        return itemStatus.found_quantity < itemStatus.required_quantity;
      }
    }
    
    // Fallback to old method if required_items_status is not available
    // First check if the item is in the used_items (present in room)
    const inUsedInstruments = this.verificationStatus.used_items?.instruments && 
                             Object.keys(this.verificationStatus.used_items.instruments).includes(itemName);
    const inUsedTrays = this.verificationStatus.used_items?.trays && 
                       Object.keys(this.verificationStatus.used_items.trays).includes(itemName);
    
    // If the item is in used_items, it's not missing
    if (inUsedInstruments || inUsedTrays) {
      return false;
    }
    
    // Now check if it's in missing_items
    const inMissingInstruments = this.verificationStatus.missing_items?.instruments && 
                               Object.keys(this.verificationStatus.missing_items.instruments).includes(itemName);
    const inMissingTrays = this.verificationStatus.missing_items?.trays && 
                         Object.keys(this.verificationStatus.missing_items.trays).includes(itemName);
    
    return inMissingInstruments || inMissingTrays;
  }
  
  /**
   * Navigate back to features selection view while maintaining selected surgery context
   */
  backToFeatures(): void {
    // Navigate to dashboard with query params to show features and preserve selected surgery
    this.router.navigate(['/dashboard'], { 
      queryParams: { 
        showFeatures: true,
        keepSurgeryContext: true 
      }
    });
  }
}
