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
        // Validate sessionId
        if (!sessionId || isNaN(parseInt(sessionId)) || parseInt(sessionId) <= 0) {
            throw new Error('Invalid session ID provided');
        }
        
        this.sessionId = parseInt(sessionId);
        this.updateInterval = updateInterval; // 5 seconds by default
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
        // Fix: Add trailing slash required by Django REST Framework
        const url = `/api/verification/${this.sessionId}/status/${performScan ? '?scan=true' : ''}`;
        
        // Debug: Log the complete URL being fetched
        console.log('DEBUG - Fetching verification status from URL:', url);
        
        // Include credentials in the request to ensure authentication cookies are sent
        fetch(url, {
            credentials: 'include',  // Add credentials option to include cookies
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'  // Helps Django recognize AJAX requests
            }
        })
            .then(response => {
                // DETAILED DEBUG LOGGING
                console.log('%c ----- VERIFICATION API RESPONSE DETAILS -----', 'background: #222; color: #bada55');
                console.log('Status:', response.status, response.statusText);
                console.log('URL:', response.url);
                console.log('Content-Type:', response.headers.get('content-type'));
                console.log('All Headers:', Array.from(response.headers.entries()));
                
                // Clone the response to read it twice (once for debug, once for processing)
                const responseClone = response.clone();
                
                // Always read the response body for debugging, regardless of status
                responseClone.text().then(text => {
                    console.log('Response Body (first 500 chars):');
                    console.log(text.substring(0, 500));
                    if (text.includes('<!DOCTYPE html>')) {
                        console.error('ERROR: Received HTML instead of JSON - likely a login page or error page');
                    }
                }).catch(e => console.error('Error reading response body:', e));
                
                if (!response.ok) {
                    // Extract more detailed error information
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        // If JSON error response, parse it
                        return response.json().then(errorData => {
                            throw new Error(
                                `API Error: ${response.status} - ${errorData.error || errorData.message || response.statusText}`
                            );
                        });
                    } else {
                        // If HTML or other non-JSON response, extract useful information
                        return response.text().then(errorText => {
                            let errorMessage = `Network response was not ok: ${response.status}`;
                            
                            // Try to extract a more meaningful error message
                            const titleMatch = errorText.match(/<title>(.*?)<\/title>/i);
                            if (titleMatch && titleMatch[1]) {
                                errorMessage += ` - ${titleMatch[1]}`;
                            }
                            
                            throw new Error(errorMessage);
                        });
                    }
                }
                
                // Check content type to ensure it's JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error(`Invalid response format: ${contentType || 'unknown'}`);
                }
                
                // Reset error count on success
                this.errorCount = 0;
                
                return response.json();
            })
            .then(data => {
                this.lastUpdate = new Date();
                // Notify all callbacks
                this.callbacks.forEach(callback => callback(data, this.lastUpdate));
            })
            .catch(error => {
                console.error('Error fetching verification status:', error);
                
                // Increment error count
                this.errorCount++;
                
                // Stop polling after too many consecutive errors
                if (this.errorCount >= this.maxErrors) {
                    console.warn(`Stopping verification polling after ${this.maxErrors} consecutive errors.`);
                    this.stop();
                    
                    // Notify callbacks with error
                    this.callbacks.forEach(callback => callback({
                        error: 'Verification polling stopped due to multiple errors',
                        details: error.message
                    }, this.lastUpdate));
                } else {
                    // Still notify about the error even if we're not stopping
                    this.callbacks.forEach(callback => callback({
                        error: 'Verification update failed',
                        details: error.message,
                        retrying: true,
                        errorCount: this.errorCount,
                        maxErrors: this.maxErrors
                    }, this.lastUpdate));
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
