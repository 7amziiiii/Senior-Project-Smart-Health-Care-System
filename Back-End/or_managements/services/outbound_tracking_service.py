"""
Outbound Tracking Service

This service handles post-operation RFID verification to ensure all instruments and trays
have been properly removed from the operating room after a procedure.

It:
1. Scans the room for any remaining RFID tags
2. Cross-references with items that were used in the operation session
3. Reports which items (if any) remain in the room
4. Updates the operation session with room status (empty/not empty)
"""

import logging
from datetime import datetime, timezone

from django.utils import timezone

from or_managements.models import (
    OperationSession,
    VerificationSession,
    RFIDTag,
    Instrument,
    Tray,
    outbound_tracking
)
from or_managements.scripts.rfid_scanner import scan_rfid_tags

logger = logging.getLogger(__name__)


class OutboundTrackingService:
    """Service for tracking outbound instruments and trays after an operation session."""
    
    def __init__(self, operation_session_id):
        """
        Initialize the outbound tracking service.
        
        Args:
            operation_session_id: ID of the OperationSession to track
        """
        self.operation_session = OperationSession.objects.get(id=operation_session_id)
        
        # Get the verification session (should already exist)
        try:
            self.verification_session = VerificationSession.objects.get(
                operation_session=self.operation_session
            )
        except VerificationSession.DoesNotExist:
            raise ValueError(
                f"No verification session found for operation session {operation_session_id}. "
                "Verification must be completed before outbound tracking."
            )
        
        # Track items that remain in the room
        self.remaining_instruments = []
        self.remaining_trays = []
        
        # Format for tracking remaining items
        self.remaining_items_dict = {"instruments": {}, "trays": {}}
        
    def perform_outbound_check(self, scan_duration=5, verbose=False):
        """
        Perform outbound tracking check.
        
        Args:
            scan_duration: Duration to scan for RFID tags (in seconds)
            verbose: Whether to print verbose output
            
        Returns:
            Dict containing outbound tracking results
        """
        # Reset tracking lists
        self.remaining_instruments = []
        self.remaining_trays = []
        self.extra_instruments = []
        self.extra_trays = []
        self.remaining_items_dict = {"instruments": {}, "trays": {}}
        self.extra_items_dict = {"instruments": {}, "trays": {}}
        
        # Scan for tags
        scan_results = self._scan_for_tags(scan_duration, verbose)
        
        # Map EPCs to database objects
        found_instruments, found_trays = self._map_epcs_to_objects(scan_results)
        
        # Get used items from verification session
        used_items = self.verification_session.used_items
        
        # Check which found items were used in the operation
        self._identify_remaining_items(found_instruments, found_trays, used_items)
        
        # Update operation session with room status
        self._update_operation_session()
        
        # Return results
        return self._format_result()
    
    def _scan_for_tags(self, duration, verbose=False):
        """
        Use RFID scanner script to collect tag data.
        
        Args:
            duration: Duration to scan (in seconds)
            verbose: Whether to print verbose output
            
        Returns:
            List of scan results
        """
        # Find RFID reader for the operation room
        reader = self.operation_session.operation_room.rfid_readers.first()
        
        if not reader:
            raise ValueError(f"No RFID reader found for operation room {self.operation_session.operation_room.name}")
        
        # Scan for RFID tags
        result = scan_rfid_tags(reader.port, reader.baud_rate, duration, verbose=verbose)
        
        return result.get("tags", [])
    
    def _map_epcs_to_objects(self, scan_results):
        """
        Convert EPCs to database objects.
        
        Args:
            scan_results: List of scan results from scan utility
            
        Returns:
            Tuple of (instruments, trays) found
        """
        found_instruments = []
        found_trays = []
        
        # Get all EPCs from scan results
        epcs = [result["epc"] for result in scan_results]
        
        if not epcs:
            return found_instruments, found_trays
            
        # Find tags corresponding to these EPCs
        found_tags = RFIDTag.objects.filter(tag_id__in=epcs)
        
        # Map tags to instruments and trays
        for tag in found_tags:
            # Check if tag is associated with an instrument
            try:
                instrument = tag.tag.first()  # Using related_name from Instrument model
                if instrument:
                    found_instruments.append(instrument)
                    continue
            except:
                pass
                
            # Check if tag is associated with a tray
            try:
                tray = Tray.objects.filter(tag=tag).first()
                if tray:
                    found_trays.append(tray)
            except:
                pass
                
        return found_instruments, found_trays
    
    def _identify_remaining_items(self, found_instruments, found_trays, used_items):
        """
        Identify which found items were used in the operation and remain in the room.
        Also identify extra items that weren't used in the operation but are in the room.
        
        Args:
            found_instruments: List of instruments found in the room
            found_trays: List of trays found in the room
            used_items: Dictionary of items used in the operation from verification session
        """
        # First, get all used instrument and tray IDs
        used_instrument_ids = set()
        used_tray_ids = set()
        
        # Get all used instrument IDs
        for name, data in used_items.get('instruments', {}).items():
            used_instrument_ids.update(data.get('ids', []))
            
        # Get all used tray IDs
        for name, data in used_items.get('trays', {}).items():
            used_tray_ids.update(data.get('ids', []))
        
        # Process instruments - strictly by ID
        if found_instruments:
            # Categorize instruments as either 'remaining' (were used in the operation) or 'extra'
            for instrument in found_instruments:
                if instrument.id in used_instrument_ids:
                    # This instrument was used in the operation and is still in the room
                    self.remaining_instruments.append(instrument)
                    
                    # Add to remaining_items_dict, grouped by name
                    if instrument.name not in self.remaining_items_dict['instruments']:
                        self.remaining_items_dict['instruments'][instrument.name] = {
                            'quantity': 0,
                            'ids': []
                        }
                    
                    self.remaining_items_dict['instruments'][instrument.name]['quantity'] += 1
                    self.remaining_items_dict['instruments'][instrument.name]['ids'].append(instrument.id)
                else:
                    # This is an extra instrument - not used in this operation but found in the room
                    self.extra_instruments.append(instrument)
                    
                    # Add to extra_items_dict, grouped by name
                    if instrument.name not in self.extra_items_dict['instruments']:
                        self.extra_items_dict['instruments'][instrument.name] = {
                            'quantity': 0,
                            'ids': []
                        }
                    
                    self.extra_items_dict['instruments'][instrument.name]['quantity'] += 1
                    self.extra_items_dict['instruments'][instrument.name]['ids'].append(instrument.id)
        
        # Process trays - strictly by ID
        if found_trays:
            # Categorize trays as either 'remaining' (were used in the operation) or 'extra'
            for tray in found_trays:
                if tray.id in used_tray_ids:
                    # This tray was used in the operation and is still in the room
                    self.remaining_trays.append(tray)
                    
                    # Add to remaining_items_dict, grouped by name
                    if tray.name not in self.remaining_items_dict['trays']:
                        self.remaining_items_dict['trays'][tray.name] = {
                            'quantity': 0,
                            'ids': []
                        }
                    
                    self.remaining_items_dict['trays'][tray.name]['quantity'] += 1
                    self.remaining_items_dict['trays'][tray.name]['ids'].append(tray.id)
                else:
                    # This is an extra tray - not used in this operation but found in the room
                    self.extra_trays.append(tray)
                    
                    # Add to extra_items_dict, grouped by name
                    if tray.name not in self.extra_items_dict['trays']:
                        self.extra_items_dict['trays'][tray.name] = {
                            'quantity': 0,
                            'ids': []
                        }
                    
                    self.extra_items_dict['trays'][tray.name]['quantity'] += 1
                    self.extra_items_dict['trays'][tray.name]['ids'].append(tray.id)
    
    def _update_operation_session(self):
        """
        Create an outbound tracking record with room status.
        """
        # Check if any items remain in the room
        is_room_empty = (
            len(self.remaining_instruments) == 0 and 
            len(self.remaining_trays) == 0
        )
        
        # Create new outbound tracking record
        outbound_check = outbound_tracking.OutboundTracking(
            operation_session=self.operation_session,
            room_cleared=is_room_empty,
            remaining_items=self.remaining_items_dict,
            # Add extra items as well
            extra_items=self.extra_items_dict,
            # If there's a user in the request context, we can add it here
            # checked_by=self.request.user if hasattr(self, 'request') else None
        )
        
        # Save the new record
        outbound_check.save()
        
        # Store this record for reference
        self.outbound_check = outbound_check
    
    def _format_result(self):
        """
        Format result for API response.
        
        Returns:
            Dict containing outbound tracking results
        """
        return {
            "operation_session_id": self.operation_session.id,
            "outbound_check_id": self.outbound_check.id,
            "room_cleared": self.outbound_check.room_cleared,
            "check_time": self.outbound_check.check_time,
            "remaining_items": self.outbound_check.remaining_items,
            "extra_items": self.outbound_check.extra_items,
        }
