#!/usr/bin/env python
"""
RFID Scanner Script

This script connects to an RFID reader via a serial port and scans for RFID tags
for a specified duration. It returns the results as a JSON-formatted string.
"""
import os
import sys
import django
import argparse
import json
import serial
import time
import binascii
import re
from datetime import datetime, timezone


def scan_rfid_tags(port, baud_rate, duration, verbose=False):
    """
    Scan for RFID tags using a YaoZeo RFID reader via serial connection for a specified duration.
    
    Args:
        port (str): The serial port to connect to
        baud_rate (int): The baud rate for the serial connection
        duration (int): The duration in seconds to scan for tags
        verbose (bool): Whether to print verbose output (default: False)
        
    Returns:
        dict: A dictionary with the scan span and detected tags
    """
    
    # Initialize results dictionary
    results = {
        "count": 0,
        "tags": []
    }
    
    # Dictionary to track unique tags and their first appearance
    unique_tags = {}
    
    # Pattern for identifying EPC codes in YaoZeo reader output
    # Based on actual demo software screenshots: 
    # EPCs are 24 characters long (12 bytes) and start with 035
    # Exact pattern observed in demo software
    EPC_PATTERN = re.compile(r'035[A-F0-9]{21}')
    

    
    # Based on the screenshot, define the commands
    inventory_cmd = bytes.fromhex("7C FF FF 11 32 00 43".replace(" ", ""))
    start_read_cmd = bytes.fromhex("7C FF FF 11 27 00 38".replace(" ", ""))
    stop_cmd = bytes.fromhex("7C FF FF 11 31 00 42".replace(" ", ""))
    
    try:
        # Open serial connection with a shorter timeout for more responsive reading
        if verbose:
            print(f"Opening serial port {port} at {baud_rate} baud...")
        try:
            # Try to open the serial port
            ser = serial.Serial(
                port=port,
                baudrate=baud_rate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=0.1
            )
        except serial.SerialException as e:
            if verbose:
                print(f"Error: Could not open serial port {port}: {e}")
            return {"count": 0, "tags": [], "error": str(e)}
            
        with ser:
            if verbose:
                print("Serial port opened successfully")
            
            # Clear any pending data
            ser.reset_input_buffer()
            ser.reset_output_buffer()
            
            # Record start time
            start_time = time.time()
            
            # Clear any previous command state
            ser.write(stop_cmd)
            time.sleep(0.2)  # Brief wait
            
            # Send the inventory command to start scanning
            ser.write(inventory_cmd)
            
            # Wait briefly for the reader to process
            time.sleep(0.1)
            
            # Send the start read command
            ser.write(start_read_cmd)
            
            if verbose:
                print(f"Continuously scanning for RFID tags for {duration} seconds...")
            
            # Initialize data buffer
            accumulated_data = bytearray()
            
            # Track when we last sent commands to the reader
            last_command_time = time.time()
            
            # Scan continuously for the entire duration
            while time.time() - start_time < duration:
                # Check for data
                if ser.in_waiting > 0:
                    # Read available data
                    raw_data = ser.read(ser.in_waiting)
                    accumulated_data.extend(raw_data)
                    
                    # Print hex data for debugging if verbose
                    if verbose and len(raw_data) > 3:
                        hex_data = binascii.hexlify(raw_data).decode().upper()
                        formatted_hex = ' '.join(hex_data[i:i+2] for i in range(0, len(hex_data), 2))
                        print(f"Received: {formatted_hex}")
                        
                        # Print scan in demo software format to debug
                        if len(hex_data) >= 24:
                            print(f"Demo-like format: {hex_data}")
                    
                    # Check for tags in hex data
                    hex_accumulated = binascii.hexlify(accumulated_data).decode().upper()
                    
                    # Find all EPC tags in the data - using original method
                    matches = EPC_PATTERN.findall(hex_accumulated)
                    
                    # Do not clear accumulated data completely as it might contain
                    # partial tags that will be completed in the next data batch
                    # Instead, keep the last portion that might contain partial tag data
                    if len(accumulated_data) > 100:
                        accumulated_data = accumulated_data[-100:]
                    
                    # Process each match - normalize and store unique tags
                    for full_epc in matches:
                        # Normalize to base EPC (take just the first 24 chars)
                        # This ensures we don't count the same tag multiple times
                        # if it appears with different suffixes
                        base_epc = full_epc[:24] if len(full_epc) > 24 else full_epc
                        
                        # Check for standard EPC format (035 + 21-23 chars)
                        if base_epc not in unique_tags and re.match(r'^035[A-F0-9]{21,23}$', base_epc):
                            if verbose:
                                print(f"✓ DETECTED TAG: {base_epc}")
                            timestamp = datetime.now(timezone.utc).isoformat()
                            unique_tags[base_epc] = timestamp
                        
                # Periodically reissue commands to keep the reader scanning
                current_time = time.time()
                if current_time - last_command_time > 1.0:  # Reissue commands every 1 second
                    # Resend inventory command
                    ser.write(inventory_cmd)
                    time.sleep(0.05)  # Brief wait
                    
                    # Resend start read command
                    ser.write(start_read_cmd)
                    
                    # Update the last command time
                    last_command_time = current_time
                    
                    if verbose:
                        print("Reissuing scan commands...")
                        
                # Periodically report progress
                elapsed = time.time() - start_time
                if verbose and int(elapsed) % 5 == 0 and int(elapsed) > 0 and int(elapsed) != int(elapsed - 0.1):
                    print(f"Scan progress: {int(elapsed)}/{duration} seconds, {len(unique_tags)} tags found so far")
            
        
        # Set count of detected tags
        results["count"] = len(unique_tags)
        
        # Convert all unique tags to the required format
        for tag, timestamp in unique_tags.items():
            results["tags"].append({
                "epc": tag,
                "timestamp": timestamp
            })
        
        # Update the count of unique tags
        results["count"] = len(results["tags"])
        
        return results
    
    except serial.SerialException as e:
        sys.stderr.write(f"Error: Could not open serial port {port}: {e}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Error: {e}\n")
        sys.exit(1)


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Scan RFID tags via serial connection')
    parser.add_argument('--port', required=True, help='Serial port (e.g., COM3 on Windows, /dev/ttyUSB0 on Linux)')
    parser.add_argument('--baud-rate', type=int, default=9600, help='Baud rate (default: 9600)')
    parser.add_argument('--duration', type=int, required=True, help='Scan duration in seconds')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    parser.add_argument('--json-only', action='store_true', help='Output only JSON results')
    
    args = parser.parse_args()
    
    # Scan for multiple RFID tags
    results = scan_rfid_tags(args.port, args.baud_rate, args.duration, verbose=args.verbose)
    
    # Output only JSON results if flag is set
    if args.json_only:
        print(json.dumps(results))
        return
        
    # Otherwise output human-readable summary
    if args.verbose:
        print(f"\nScan complete! Found {len(results['tags'])} tags:")
        for i, tag_info in enumerate(results['tags'], 1):
            print(f"  {i}. EPC: {tag_info['epc']} (timestamp: {tag_info['timestamp']})")
            
        # If no tags were found, provide troubleshooting guidance
        if len(results['tags']) == 0:
            print("\nNo tags were detected. Troubleshooting suggestions:")
            print("  1. Make sure the RFID reader is properly connected to port " + args.port)
            print("  2. Verify that the baud rate is set correctly " + str(args.baud_rate))
            print("  3. Ensure RFID tags are within range of the reader")
            print("  4. Try increasing the scan duration")
            print("  5. Check if the reader is responding to commands (look for hex responses)")
    
    # Output results as JSON string
    if args.verbose:
        print("\nRaw JSON output:")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
