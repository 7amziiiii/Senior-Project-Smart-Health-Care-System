# Real-time Verification System Documentation

## Overview

This document describes the real-time verification system for monitoring RFID tag verification status. The system uses a simple REST polling approach to provide near real-time updates to the frontend while maintaining simplicity and reliability.

## Architecture

The verification system consists of:

1. **Backend REST API**: A Django REST Framework endpoint that provides verification status
2. **Frontend Polling Client**: A JavaScript module that polls the API at regular intervals
3. **RFID Scan Integration**: Optional on-demand scanning for real-time verification updates

## Backend API

### Verification Status Endpoint

**Endpoint**: `/api/verification/{operation_session_id}/status/`

**Method**: GET

**Query Parameters**:
- `scan` (optional): If set to `true`, performs a new RFID scan before returning results

**Response Format**:
```json
{
  "verification_id": 123,
  "state": "incomplete",  // "complete", "incomplete", "failed"
  "used_items": {
    "instruments": {
      "Scalpel": 2  // Item name: count
    },
    "trays": {
      "Basic Tray": 1
    }
  },
  "missing_items": {
    "instruments": {},
    "trays": {}
  },
  "extra_items": {
    "instruments": {},
    "trays": {}
  },
  "available_items": {
    "instruments": {},
    "trays": {}
  },
  "available_matches": {
    "instruments": {},
    "trays": {}
  },
  "last_updated": "2025-07-01T17:04:20Z"
}
```

### Status Codes

- **200 OK**: Verification data returned successfully
- **404 Not Found**: Operation session or verification session not found

## Frontend Integration

### Using the VerificationPoller Class

The `VerificationPoller` class provides a simple interface for polling the verification status endpoint and updating the UI in real-time.

```javascript
// Import the poller
import VerificationPoller from '../js/verification-poller';

// Create a new poller with 3-second update interval
const poller = new VerificationPoller(operationSessionId, 3000);

// Register update handler
poller.onUpdate((data) => {
  // Update UI with verification data
  updateVerificationStatus(data);
});

// Start polling
poller.start();

// Force an immediate update with a new scan
document.getElementById('refresh-button').addEventListener('click', () => {
  poller.forceUpdate();
});

// Optimize for page visibility
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
```

### Example UI Update Function

```javascript
function updateVerificationStatus(data) {
  // Update verification status
  const statusElement = document.getElementById('verification-status');
  statusElement.textContent = data.state;
  statusElement.className = `status-${data.state}`;
  
  // Update used items
  const usedItemsContainer = document.getElementById('used-items');
  usedItemsContainer.innerHTML = '';
  
  // Add instruments
  Object.entries(data.used_items.instruments).forEach(([name, count]) => {
    const item = document.createElement('div');
    item.className = 'verification-item used';
    item.textContent = `${name} (${count})`;
    usedItemsContainer.appendChild(item);
  });
  
  // Add trays
  Object.entries(data.used_items.trays).forEach(([name, count]) => {
    const item = document.createElement('div');
    item.className = 'verification-item used tray';
    item.textContent = `${name} (${count})`;
    usedItemsContainer.appendChild(item);
  });
  
  // Similar updates for missing_items, extra_items, etc.
  
  // Update last updated time
  document.getElementById('last-updated').textContent = 
    new Date(data.last_updated).toLocaleTimeString();
}
```

## Best Practices

### Polling Frequency

Choose an appropriate polling frequency based on your requirements:

- **3 seconds**: More responsive, but higher server load
- **5 seconds**: Good balance between responsiveness and server load
- **10 seconds**: Lower server load, but less responsive

### Error Handling

The `VerificationPoller` includes basic error handling, but you may want to add custom error handling:

```javascript
poller.onError = (error) => {
  console.error('Verification polling error:', error);
  
  // Show error message in UI
  const statusElement = document.getElementById('verification-status');
  statusElement.textContent = 'Connection error';
  statusElement.className = 'status-error';
  
  // Retry after a delay
  setTimeout(() => poller.start(), 10000);
};
```

### Performance Considerations

1. **Stop polling when not needed**: Always stop polling when the page is hidden or the component is unmounted
2. **Use conditional scanning**: Only use `scan=true` when an immediate update is needed
3. **Consider using If-Modified-Since headers**: Implement conditional requests to reduce bandwidth

## Future Enhancements

While this REST polling approach is simple and effective, future enhancements could include:

1. **WebSocket Support**: For true real-time updates with lower latency and server load
2. **Push Notifications**: For critical verification state changes
3. **Offline Support**: Cache verification results for offline access

## Implementation Summary

The real-time verification system uses:

1. Django REST Framework for the backend API
2. Standard JavaScript fetch API for polling
3. Simple interval-based polling for near real-time updates

This approach was chosen for its:
- Simplicity and reliability
- Low implementation complexity
- Compatibility with all browsers
- Easy maintenance and debugging
