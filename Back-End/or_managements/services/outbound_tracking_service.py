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
    Tray
)
from or_managements.models.outbound_tracking import OutboundTracking
from or_managements.scripts.test import scan_rfid_tags

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
        
        # # Check if this session is already in the outbound_cleared state
        # if self.operation_session.state == 'outbound_cleared':
        #     raise ValueError(
        #         f"Operation session {operation_session_id} is already in 'outbound_cleared' state. "
        #         "No further outbound tracking is needed."
        #     )
            
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
        
        # Get or create an outbound tracking record
        self.outbound_check = self._get_or_create_outbound_tracking()
        
        # Load existing data from the outbound tracking record if it exists
        self.remaining_items = self.outbound_check.remaining_items or {"instruments": {}, "trays": {}}
        self.extra_items = self.outbound_check.extra_items or {"instruments": {}, "trays":{}}
        
        # Ensure dictionaries have the correct structure
        for dict_type in [self.remaining_items, self.extra_items]:
            if "instruments" not in dict_type:
                dict_type["instruments"] = {}
            if "trays" not in dict_type:
                dict_type["trays"] = {}
        
        # Track items that remain in the room - will be populated from remaining_items_dict when needed
        self.remaining_instruments = []
        self.remaining_trays = []
        
        # Track extra items (not used in operation but found) - will be populated from extra_items_dict when needed
        self.extra_instruments = []
        self.extra_trays = []
        
        # Last scan results
        self.last_scan_time = None
        self.last_scan_results = None
        
    def perform_outbound_check(self, scan_duration=5, verbose=True):
        """
        Perform an outbound tracking check to identify which instruments and trays
        are still present in the operation room after the operation has concluded.
            
        Args:
            scan_duration: How long to scan for RFID tags (in seconds)
            verbose: Whether to print detailed logs
            
        Returns:
            Dict containing outbound tracking results
        """
        logger.info(f"===== STARTING OUTBOUND CHECK for session {self.operation_session.id} =====")
        
        # Get or create the outbound tracking record (reuse existing if it exists)
        if not hasattr(self, 'outbound_check') or not self.outbound_check:
            self.outbound_check = self._get_or_create_outbound_tracking()
            logger.debug(f"Got outbound check record: {self.outbound_check.id}")
        
        # Reset dictionaries for this scan (non-cumulative tracking)
        self.remaining_items = {"instruments": {}, "trays": {}}
        self.extra_items = {"instruments": {}, "trays": {}}
        logger.debug("Reset tracking dictionaries for fresh scan")
                
        # Reset instance lists for this scan cycle - these are temporary
        # They'll be populated from the scan and used to update self.remaining_items and self.extra_items
        self.remaining_instruments = []
        self.remaining_trays = []
        self.extra_instruments = []
        self.extra_trays = []
        logger.debug("Reset tracking lists for fresh scan")
        
        # Get items that were used in the operation from the verification session
        used_items = self.verification_session.used_items_dict
        logger.debug(f"Used items from verification: {used_items}")
        
        # Check if used_items has the expected structure
        if not isinstance(used_items, dict):
            logger.error(f"Used items is not a dictionary: {type(used_items)}")
        elif "instruments" not in used_items or "trays" not in used_items:
            logger.error(f"Used items missing expected keys: {used_items.keys()}")
        else:
            logger.info(f"Used items count: {len(used_items.get('instruments', {}))} instruments, {len(used_items.get('trays', {}))} trays")
        
        # Scan for tags
        logger.info(f"Starting RFID scan for {scan_duration} seconds")
        scan_results = self._scan_for_tags(scan_duration, verbose)
        self.last_scan_time = timezone.now()
        self.last_scan_results = scan_results
        logger.debug(f"Scan complete. Raw scan results: {scan_results}")
        if "tags" in scan_results:
            logger.info(f"Scan detected {len(scan_results.get('tags', []))} tags")
        else:
            logger.warning("Scan results missing 'tags' key")
            logger.debug(f"Unexpected scan result format: {scan_results}")
        
        # Log each tag found
        for i, tag in enumerate(scan_results.get("tags", [])):
            logger.debug(f"Tag {i+1}: {tag}")
        
        # Map EPCs to database objects
        found_instruments, found_trays = self._map_epcs_to_objects(scan_results)
        
        # Get used items from verification session
        used_items = self.verification_session.used_items_dict
        
        # Check which found items were used in the operation
        self._identify_remaining_items(found_instruments, found_trays, used_items)
        
        # Update operation session
        self._update_operation_session()
        
        # Return formatted result
        return self._format_result()
    
    def get_outbound_status(self):
        """
        Get the current outbound tracking status.
        
        This method requires a recent scan to have been performed.
        
        Returns:
            Dict containing outbound tracking status
        """
        # Require a scan before checking status
        if self.last_scan_time is None:
            raise ValueError("No scan has been performed yet. Call perform_outbound_check() first.")
        
        # Check if the last scan is recent (within 1 minute)
        if timezone.now() - self.last_scan_time > timezone.timedelta(minutes=1):
            raise ValueError(
                "Last scan is too old. Please perform a new scan with perform_outbound_check() first."
            )
            
        # Return the latest formatted result
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
        try:
            # Get the RFID reader directly from the operation room
            operation_room = self.operation_session.operation_room
            reader = operation_room.reader
            
            if reader is None:
                logger.error(f"No RFID reader found for operation room {operation_room.id}")
                return {"tags": []}
            
            # Get the reader's port and baud rate
            port = reader.port
            baud_rate = reader.baud_rate
            
            logger.info(f"Using RFID reader on port {port} with baud rate {baud_rate}")
            
            # Use the rfid_scanner script to scan for tags with proper parameters
            scan_results = scan_rfid_tags(port, baud_rate, duration, verbose=verbose)
            logger.info(f"Found {len(scan_results.get('tags', []))} RFID tag(s)")
            
            return scan_results
            
        except Exception as e:
            logger.error(f"Error scanning for RFID tags: {str(e)}")
            return {"tags": []}
    
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
        
        logger.info(f"Mapping {len(scan_results.get('tags', []))} EPCs to database objects")
        
        # Process each scan result (EPC)
        for i, result in enumerate(scan_results.get("tags", [])):
            epc = result.get('epc')
            if not epc:
                logger.warning(f"Scan result {i+1} missing EPC")
                continue
                
            # Try to find a tag with this EPC (stored as tag_id in the database)
            try:
                # Use tag_id field instead of epc since that's what the RFIDTag model uses
                tag = RFIDTag.objects.get(tag_id=epc)
                
                logger.info(f"Found tag {tag.tag_id} in database")
                
                # Check for related instrument (using the reverse relation from OneToOneField)
                # Instrument has a OneToOneField to RFIDTag with related_name='tag'
                try:
                    # For OneToOne field with related_name='tag', access through tag.tag
                    if hasattr(tag, 'tag') and tag.tag is not None:
                        instrument = tag.tag
                        if instrument not in instruments:
                            logger.info(f"Found instrument {instrument.name} (ID: {instrument.id}) with tag {tag.tag_id}")
                            instruments.append(instrument)
                        else:
                            logger.debug(f"Instrument {instrument.name} (ID: {instrument.id}) already in list")
                    else:
                        logger.debug(f"Tag {tag.tag_id} has no related instrument")
                except Exception as e:
                    logger.warning(f"Error checking for instrument with tag {tag.tag_id}: {str(e)}")
                
                # Check for related trays (ForeignKey from Tray to RFIDTag)
                # Tray has a ForeignKey to RFIDTag with no custom related_name
                related_trays = Tray.objects.filter(tag=tag)
                if related_trays.exists():
                    logger.info(f"Found {related_trays.count()} trays for tag {tag.tag_id}")
                    for tray in related_trays:
                        if tray not in trays:
                            logger.info(f"Found tray {tray.name} (ID: {tray.id}) with tag {tag.tag_id}")
                            trays.append(tray)
                        else:
                            logger.debug(f"Tray {tray.name} (ID: {tray.id}) already in list")
                else:
                    logger.debug(f"Tag {tag.tag_id} has no related trays")
            except RFIDTag.DoesNotExist:
                logger.warning(f"RFID tag with EPC {epc} not found in database")
        
        logger.info(f"Mapped EPCs to {len(instruments)} instruments and {len(trays)} trays")
        return instruments, trays
    
    def _identify_remaining_items(self, found_instruments, found_trays, used_items):
        """
        Identify which found items were used in the operation and remain in the room.
        Also identify extra items that weren't used in the operation but are in the room.
        
        Args:
            found_instruments: List of instruments found in the room
            found_trays: List of trays found in the room
            used_items: Dictionary of items used in the operation
        """
        logger.info(f"===== IDENTIFYING REMAINING ITEMS =====")
        logger.info(f"Found instruments: {len(found_instruments)}, Found trays: {len(found_trays)}")
        
        # Reset the tracking lists for this scan
        self.remaining_instruments = []
        self.remaining_trays = []
        self.extra_instruments = []
        self.extra_trays = []
        
        # Also reset the tracking dictionaries - we are not cumulative
        self.remaining_items = {"instruments": {}, "trays": {}}
        self.extra_items = {"instruments": {}, "trays": {}}
        
        # Process instruments
        logger.debug(f"Processing {len(found_instruments)} found instruments")
        for instrument in found_instruments:
            logger.debug(f"Checking instrument: ID={instrument.id}, Name={instrument.name}")
            
            # Check if this instrument was used in the operation
            name = instrument.name
            instrument_used = False
            
            # Check in used_items dict
            if 'instruments' in used_items and name in used_items['instruments']:
                instrument_used = True
                logger.debug(f"Instrument {name} was used in operation")
                
                # Add to remaining items (those that were used but still in room)
                self.remaining_instruments.append(instrument)
                
                # Add to remaining_items dict
                if name not in self.remaining_items["instruments"]:
                    self.remaining_items["instruments"][name] = {"quantity": 0, "ids": []}
                
                # Track this specific instrument
                self.remaining_items["instruments"][name]["ids"].append(instrument.id)
                self.remaining_items["instruments"][name]["quantity"] = len(self.remaining_items["instruments"][name]["ids"])
            else:
                # If not used in the operation, it's extra
                logger.debug(f"Instrument {name} was NOT used in operation - marking as EXTRA")
                self.extra_instruments.append(instrument)
                
                # Add to extra_items tracking
                if name not in self.extra_items["instruments"]:
                    self.extra_items["instruments"][name] = {"quantity": 0, "ids": []}
                
                # Track this specific instrument
                self.extra_items["instruments"][name]["ids"].append(instrument.id)
                self.extra_items["instruments"][name]["quantity"] = len(self.extra_items["instruments"][name]["ids"])
        
        # Process trays
        logger.debug(f"Processing {len(found_trays)} found trays")
        for tray in found_trays:
            logger.debug(f"Checking tray: ID={tray.id}, Name={tray.name}")
            
            # Check if this tray was used in the operation
            name = tray.name
            tray_used = False
            
            # Check in used_items dict
            if 'trays' in used_items and name in used_items['trays']:
                tray_used = True
                logger.debug(f"Tray {name} was used in operation")
                
                # Add to remaining items (those that were used but still in room)
                self.remaining_trays.append(tray)
                
                # Add to remaining_items dict
                if name not in self.remaining_items["trays"]:
                    self.remaining_items["trays"][name] = {"quantity": 0, "ids": []}
                
                # Track this specific tray
                self.remaining_items["trays"][name]["ids"].append(tray.id)
                self.remaining_items["trays"][name]["quantity"] = len(self.remaining_items["trays"][name]["ids"])
            else:
                # If not used in the operation, it's extra
                logger.debug(f"Tray {name} was NOT used in operation - marking as EXTRA")
                self.extra_trays.append(tray)
                
                # Add to extra_items tracking
                if name not in self.extra_items["trays"]:
                    self.extra_items["trays"][name] = {"quantity": 0, "ids": []}
                
                # Track this specific tray
                self.extra_items["trays"][name]["ids"].append(tray.id)
                self.extra_items["trays"][name]["quantity"] = len(self.extra_items["trays"][name]["ids"])
        
        # Log the final counts
        logger.info(f"Identified {len(self.remaining_instruments)} remaining instruments")
        logger.info(f"Identified {len(self.remaining_trays)} remaining trays")
        logger.info(f"Identified {len(self.extra_instruments)} extra instruments")
        logger.info(f"Identified {len(self.extra_trays)} extra trays")
        
        # Debug the dictionaries to ensure they're being populated correctly
        logger.debug(f"Remaining items dict: {self.remaining_items}")
        logger.debug(f"Extra items dict: {self.extra_items}")

    def _get_or_create_outbound_tracking(self):
        """
        Get the most recent outbound tracking record for this operation session,
        or create a new one if none exists.
        
        Returns:
            OutboundTracking instance
        """
        try:
            # Try to get the latest outbound tracking record for this operation session
            latest = OutboundTracking.objects.filter(
                operation_session=self.operation_session
            ).order_by('-check_time').first()
            
            if latest:
                logger.debug(f"Found existing outbound tracking record: {latest.id}")
                return latest
                
        except Exception as e:
            logger.warning(f"Error when looking for existing outbound tracking record: {str(e)}")
        
        # No existing record found or error occurred, create a new one
        try:
            # Get user from verification session if available
            user = None
            if hasattr(self, 'verification_session') and self.verification_session:
                user = getattr(self.verification_session, 'verified_by', None)
                
            # Create new outbound tracking record - get_or_create returns (object, created)
            new_record, created = OutboundTracking.objects.get_or_create(
                operation_session=self.operation_session,
                defaults={
                    'room_cleared': False,  # Default to room not cleared
                    'checked_by': user,
                    'remaining_items': {},
                    'extra_items': {}
                }
            )
            
            if created:
                logger.debug(f"Created new outbound tracking record: {new_record.id}")
            else:
                logger.debug(f"Retrieved existing outbound tracking record: {new_record.id}")
                
            return new_record
            
        except Exception as e:
            logger.error(f"Failed to create outbound tracking record: {str(e)}")
            raise
    
    def _update_operation_session(self):
        """
        Update the outbound tracking record with room status and update operation session state.
        
        If the room is empty (no remaining items), the operation session state is 
        automatically updated to 'outbound_cleared'.
        """
        logger.info("===== UPDATING OPERATION SESSION WITH ROOM STATUS =====")
        
        # Log all the remaining items for debugging
        logger.debug("Detailed remaining instruments list:")
        for i, instrument in enumerate(self.remaining_instruments):
            logger.debug(f"  Remaining instrument {i+1}: ID={instrument.id}, Name={instrument.name}")
            
        logger.debug("Detailed remaining trays list:")
        for i, tray in enumerate(self.remaining_trays):
            logger.debug(f"  Remaining tray {i+1}: ID={tray.id}, Name={tray.name}")
            
        # Check if any items remain in the room
        is_room_empty = (
            len(self.remaining_instruments) == 0 and 
            len(self.remaining_trays) == 0
        )
        
        logger.info(f"ROOM CLEARED STATUS: {is_room_empty}")
        logger.info(f"Remaining instruments: {len(self.remaining_instruments)}")
        logger.info(f"Remaining trays: {len(self.remaining_trays)}")
        
        # Log the remaining_items dictionary content for debugging
        logger.debug(f"Remaining items dict: {self.remaining_items}")
        logger.debug(f"Extra items dict: {self.extra_items}")
        
        # Update the outbound tracking record
        # We already have the record from __init__, just update it
        self.outbound_check.room_cleared = is_room_empty
        self.outbound_check.remaining_items = self.remaining_items
        self.outbound_check.extra_items = self.extra_items
        self.outbound_check.check_time = timezone.now()  # Update check time to now
        
        # Log the state before saving
        logger.debug(f"Saving outbound check record: ID={self.outbound_check.id}, room_cleared={is_room_empty}")
        self.outbound_check.save()
        
        # Always update operation session state based on room status
        old_state = self.operation_session.state
        if is_room_empty:
            logger.info(f"Setting operation session {self.operation_session.id} to 'outbound_cleared' state (was '{old_state}')")
            self.operation_session.state = 'outbound_cleared'
        else:
            logger.info(f"Room not cleared, setting operation session {self.operation_session.id} to 'verified' state (was '{old_state}')")
            self.operation_session.state = 'verified'
        
        # Always save the state change
        logger.debug(f"Saving operation session: ID={self.operation_session.id}, new state={self.operation_session.state}")
        self.operation_session.save(update_fields=['state'])
        
        # Record has already been stored as self.outbound_check
    
    def _format_result(self):
        """
        Format result for API response.
        
        Returns:
            Dict containing outbound tracking results
        """
        if not self.outbound_check:
            raise ValueError("No outbound check has been performed. Call perform_outbound_check() first.")
            
        # Get used items from the verification session
        used_items = {}
        if hasattr(self.operation_session, 'verificationsession'):
            # Try to get used items from verification session
            try:
                verification_session = self.operation_session.verificationsession
                if hasattr(verification_session, 'used_items_dict') and verification_session.used_items_dict:
                    used_items = verification_session.used_items_dict
                    logger.info(f"Found used items from verification session: {len(used_items.get('instruments', {})) + len(used_items.get('trays', {}))} items")
                else:
                    logger.info("No used items found in verification session")
            except Exception as e:
                logger.warning(f"Error getting used items from verification session: {str(e)}")
        
        # Calculate current presence status for remaining and extra items
        current_time = timezone.now().isoformat()
        processed_remaining_items = self.outbound_check.remaining_items.copy() if self.outbound_check.remaining_items else {"instruments": {}, "trays": {}}
        processed_extra_items = self.outbound_check.extra_items.copy() if self.outbound_check.extra_items else {"instruments": {}, "trays": {}}
        
        # Add presence status to all items
        for item_dict in [processed_remaining_items, processed_extra_items]:
            for item_type in ['instruments', 'trays']:
                if item_type in item_dict:
                    for item_id, item_data in item_dict[item_type].items():
                        # Mark if item is currently present or not
                        if 'last_seen' not in item_data:
                            item_data['currently_present'] = True
                        else:
                            item_data['currently_present'] = False
        
        return {
            "operation_session_id": self.operation_session.id,
            "outbound_check_id": self.outbound_check.id,
            "room_cleared": self.outbound_check.room_cleared,
            "check_time": self.outbound_check.check_time,
            "remaining_items": processed_remaining_items,
            "extra_items": processed_extra_items,
            "used_items": used_items,  # Include the used items from verification
            "scan_time": self.last_scan_time,
            "scan_history": {
                "timestamp": current_time,
                "found_instrument_count": len(self.remaining_instruments) + len(self.extra_instruments),
                "found_tray_count": len(self.remaining_trays) + len(self.extra_trays)
            }
        }
