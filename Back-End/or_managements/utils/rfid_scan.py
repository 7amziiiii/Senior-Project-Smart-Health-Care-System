"""
RFID Scanning Utility - Simplified

This module provides utilities for:
- Connecting to RFID readers
- Reading RFID tags using YaoZeo readers
- Managing multiple readers
"""

import serial
import time
import logging
from typing import Iterable, List, Dict
from datetime import datetime
from django.utils import timezone

from or_managements.models import RFID_Reader

logger = logging.getLogger(__name__)

def verify_reader_connectivity(reader: RFID_Reader) -> bool:
    """
    Simple test to verify reader connection.
    
    Args:
        reader: RFID_Reader model instance
        
    Returns:
        bool: True if connection successful, False otherwise
    """
    try:
        with serial.Serial(reader.port, reader.baud_rate, timeout=1) as ser:
            return True
    except Exception as e:
        logger.error(f"Failed to connect to reader at {reader.location} ({reader.port}): {str(e)}")
        return False


def read_from_reader(reader: RFID_Reader, duration: float = 0.5) -> List[str]:
    """
    Reads RFID tags from a YaoZeo reader.
    
    Args:
        reader: RFID_Reader model instance
        duration: Duration of scan in seconds (default: 0.5)
        
    Returns:
        List of unique EPC strings
    """
    detected_epcs = {}  # Dictionary to track unique EPCs
    
    try:
        # Open serial connection with standard settings
        with serial.Serial(
            port=reader.port, 
            baudrate=reader.baud_rate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=0.1
        ) as ser:
            # Send start read command (from YaoZeo protocol)
            ser.write(bytes.fromhex('7C FF FF 11 32 00 43'))
            
            # Read for specified duration
            start_time = time.time()
            while time.time() - start_time < duration:
                if ser.in_waiting > 0:
                    raw_data = ser.readline()
                    
                    # Process data if we got something substantial
                    if len(raw_data) > 12:
                        data_str = raw_data.hex().upper()
                        
                        # Basic check for EPC format (YaoZeo format uses 035 prefix)
                        if '035' in data_str and len(data_str) >= 24:
                            detected_epcs[data_str] = True
            
            # Send stop command
            ser.write(bytes.fromhex('7C FF FF 11 31 00 42'))
            
            # Update last scan time
            reader.last_scan_time = timezone.now()
            reader.save(update_fields=['last_scan_time'])
            
    except Exception as e:
        logger.error(f"Error reading from {reader.location} ({reader.port}): {str(e)}")
    
    return list(detected_epcs.keys())


def scan_all_rfid_tags(readers: Iterable[RFID_Reader], end_time: datetime) -> List[Dict]:
    """
    Scans readers in round-robin fashion until end_time.
    
    Args:
        readers: Iterable of RFID_Reader instances
        end_time: Datetime to end scanning
        
    Returns:
        List of dictionaries with format: [{"epc": str, "reader_id": int, "timestamp": str}]
    """
    results = []
    seen_epcs = {}  # Track first detection of each EPC
    
    reader_list = list(readers)
    if not reader_list:
        logger.warning("No RFID readers available")
        return results
    
    current_idx = 0
    while timezone.now() < end_time:
        # Get next reader in round-robin fashion
        reader = reader_list[current_idx]
        current_idx = (current_idx + 1) % len(reader_list)
        
        # Skip readers with connection issues
        if not verify_reader_connectivity(reader):
            logger.warning(f"Skipping reader at {reader.location} - connectivity issues")
            continue
        
        # Scan for tags
        scan_time = timezone.now()
        epcs = read_from_reader(reader, duration=0.5)
        
        # Add new tags to results
        for epc in epcs:
            if epc not in seen_epcs:
                results.append({
                    "epc": epc,
                    "reader_id": reader.id,
                    "timestamp": scan_time.isoformat()
                })
                seen_epcs[epc] = True
        
        # Wait between scans (up to 2 seconds)
        elapsed = (timezone.now() - scan_time).total_seconds()
        if elapsed < 2.0:
            time.sleep(2.0 - elapsed)
    
    return results
