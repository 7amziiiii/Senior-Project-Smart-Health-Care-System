/**
 * VerificationPoller - A client for polling verification status from the REST API
 * 
 * This module provides a simple interface for polling the verification status
 * endpoint and updating the UI in real-time (every 3-5 seconds).
 */

class VerificationPoller {
    /**
     * Create a new verification poller
     * 
     * @param {number} sessionId - The operation session ID to poll for
     * @param {number} updateInterval - Polling interval in milliseconds (default: 5000ms)
     * @param {string} authToken - Authentication token
     */
    constructor(sessionId, updateInterval = 5000, authToken = null) {
        // Validate sessionId
        if (!sessionId || isNaN(parseInt(sessionId)) || parseInt(sessionId) <= 0) {
            throw new Error('Invalid session ID provided');
        }
        
        this.sessionId = parseInt(sessionId);
        this.updateInterval = updateInterval; // 5 seconds by default
        this.authToken = authToken; // Authentication token
        this.timerId = null;
        this.callbacks = [];
        this.lastUpdate = null;
        this.errorCount = 0; // Track consecutive errors
        this.maxErrors = 3; // Stop polling after this many consecutive errors
    }
    
    /**
     * Start polling for verification status
     */
    start() {
        // Clear any existing timer
        this.stop();
        
        // Reset error count
        this.errorCount = 0;
        
        // Start polling
        this.fetchStatus();
        this.timerId = setInterval(() => this.fetchStatus(), this.updateInterval);
        console.log(`Started polling for session ${this.sessionId} every ${this.updateInterval}ms`);
    }
    
    /**
     * Stop polling
     */
    stop() {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
            console.log(`Stopped polling for session ${this.sessionId}`);
        }
    }
    
    /**
     * Fetch verification status from the API
     * 
     * @param {boolean} performScan - Whether to perform a new RFID scan (default: false)
     */
    fetchStatus(performScan = false) {
        const url = `/api/verification/${this.sessionId}/status/${performScan ? '?scan=true' : ''}`;
        console.log('Fetching verification status from URL:', url);
        console.log('Using auth token:', this.authToken ? 'YES' : 'NO');
        
        const self = this;
        
        // Use XMLHttpRequest for better CORS support with credentials
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.withCredentials = true; // Send cookies for session authentication
        xhr.setRequestHeader('Accept', 'application/json');
        
        // Add token authentication if available
        if (this.authToken) {
            xhr.setRequestHeader('Authorization', `Token ${this.authToken}`);
        }
        
        xhr.onload = function() {
            console.log('Response received with status:', xhr.status);
            
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    console.log('Successfully parsed response data');
                    self.errorCount = 0; // Reset error count on success
                    self.lastUpdate = new Date();
                    self.notifyCallbacks(data);
                } catch (e) {
                    console.error('Failed to parse JSON response:', e);
                    console.error('Raw response text:', xhr.responseText.substring(0, 200));
                    self.handleError(new Error('Failed to parse verification data'));
                }
            } else {
                console.error('HTTP error response:', xhr.status);
                console.error('Response body:', xhr.responseText.substring(0, 200));
                self.handleError(new Error(`Server returned status ${xhr.status}: ${xhr.statusText}`));
            }
        };
        
        xhr.onerror = function() {
            console.error('Network error occurred');
            self.handleError(new Error('Network error while fetching verification data'));
        };
        
        // Send the request
        xhr.send();
    }
    
    /**
     * Handle error during verification polling
     */
    handleError(error) {
        console.error('Error during verification polling:', error.message);
        
        // Increment error count
        this.errorCount++;
        
        // Stop polling after too many consecutive errors
        if (this.errorCount >= this.maxErrors) {
            console.warn(`Stopping verification polling after ${this.maxErrors} consecutive errors.`);
            this.stop();
            
            // Notify callbacks with final error
            this.notifyCallbacks({
                error: 'Verification polling stopped due to multiple errors',
                details: error.message
            });
        } else {
            // Still notify about the error even if we're not stopping
            this.notifyCallbacks({
                error: 'Verification update failed',
                details: error.message,
                retrying: true,
                errorCount: this.errorCount,
                maxErrors: this.maxErrors
            });
        }
    }
    
    /**
     * Notify all registered callbacks with new data
     */
    notifyCallbacks(data) {
        this.callbacks.forEach(callback => {
            try {
                callback(data, this.lastUpdate);
            } catch (e) {
                console.error('Error in verification callback:', e);
            }
        });
    }
    
    /**
     * Register a callback to be called when verification status updates
     * 
     * @param {function} callback - Function to call with updated data
     */
    onUpdate(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }
    
    /**
     * Force an immediate update with scanning
     */
    forceUpdate() {
        this.fetchStatus(true);
    }
    
    /**
     * Get the timestamp of the last update
     * 
     * @returns {Date|null} - The timestamp of the last update or null if never updated
     */
    getLastUpdateTime() {
        return this.lastUpdate;
    }
}

export default VerificationPoller;
