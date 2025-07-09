/**
 * EquipmentPoller - A utility for continuous polling of room equipment status
 * Similar to the VerificationPoller but specialized for equipment room scanning
 */
class EquipmentPoller {
  /**
   * Constructor
   * @param {string} roomId - ID of the room to scan
   * @param {number} updateInterval - Update interval in milliseconds
   * @param {string} token - Auth token for API requests
   * @param {number} scanDuration - Duration of each scan in seconds
   */
  constructor(roomId, updateInterval = 10000, token, scanDuration = 3) {
    this.roomId = roomId;
    this.updateInterval = Math.max(3000, updateInterval); // Minimum 3 seconds
    this.token = token;
    this.scanDuration = scanDuration;
    this.timer = null;
    this.updateCallback = null;
    this.errorCallback = null;
    this.apiUrl = window?.environment?.apiUrl || '/api'; // Fallback to default if not available
    this.isActive = false;
    
    // Bind methods
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.performScan = this.performScan.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    
    // Add visibility change event listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }
  
  /**
   * Start polling
   */
  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log(`Starting equipment room scanning for room ${this.roomId}`);
    
    // Perform initial scan immediately
    this.performScan();
    
    // Setup interval for subsequent scans
    this.timer = setInterval(this.performScan, this.updateInterval);
  }
  
  /**
   * Stop polling
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isActive = false;
    console.log('Stopped equipment room scanning');
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.updateCallback = null;
    this.errorCallback = null;
  }
  
  /**
   * Register update callback
   * @param {Function} callback - Function to call when scan results are available
   */
  onUpdate(callback) {
    if (typeof callback === 'function') {
      this.updateCallback = callback;
      return true;
    }
    return false;
  }
  
  /**
   * Register error callback
   * @param {Function} callback - Function to call when an error occurs
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this.errorCallback = callback;
      return true;
    }
    return false;
  }
  
  /**
   * Force an immediate scan
   */
  forceScan() {
    console.log('Forcing immediate equipment room scan');
    this.performScan();
  }
  
  /**
   * Perform the actual room scan via API
   */
  performScan() {
    if (!this.roomId) {
      console.error('Cannot scan: Room ID is missing');
      if (this.errorCallback) {
        this.errorCallback(new Error('Room ID is missing'));
      }
      return;
    }
    
    console.log(`Scanning room ${this.roomId} for equipment...`);
    
    // Endpoint URL
    const url = `${this.apiUrl}/equipment/scan-room/`;
    
    // Request options
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${this.token}`,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        room_id: this.roomId,
        scan_duration: this.scanDuration
      })
    };
    
    // Make the API call
    fetch(url, options)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Room scan results:', data);
        if (this.updateCallback) {
          this.updateCallback(data);
        }
      })
      .catch(error => {
        console.error('Error scanning room:', error);
        if (this.errorCallback) {
          this.errorCallback(error);
        }
      });
  }
  
  /**
   * Handle page visibility changes to optimize polling
   */
  handleVisibilityChange() {
    if (document.hidden) {
      // Page is hidden, stop polling to save resources
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        console.log('Paused equipment room scanning due to page hidden');
      }
    } else if (this.isActive) {
      // Page is visible again and scanning was active, resume polling
      console.log('Resuming equipment room scanning due to page visible');
      this.performScan(); // Perform a scan immediately
      this.timer = setInterval(this.performScan, this.updateInterval);
    }
  }
}

export default EquipmentPoller;
