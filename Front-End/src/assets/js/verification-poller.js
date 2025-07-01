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
     */
    constructor(sessionId, updateInterval = 5000) {
        this.sessionId = sessionId;
        this.updateInterval = updateInterval; // 5 seconds by default
        this.timerId = null;
        this.callbacks = [];
        this.lastUpdate = null;
    }
    
    /**
     * Start polling for verification status
     */
    start() {
        // Clear any existing timer
        this.stop();
        
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
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.lastUpdate = new Date();
                // Notify all callbacks
                this.callbacks.forEach(callback => callback(data, this.lastUpdate));
            })
            .catch(error => {
                console.error('Error fetching verification status:', error);
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

// Example usage
/* 
document.addEventListener('DOMContentLoaded', () => {
    // Get session ID from data attribute
    const sessionId = document.getElementById('verification-container').dataset.sessionId;
    
    // Create poller with 3 second update interval
    const poller = new VerificationPoller(sessionId, 3000);
    
    // Handle updates
    poller.onUpdate((data) => {
        updateVerificationUI(data);
    });
    
    // Start polling
    poller.start();
    
    // Stop polling when page is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            poller.stop();
        } else {
            poller.start();
        }
    });
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        poller.stop();
    });
    
    // Add refresh button functionality
    document.getElementById('refresh-button').addEventListener('click', () => {
        poller.forceUpdate();
    });
});
*/

export default VerificationPoller;
