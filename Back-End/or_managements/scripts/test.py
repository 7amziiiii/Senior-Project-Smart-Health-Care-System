#!/usr/bin/env python
"""
RFID Scanner Script - Hilitand 125KHZ RFID Card Reader

This script reads RFID tags from a USB RFID reader that acts as a keyboard device.
It provides results as a JSON-formatted string for easy integration with other systems.
"""
import os
import sys
import json
import time
import platform
import argparse
from datetime import datetime, timezone


def scan_rfid_tags(port="", baud_rate=0, duration=5, verbose=False):
    """
    Scan for RFID tags using a Hilitand 125KHZ USB RFID reader for a specified duration.
    This reader acts as a keyboard device, sending keystrokes for each scanned tag.
    
    Args:
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
    
    # Buffer to collect tag ID characters
    tag_buffer = ""
    last_input_time = time.time()
    TAG_TIMEOUT = 0.5  # Seconds to wait before considering the tag ID complete
    
    # Record start time for overall scan duration
    start_time = time.time()
    
    try:
        # Check if we can use msvcrt for Windows-specific keyboard input
        msvcrt_available = platform.system() == 'Windows'
        
        if msvcrt_available:
            import msvcrt
        
        if verbose:
            print("Initializing Hilitand 125KHZ USB RFID reader...")
            print("Make sure the reader is plugged in and detected as a keyboard device")
            print(f"Scanning for RFID tags for {duration} seconds...")
        
        # Scan continuously for the entire duration
        while time.time() - start_time < duration:
            # This reader behaves as a keyboard, sending characters followed by Enter
            if msvcrt_available:
                if msvcrt.kbhit():
                    char = msvcrt.getch().decode('utf-8', errors='ignore')
                    current_time = time.time()
                    
                    # Reset buffer if there's been a delay (new tag scan)
                    if current_time - last_input_time > TAG_TIMEOUT and tag_buffer:
                        tag_buffer = ""
                    
                    last_input_time = current_time
                    
                    # Enter key signals the end of the tag input
                    if char == '\r' or char == '\n':
                        if tag_buffer:
                            # Cleanup tag data
                            tag_id = tag_buffer.strip()
                            
                            if verbose:
                                print(f"✓ Detected tag: {tag_id}")
                            
                            # Record timestamp and add to unique tags
                            timestamp = datetime.now(timezone.utc).isoformat()
                            unique_tags[tag_id] = timestamp
                            tag_buffer = ""
                    else:
                        # Accumulate characters into the tag buffer
                        tag_buffer += char
            else:
                # Fallback to standard input for systems without msvcrt
                tag = input().strip()
                if tag:
                    if verbose:
                        print(f"✓ Detected tag: {tag}")
                    
                    # Record timestamp and add to unique tags
                    timestamp = datetime.now(timezone.utc).isoformat()
                    unique_tags[tag] = timestamp
            
            # Periodically report progress
            elapsed = time.time() - start_time
            if verbose and int(elapsed) % 5 == 0 and int(elapsed) > 0 and int(elapsed) != int(elapsed - 0.1):
                print(f"Scan progress: {int(elapsed)}/{duration} seconds, {len(unique_tags)} tags found so far")
            
            # Small delay to prevent high CPU usage
            time.sleep(0.01)
        
        # Convert all unique tags to the required format
        for tag, timestamp in unique_tags.items():
            results["tags"].append({
                "tag_id": tag,
                "timestamp": timestamp
            })
        
        # Update the count of unique tags
        results["count"] = len(results["tags"])
        
        return results
    
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        return {"count": 0, "tags": [], "error": str(e)}


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Scan RFID tags using Hilitand 125KHZ USB reader')
    parser.add_argument('--duration', type=int, default=30, help='Scan duration in seconds (default: 30)')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    parser.add_argument('--json-only', action='store_true', help='Output only JSON results')
    
    args = parser.parse_args()
    
    # Scan for RFID tags
    results = scan_rfid_tags(args.duration, verbose=args.verbose)
    
    # Output only JSON results if flag is set
    if args.json_only:
        print(json.dumps(results))
        return
        
    # Otherwise output human-readable summary
    if args.verbose:
        print(f"\nScan complete! Found {len(results['tags'])} tags:")
        for i, tag_info in enumerate(results['tags'], 1):
            print(f"  {i}. Tag ID: {tag_info['tag_id']} (timestamp: {tag_info['timestamp']})")
            
        # If no tags were found, provide troubleshooting guidance
        if len(results['tags']) == 0:
            print("\nNo tags were detected. Troubleshooting suggestions:")
            print("  1. Make sure the RFID reader is properly connected via USB")
            print("  2. Ensure RFID tags are within range of the reader")
            print("  3. Try increasing the scan duration")
            print("  4. Check if the reader's LED activates when a tag is presented")
    
    # Output results as JSON string
    if args.verbose:
        print("\nRaw JSON output:")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
