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
        
        # Track items that remain in the room
        self.remaining_instruments = []
        self.remaining_trays = []
        
        # Format for tracking remaining items
        self.remaining_items_dict = {"instruments": {}, "trays": {}}
        
        # Track extra items (not used in operation but found)
        self.extra_instruments = []
        self.extra_trays = []
        self.extra_items_dict = {"instruments": {}, "trays": {}}
        
        # Last scan results
        self.last_scan_time = None
        self.last_scan_results = None
        
        # Get or create an outbound tracking record
        self.outbound_check = self._get_or_create_outbound_tracking()
        
    def perform_outbound_check(self, scan_duration=3, verbose=False):
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
        self.last_scan_time = timezone.now()
        self.last_scan_results = scan_results
        
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
        
        # Process each scan result (EPC)
        for result in scan_results.get("tags", []):
            epc = result.get('epc')
            if not epc:
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
                except Exception as e:
                    logger.warning(f"Error checking for instrument with tag {tag.tag_id}: {str(e)}")
                
                # Check for related trays (ForeignKey from Tray to RFIDTag)
                # Tray has a ForeignKey to RFIDTag with no custom related_name
                related_trays = Tray.objects.filter(tag=tag)
                for tray in related_trays:
                    if tray not in trays:
                        logger.info(f"Found tray {tray.name} (ID: {tray.id}) with tag {tag.tag_id}")
                        trays.append(tray)
                        
                # Log warning if no instrument or tray is associated with this tag
                if not hasattr(tag, 'tag') and not related_trays.exists():
                    logger.warning(f"Tag {tag.tag_id} has no linked instrument or tray")
                    
            except RFIDTag.DoesNotExist:
                logger.warning(f"RFID tag with EPC {epc} not found in database")
        
        logger.info(f"Mapped EPCs to {len(instruments)} instruments and {len(trays)} trays")
        return instruments, trays
    
    def _identify_remaining_items(self, found_instruments, found_trays, used_items):
        """
        Identify which found items were used in the operation and remain in the room.
        Also identify extra items that weren't used in the operation but are in the room.
        
        In outbound tracking, all items found in the room (both those used in the operation
        and any extras) are considered "remaining" and need to be removed.
        
        Args:
            found_instruments: List of instruments found in the room
            found_trays: List of trays found in the room
            used_items: Dictionary of items used in the operation from verification session
        """
        # Extract used instrument and tray IDs from verification session
        used_instrument_ids = []
        used_tray_ids = []
        
        # Extract IDs from the used_items dictionary
        if 'instruments' in used_items:
            for name, data in used_items['instruments'].items():
                if 'ids' in data:
                    used_instrument_ids.extend(data['ids'])
        
        if 'trays' in used_items:
            for name, data in used_items['trays'].items():
                if 'ids' in data:
                    used_tray_ids.extend(data['ids'])
        
        # Create sets for faster lookups
        used_instrument_id_set = set(used_instrument_ids)
        used_tray_id_set = set(used_tray_ids)
        
        # Process all found instruments - track only by ID, not by name
        if found_instruments:
            # Track instruments by ID only
            found_instruments_by_id = {instrument.id: instrument for instrument in found_instruments}
            
            # Add all found instruments to the remaining list
            self.remaining_instruments = list(found_instruments)
            
            # Track each instrument by its ID in the remaining_items_dict
            for instrument in found_instruments:
                instrument_id = instrument.id
                was_used = instrument_id in used_instrument_id_set
                
                # Add as an individual entry in the remaining_items_dict
                self.remaining_items_dict['instruments'][instrument_id] = {
                    'name': instrument.name,
                    'id': instrument_id,
                    'was_used': was_used  # Track if it was used in operation
                }
                
                # Also track extra items separately for reference (not used in operation but found)
                if not was_used:
                    self.extra_instruments.append(instrument)
                    
                    # Add as individual entry in extra_items_dict
                    self.extra_items_dict['instruments'][instrument_id] = {
                        'name': instrument.name,
                        'id': instrument_id
                    }
        
        # Process all found trays - track only by ID, not by name
        if found_trays:
            # Track trays by ID only
            found_trays_by_id = {tray.id: tray for tray in found_trays}
            
            # Add all found trays to the remaining list
            self.remaining_trays = list(found_trays)
            
            # Track each tray by its ID in the remaining_items_dict
            for tray in found_trays:
                tray_id = tray.id
                was_used = tray_id in used_tray_id_set
                
                # Add as an individual entry in the remaining_items_dict
                self.remaining_items_dict['trays'][tray_id] = {
                    'name': tray.name,
                    'id': tray_id,
                    'was_used': was_used  # Track if it was used in operation
                }
                
                # Also track extra items separately for reference (not used in operation but found)
                if not was_used:
                    self.extra_trays.append(tray)
                    
                    # Add as individual entry in extra_items_dict
                    self.extra_items_dict['trays'][tray_id] = {
                        'name': tray.name,
                        'id': tray_id
                    }
    
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
        # Check if any items remain in the room
        is_room_empty = (
            len(self.remaining_instruments) == 0 and 
            len(self.remaining_trays) == 0
        )
        
        logger.debug(f"Room empty status: {is_room_empty}")
        logger.debug(f"Remaining instruments: {len(self.remaining_instruments)}")
        logger.debug(f"Remaining trays: {len(self.remaining_trays)}")
        
        # Update the outbound tracking record
        # We already have the record from __init__, just update it
        self.outbound_check.room_cleared = is_room_empty
        self.outbound_check.remaining_items = self.remaining_items_dict
        self.outbound_check.extra_items = self.extra_items_dict
        self.outbound_check.check_time = timezone.now()  # Update check time to now
        self.outbound_check.save()
        
        # Update operation session state if room is empty
        if is_room_empty:
            # Only update state if it's not already in a terminal state
            valid_states_for_transition = ['completed', 'verified']
            if self.operation_session.state in valid_states_for_transition:
                logger.info(f"Setting operation session {self.operation_session.id} to 'outbound_cleared' state")
                self.operation_session.state = 'outbound_cleared'
                self.operation_session.save(update_fields=['state', 'updated_at'])
        
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
                if hasattr(verification_session, 'used_items') and verification_session.used_items:
                    used_items = verification_session.used_items
                    logger.info(f"Found used items from verification session: {len(used_items.get('instruments', {})) + len(used_items.get('trays', {}))} items")
                else:
                    logger.info("No used items found in verification session")
            except Exception as e:
                logger.warning(f"Error getting used items from verification session: {str(e)}")
        
        return {
            "operation_session_id": self.operation_session.id,
            "outbound_check_id": self.outbound_check.id,
            "room_cleared": self.outbound_check.room_cleared,
            "check_time": self.outbound_check.check_time,
            "remaining_items": self.outbound_check.remaining_items,
            "extra_items": self.outbound_check.extra_items,
            "used_items": used_items,  # Include the used items from verification
            "scan_time": self.last_scan_time,
        }
