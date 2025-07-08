import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Log interface to define log structure
interface SystemLog {
  id?: number;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  status: 'complete' | 'pending' | 'issue';
  logType: 'verification' | 'outbound' | 'system';
}

@Component({
  selector: 'app-system-logs',
  templateUrl: './system-logs.component.html',
  styleUrls: ['./system-logs.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class SystemLogsComponent implements OnInit {
  // Properties for filtering and displaying logs
  loading = true;
  searchText = '';
  selectedDateRange = 'week';
  activeLogType = 'all';
  filterActive = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 5;

  // Sample logs data
  private _logs: SystemLog[] = [
    {
      id: 1,
      timestamp: '2025-07-07 02:45:12',
      user: 'dr.smith',
      action: 'Instrument Verification',
      details: 'Surgery #1245 - Hip Replacement',
      status: 'complete',
      logType: 'verification'
    },
    {
      id: 2,
      timestamp: '2025-07-07 02:30:05',
      user: 'nurse.jones',
      action: 'Equipment Check-out',
      details: 'Cardiac Monitor #CM-2234',
      status: 'complete',
      logType: 'outbound'
    },
    {
      id: 3,
      timestamp: '2025-07-07 02:15:33',
      user: 'tech.williams',
      action: 'Maintenance',
      details: 'Scheduled service - Ventilator #V-9872',
      status: 'pending',
      logType: 'system'
    },
    {
      id: 4,
      timestamp: '2025-07-07 01:55:18',
      user: 'dr.johnson',
      action: 'Tray Verification',
      details: 'Surgery #1244 - Appendectomy',
      status: 'issue',
      logType: 'verification'
    },
    {
      id: 5,
      timestamp: '2025-07-07 01:42:09',
      user: 'nurse.thompson',
      action: 'Equipment Return',
      details: 'Infusion Pump #IP-4421',
      status: 'complete',
      logType: 'outbound'
    },
    {
      id: 6,
      timestamp: '2025-07-06 22:18:45',
      user: 'admin.hughes',
      action: 'User Approval',
      details: 'New nurse account approved',
      status: 'complete',
      logType: 'system'
    },
    {
      id: 7,
      timestamp: '2025-07-06 21:05:30',
      user: 'tech.rodriguez',
      action: 'System Backup',
      details: 'Routine daily backup',
      status: 'complete',
      logType: 'system'
    },
    {
      id: 8,
      timestamp: '2025-07-06 17:23:11',
      user: 'dr.patel',
      action: 'Instrument Count',
      details: 'Surgery #1243 - Gallbladder Removal',
      status: 'issue',
      logType: 'verification'
    },
    {
      id: 9,
      timestamp: '2025-07-06 15:47:36',
      user: 'nurse.garcia',
      action: 'Equipment Check-out',
      details: 'Defibrillator #DF-5532',
      status: 'complete',
      logType: 'outbound'
    },
    {
      id: 10,
      timestamp: '2025-07-06 14:22:08',
      user: 'nurse.wilson',
      action: 'Equipment Return',
      details: 'Patient Monitor #PM-7789 (damaged)',
      status: 'issue',
      logType: 'outbound'
    }
  ];

  // Public getter for logs
  get logs(): SystemLog[] {
    return this._logs;
  }

  // Filtered logs property
  filteredLogs: SystemLog[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Simulate loading logs from a service
    setTimeout(() => {
      this.filteredLogs = [...this._logs];
      this.calculateTotalPages();
      this.loading = false;
    }, 1000);
  }

  // Filter logs based on selected type
  selectLogType(type: string): void {
    this.activeLogType = type;
    this.applyFilters();
  }

  // Apply all active filters
  applyFilters(): void {
    this.filterActive = this.searchText.trim().length > 0 || this.activeLogType !== 'all';
    
    // Start with all logs
    let filtered = [...this._logs];
    
    // Filter by log type if not 'all'
    if (this.activeLogType !== 'all') {
      filtered = filtered.filter(log => log.logType === this.activeLogType);
    }
    
    // Filter by search text if provided
    if (this.searchText.trim().length > 0) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(log => 
        log.user.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.details.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply date range filter (simplified implementation)
    // A real implementation would do proper date filtering
    
    this.filteredLogs = filtered;
    this.currentPage = 1; // Reset to first page when filters change
    this.calculateTotalPages();
  }

  // Clear all active filters
  clearFilters(): void {
    this.searchText = '';
    this.selectedDateRange = 'week';
    this.activeLogType = 'all';
    this.filterActive = false;
    this.filteredLogs = [...this._logs];
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  // Navigate back to the admin dashboard
  goBack(): void {
    this.router.navigate(['/admin']);
  }

  // Calculate total pages for pagination
  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredLogs.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1; // Ensure at least one page
  }

  exportLogs(): void {
    // In a real app, this would generate a CSV/Excel export
    alert('Logs exported successfully');
  }

  // goBack() method is already defined above

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }
}
