"""
Verification Service

This service handles RFID tag verification for operation sessions, including:
- Periodic scanning of RFID tags
- Mapping EPCs to instruments and trays
- Categorizing items as used, missing, available, and extra based on name and quantity
- Updating instrument and tray states
- Updating the verification session
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Set, Tuple

from django.utils import timezone
from django.db.models import Q

from or_managements.models import (
    OperationSession,
    VerificationSession,
    RFIDTag,
    Instrument,
    Tray,
    RFID_Reader
)
from or_managements.scripts.rfid_scanner import scan_rfid_tags

logger = logging.getLogger(__name__)


class VerificationService:
    """Service for verifying instruments and trays for an operation session."""
    
    def __init__(self, operation_session_id):
        """
        Initialize the verification service.
        
        Args:
            operation_session_id: ID of the OperationSession to verify
        """
        self.operation_session = OperationSession.objects.get(id=operation_session_id)
        
        # Get or create a verification session
        self.verification_session, _ = VerificationSession.objects.get_or_create(
            operation_session=self.operation_session,
            defaults={
                'state': 'incomplete',
                'open_until': timezone.now() + timedelta(hours=24),
                'used_items': {},
                'missing_items': {},
                'available_items': {},
                'available_matches': {}
            }
        )
        
        # Track items
        self.used_instruments = []
        self.used_trays = []
        self.missing_instruments = []
        self.missing_trays = []
        self.available_instruments = []
        self.available_trays = []
        self.extra_instruments = []
        self.extra_trays = []
        
        # Track items by category with name-based dictionaries
        self.used_items_dict = {"instruments": {}, "trays": {}}
        self.missing_items_dict = {"instruments": {}, "trays": {}}
        self.extra_items_dict = {"instruments": {}, "trays": {}}
        self.available_items_dict = {"instruments": {}, "trays": {}}
    
    def perform_verification(self, scan_duration=2):
        """
        Perform one verification cycle.
        
        Args:
            scan_duration: Duration to scan for RFID tags (in seconds)
            
        Returns:
            Dict containing verification results
        """
        # Reset tracking lists
        self.used_instruments = []
        self.used_trays = []
        self.missing_instruments = []
        self.missing_trays = []
        self.available_instruments = []
        self.available_trays = []
        self.extra_instruments = []
        self.extra_trays = []
        
        # Track items by category with name-based dictionaries
        self.used_items_dict = {"instruments": {}, "trays": {}}
        self.missing_items_dict = {"instruments": {}, "trays": {}}
        self.extra_items_dict = {"instruments": {}, "trays": {}}
        self.available_items_dict = {"instruments": {}, "trays": {}}
        
        # Get required instruments and trays by name
        required_instrument_names, required_tray_names = self._get_required_items()
        
        # Scan for tags
        scan_results = self._scan_for_tags(scan_duration)
        
        # Map EPCs to database objects
        found_instruments, found_trays = self._map_epcs_to_objects(scan_results)
        
        # Categorize items
        self._categorize_items(
            found_instruments, 
            found_trays, 
            required_instrument_names,
            required_tray_names
        )
        
        # Update item states
        self._update_item_states()
        
        # Update verification session
        self._update_verification_session()
        
        # Return results
        return self._format_result()
    
    def start_continuous_verification(self, max_duration=3600):
        """
        Start continuous verification with 5-second intervals.
        
        Args:
            max_duration: Maximum duration to run (in seconds)
            
        Returns:
            Final verification result
        """
        start_time = timezone.now()
        end_time = start_time + timedelta(seconds=max_duration)
        
        while timezone.now() < end_time:
            # Perform one verification cycle
            result = self.perform_verification(scan_duration=2)
            
            # Check if we're done (all items found)
            if result.get('state') == 'valid':
                logger.info("All required items found. Verification complete.")
                return result
            
            # Wait for 5 seconds before next scan
            logger.info("Waiting 5 seconds before next scan...")
            time.sleep(5)
        
        # Return final result
        logger.warning(f"Verification timed out after {max_duration} seconds")
        return self.perform_verification(scan_duration=2)
    
    def _scan_for_tags(self, duration):
        """
        Use RFID scanner script to collect tag data.
        
        Args:
            duration: Duration to scan (in seconds)
            
        Returns:
            List of scan results
        """
        try:
            # Get the RFID readers for this operation session
            operation_room = self.operation_session.operation_room
            readers = RFID_Reader.objects.filter(operation_room=operation_room)
            
            if not readers.exists():
                logger.error(f"No RFID readers found for operation room {operation_room.id}")
                return []
            
            # Use the rfid_scanner script to scan for tags
            scan_results = scan_rfid_tags(duration)
            logger.info(f"Found {len(scan_results)} RFID tag(s)")
            
            return scan_results
        
        except Exception as e:
            logger.error(f"Error scanning for RFID tags: {str(e)}")
            return []
    
    def _map_epcs_to_objects(self, scan_results):
        """
        Convert EPCs to database objects.
        
        Args:
            scan_results: List of scan results from scan utility
            
        Returns:
            Tuple of (instruments, trays) found
        """
        instruments = []
        trays = []
        
        # Process each scan result (EPC)
        for result in scan_results:
            epc = result.get('epc')
            if not epc:
                continue
                
            # Try to find a tag with this EPC
            try:
                tag = RFIDTag.objects.get(epc=epc)
                
                # Add the associated instrument or tray if it exists
                if tag.instrument and tag.instrument not in instruments:
                    instruments.append(tag.instrument)
                elif tag.tray and tag.tray not in trays:
                    trays.append(tag.tray)
            except RFIDTag.DoesNotExist:
                logger.warning(f"RFID tag with EPC {epc} not found in database")
        
        return instruments, trays
    
    def _get_required_items(self):
        """
        Get required instruments and trays for this operation.
        
        Returns:
            Tuple of (required_instrument_names, required_tray_names)
            where each is a dictionary mapping names to required quantities.
        """
        operation_type = self.operation_session.operation_type
        required_instrument_names = {}
        required_tray_names = {}
        
        # Get required instruments and trays from operation_type.required_instruments JSON field
        if operation_type and hasattr(operation_type, 'required_instruments'):
            data = operation_type.required_instruments
            
            # Process required instruments
            required_instrument_names = data.get('instruments', {})
            
            # Process required trays
            required_tray_names = data.get('trays', {})
    def _categorize_items(self, found_instruments, found_trays, required_instrument_names, required_tray_names):
        """
        Determine used/missing/extra/available items based on name and quantity.
        
        Args:
            found_instruments: List of instruments found
            found_trays: List of trays found
            required_instrument_names: Dict mapping required instrument names to quantities
            required_tray_names: Dict mapping required tray names to quantities
        """
        # Group found instruments by name
        found_instruments_by_name = {}
        for instrument in found_instruments:
            if instrument.name not in found_instruments_by_name:
                found_instruments_by_name[instrument.name] = []
            found_instruments_by_name[instrument.name].append(instrument)
        
        # Group found trays by name
        found_trays_by_name = {}
        for tray in found_trays:
            if tray.name not in found_trays_by_name:
                found_trays_by_name[tray.name] = []
            found_trays_by_name[tray.name].append(tray)
        
        # Process required instruments
        for name, required_qty in required_instrument_names.items():
            # Get found instruments with this name
            found_with_name = found_instruments_by_name.get(name, [])
            found_qty = len(found_with_name)
            
            # How many are used (in room/found) vs missing
            used_qty = min(found_qty, required_qty)
            missing_qty = max(0, required_qty - found_qty)
            
            # Add to used items
            if used_qty > 0:
                # Take the first 'used_qty' instruments as used
                used_instruments = found_with_name[:used_qty]
                self.used_instruments.extend(used_instruments)
                
                # Add to used_items_dict with IDs for tracking
                self.used_items_dict["instruments"][name] = {
                    "quantity": used_qty,
                    "ids": [i.id for i in used_instruments]
                }
            
            # Add to missing items
            if missing_qty > 0:
                # Query for instruments with this name that aren't in the room
                available_instruments = Instrument.objects.filter(
                    name=name, 
                    status="available"
                ).exclude(id__in=[i.id for i in found_instruments])
                
                # Store in missing_items_dict
                self.missing_items_dict["instruments"][name] = {
                    "quantity": missing_qty,
                    "available_ids": [i.id for i in available_instruments[:missing_qty]]
                }
                
                # Add available instruments (not in room but could be used) to available_items_dict
                if available_instruments:
                    self.available_items_dict["instruments"][name] = {
                        "quantity": min(missing_qty, len(available_instruments)),
                        "ids": [i.id for i in available_instruments[:missing_qty]]
                    }
                    # Add these to the available_instruments list for object tracking
                    self.available_instruments.extend(list(available_instruments[:missing_qty]))
            
            # Handle extra instruments with this name (beyond required quantity)
            if found_qty > required_qty:
                extra_instruments = found_with_name[required_qty:]
                self.extra_instruments.extend(extra_instruments)
                
                # Add to extra_items_dict
                self.extra_items_dict["instruments"][name] = {
                    "quantity": found_qty - required_qty,
                    "ids": [i.id for i in extra_instruments]
                }
        
        # Process any found instruments that aren't in the required list at all
        for name, instruments in found_instruments_by_name.items():
            if name not in required_instrument_names:
                self.extra_instruments.extend(instruments)
                self.extra_items_dict["instruments"][name] = {
                    "quantity": len(instruments),
                    "ids": [i.id for i in instruments]
                }
        
        # Process required trays (same logic as instruments)
        for name, required_qty in required_tray_names.items():
            # Get found trays with this name
            found_with_name = found_trays_by_name.get(name, [])
            found_qty = len(found_with_name)
            
            # How many are used (in room/found) vs missing
            used_qty = min(found_qty, required_qty)
            missing_qty = max(0, required_qty - found_qty)
            
            # Add to used items
            if used_qty > 0:
                # Take the first 'used_qty' trays as used
                used_trays = found_with_name[:used_qty]
                self.used_trays.extend(used_trays)
                
                # Add to used_items_dict with IDs for tracking
                self.used_items_dict["trays"][name] = {
                    "quantity": used_qty,
                    "ids": [t.id for t in used_trays]
                }
            
            # Add to missing items
            if missing_qty > 0:
                # Query for trays with this name that aren't in the room
                available_trays = Tray.objects.filter(
                    name=name, 
                    status="available"
                ).exclude(id__in=[t.id for t in found_trays])
                
                # Store in missing_items_dict
                self.missing_items_dict["trays"][name] = {
                    "quantity": missing_qty,
                    "available_ids": [t.id for t in available_trays[:missing_qty]]
                }
                
                # Add available trays (not in room but could be used) to available_items_dict
                if available_trays:
                    self.available_items_dict["trays"][name] = {
                        "quantity": min(missing_qty, len(available_trays)),
                        "ids": [t.id for t in available_trays[:missing_qty]]
                    }
                    # Add these to the available_trays list for object tracking
                    self.available_trays.extend(list(available_trays[:missing_qty]))
            
            # Handle extra trays with this name (beyond required quantity)
            if found_qty > required_qty:
                extra_trays = found_with_name[required_qty:]
                self.extra_trays.extend(extra_trays)
                
                # Add to extra_items_dict
                self.extra_items_dict["trays"][name] = {
                    "quantity": found_qty - required_qty,
                    "ids": [t.id for t in extra_trays]
                }
        
        # Process any found trays that aren't in the required list at all
        for name, trays in found_trays_by_name.items():
            if name not in required_tray_names:
                self.extra_trays.extend(trays)
                self.extra_items_dict["trays"][name] = {
                    "quantity": len(trays),
                    "ids": [t.id for t in trays]
                }
    
    def _find_potential_replacements(self):
        """
        Find available items with same names as missing items.
        
        Returns:
            Dict mapping missing item names to lists of available item IDs
        """
        matches = {}
        
        # For instruments, group by name
        for name, missing_data in self.missing_items_dict["instruments"].items():
            available_data = self.available_items_dict["instruments"].get(name)
            if available_data:
                matches[f"instrument:{name}"] = {
                    "missing_qty": missing_data["quantity"],
                    "available_ids": available_data["ids"],
                    "available_qty": available_data["quantity"]
                }
        
        # For trays, group by name
        for name, missing_data in self.missing_items_dict["trays"].items():
            available_data = self.available_items_dict["trays"].get(name)
            if available_data:
                matches[f"tray:{name}"] = {
                    "missing_qty": missing_data["quantity"],
                    "available_ids": available_data["ids"],
                    "available_qty": available_data["quantity"]
                }
                
        return matches
    
    def _update_item_states(self):
        """Set matched instruments and trays to 'in_use' state."""
        # Update instruments
        for instrument in self.used_instruments:
            instrument.status = 'in_use'
            instrument.save(update_fields=['status'])
        
        # Update trays
        for tray in self.used_trays:
            tray.status = 'in_use'
            tray.save(update_fields=['status'])
    
    def _determine_verification_state(self):
        """
        Set verification state based on missing items.
        
        Returns:
            State string: 'valid', 'incomplete', or 'invalid'
        """
        # Check if any items are missing using our name-quantity based dictionaries
        has_missing_instruments = len(self.missing_items_dict["instruments"]) > 0
        has_missing_trays = len(self.missing_items_dict["trays"]) > 0
        
        if not has_missing_instruments and not has_missing_trays:
            return 'valid'
        else:
            return 'incomplete'
    
    def _update_verification_session(self):
        """Update VerificationSession with current state and data using name-quantity based categorization."""
        self.verification_session.state = self._determine_verification_state()
        
        # Update JSON fields with our name-quantity based dictionaries
        self.verification_session.used_items = self.used_items_dict
        self.verification_session.missing_items = self.missing_items_dict
        self.verification_session.available_items = self.available_items_dict
        self.verification_session.available_matches = self._find_potential_replacements()
        
        # Save changes to database
        self.verification_session.save()
    
    def _format_result(self):
        """
        Format result for API response using name-quantity based categorization.
        
        Returns:
            Dict containing verification results with items grouped by name and quantity
        """
        return {
            "verification_id": self.verification_session.id,
            "state": self.verification_session.state,
            "used_items": self.used_items_dict,
            "missing_items": self.missing_items_dict,
            "extra_items": self.extra_items_dict,
            "available_items": self.available_items_dict,
            "available_matches": self.verification_session.available_matches
        }
