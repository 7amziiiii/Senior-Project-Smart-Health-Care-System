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
from or_managements.scripts.test import scan_rfid_tags

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
                'open_until': self.operation_session.scheduled_time,
                'used_items_dict': {},
                'missing_items_dict': {},
                'extra_items_dict': {},
                'available_items_dict': {}
            }
        )
        
        # Load existing data from verification session
        self.used_items_dict = self.verification_session.used_items_dict or {"instruments": {}, "trays": {}}
        self.missing_items_dict = self.verification_session.missing_items_dict or {"instruments": {}, "trays": {}}
        self.extra_items_dict = self.verification_session.extra_items_dict or {"instruments": {}, "trays": {}}
        self.available_items_dict = self.verification_session.available_items_dict or {"instruments": {}, "trays": {}}
        
        # Ensure proper structure of dictionaries
        for dict_type in [self.used_items_dict, self.missing_items_dict, self.extra_items_dict, self.available_items_dict]:
            if "instruments" not in dict_type:
                dict_type["instruments"] = {}
            if "trays" not in dict_type:
                dict_type["trays"] = {}
    
    def perform_verification(self, scan_duration=5):
        """
        Perform one verification cycle.
        
        Args:
            scan_duration: Duration to scan for RFID tags (in seconds)
            
        Returns:
            Dict containing verification results
        """
        # Get required instruments and trays by name
        required_instrument_names, required_tray_names = self._get_required_items()
        
        # Scan for tags
        scan_results = self._scan_for_tags(scan_duration)
        
        # Map EPCs to database objects
        found_instruments, found_trays = self._map_epcs_to_objects(scan_results)
        
        # Categorize items cumulatively - keeping previously found items
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
            # Get the RFID reader directly from the operation room
            operation_room = self.operation_session.operation_room
            reader = operation_room.reader
            
            if reader is None:
                logger.error(f"No RFID reader found for operation room {operation_room.id}")
                return []
            
            # Get the reader's port and baud rate
            port = reader.port
            baud_rate = reader.baud_rate
            
            logger.info(f"Using RFID reader on port {port} with baud rate {baud_rate}")
            
            # Use the rfid_scanner script to scan for tags with proper parameters
            scan_results = scan_rfid_tags(port, baud_rate, duration, verbose=False)
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
        # Handle both list format and dict with 'tags' key format
        scan_items = scan_results if isinstance(scan_results, list) else scan_results.get("tags", [])
        logger.info(f"Processing {len(scan_items)} detected tags")
        
        # Direct console output for debugging
        print(f"\n\n[DEBUG] Processing {len(scan_items)} detected tags from scanner")
        print(f"[DEBUG] Raw scan results: {scan_results}")
        print(f"[DEBUG] Scan items: {scan_items}")
        
        for result in scan_items:
            epc = result.get('epc')
            if not epc:
                continue
                
            # Try to find a tag with this EPC (stored as tag_id in the database)
            try:
                # Use tag_id field instead of epc since that's what the RFIDTag model uses
                tag = RFIDTag.objects.get(tag_id=epc)
                
                print(f"[DEBUG] Found tag {tag.tag_id} in database")
                logger.info(f"Found tag {tag.tag_id} in database")
                
                # Check for related instrument (using the reverse relation)
                try:
                    # For OneToOne field, the reverse relation is a direct attribute
                    print(f"[DEBUG] Checking instrument relations for tag {tag.tag_id}")
                    # Try direct attribute access first
                    try:
                        instrument = tag.instrument
                        print(f"[DEBUG] Found direct instrument relation: {instrument}")
                    except AttributeError:
                        instrument = None
                        print(f"[DEBUG] No direct 'instrument' attribute on tag")
                        
                    # If that didn't work, try the 'tag' attribute
                    if not instrument:
                        try:
                            instrument = tag.tag
                            print(f"[DEBUG] Found instrument via 'tag' attribute: {instrument}")
                        except AttributeError:
                            print(f"[DEBUG] No 'tag' attribute on tag either")
                            instrument = None
                    
                    # Print all tag attributes to help debug
                    print(f"[DEBUG] Tag attributes: {dir(tag)}")
                    
                    if instrument and instrument not in instruments:
                        print(f"[DEBUG] Adding instrument {instrument.name} to found list")
                        logger.info(f"Found instrument {instrument.name} with tag {tag.tag_id}")
                        instruments.append(instrument)
                    else:
                        print(f"[DEBUG] Tag {tag.tag_id} does not have a valid instrument relation")
                        logger.warning(f"Tag {tag.tag_id} does not have a valid instrument relation")
                except Instrument.DoesNotExist:
                    pass
                
                # Check for related trays (there could be multiple with ForeignKey)
                try:
                    related_trays = Tray.objects.filter(tag=tag)
                    logger.info(f"Found {related_trays.count()} trays for tag {tag.tag_id}")
                    
                    for tray in related_trays:
                        if tray not in trays:
                            logger.info(f"Found tray {tray.name} (ID: {tray.id}) with tag {tag.tag_id}")
                            trays.append(tray)
                except Exception as e:
                    logger.error(f"Error fetching trays for tag {tag.tag_id}: {str(e)}")
                    
                # If no instruments or trays found with this tag, log a clear warning
                if not getattr(tag, 'instrument', None) and not getattr(tag, 'tag', None) and not related_trays.exists():
                    logger.warning(f"Tag {tag.tag_id} has no linked instrument or tray in the database")
                        
                if not hasattr(tag, 'tag') and not related_trays:
                    logger.warning(f"Tag {tag.tag_id} has no linked instrument or tray")
            except RFIDTag.DoesNotExist:
                logger.warning(f"RFID tag with EPC {epc} not found in database")
        
        logger.info(f"Mapped EPCs to {len(instruments)} instruments and {len(trays)} trays")
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
        
        # Always return a tuple, even if empty dictionaries
        return required_instrument_names, required_tray_names
    
    def _categorize_items(self, found_instruments, found_trays, required_instrument_names, required_tray_names):
        """
        Determine used/missing/extra/available items based on name and quantity.
        
        Args:
            found_instruments: List of instruments found
            found_trays: List of trays found
            required_instrument_names: Dict mapping required instrument names to quantities
            required_tray_names: Dict mapping required tray names to quantities
        """
        # Create dictionary of found instruments by name
        found_instruments_by_name = {}
        for instrument in found_instruments:
            name = instrument.name
            if name not in found_instruments_by_name:
                found_instruments_by_name[name] = []
            found_instruments_by_name[name].append(instrument)
        
        # Create dictionary of found trays by name
        found_trays_by_name = {}
        for tray in found_trays:
            name = tray.name
            if name not in found_trays_by_name:
                found_trays_by_name[name] = []
            found_trays_by_name[name].append(tray)
        
        # Get IDs of instruments just found in this scan for status updates
        current_scan_instrument_ids = {instrument.id for instrument in found_instruments}
        current_scan_tray_ids = {tray.id for tray in found_trays}
            
        # Temporary sets to track which items have been processed in this scan
        processed_instrument_names = set()
        processed_tray_names = set()
        
        # Categorize instruments
        for name, required_quantity in required_instrument_names.items():
            found_quantity = len(found_instruments_by_name.get(name, []))
            
            # Add to processed set
            processed_instrument_names.add(name)
            
            # If already tracked in used_items, update quantities and maintain previous ids
            if name in self.used_items_dict["instruments"]:
                previous_ids = self.used_items_dict["instruments"][name].get("ids", [])
                current_ids = [i.id for i in found_instruments_by_name.get(name, [])]
                
                # Combine previous IDs with currently found IDs
                combined_ids = list(set(previous_ids) | set(current_ids))
                combined_quantity = len(combined_ids)
                
                # If we have enough or excess, they're used items
                if combined_quantity >= required_quantity:
                    self.used_items_dict["instruments"][name] = {
                        "quantity": min(combined_quantity, required_quantity),  # Only count up to required
                        "ids": combined_ids[:required_quantity]  # Only include the required quantity
                    }
                    
                    # If we found more than needed, put extras in available
                    if combined_quantity > required_quantity:
                        excess_ids = combined_ids[required_quantity:]
                        if name not in self.available_items_dict["instruments"]:
                            self.available_items_dict["instruments"][name] = {"quantity": 0, "ids": []}
                        self.available_items_dict["instruments"][name] = {
                            "quantity": len(excess_ids),
                            "ids": excess_ids
                        }
                        
                    # Remove from missing if previously there
                    if name in self.missing_items_dict["instruments"]:
                        del self.missing_items_dict["instruments"][name]
                else:
                    # Still missing some, update with what we have found
                    self.used_items_dict["instruments"][name] = {
                        "quantity": combined_quantity,
                        "ids": combined_ids
                    }
                    # Still missing some quantity
                    self.missing_items_dict["instruments"][name] = {
                        "quantity": required_quantity - combined_quantity,
                        "ids": []
                    }
            else:
                # Not previously tracked, handle as new
                if found_quantity > 0:
                    # Mark as used up to the required quantity
                    used_quantity = min(found_quantity, required_quantity)
                    used_instruments = found_instruments_by_name[name][:used_quantity]
                    
                    self.used_items_dict["instruments"][name] = {
                        "quantity": used_quantity,
                        "ids": [instrument.id for instrument in used_instruments]
                    }
                    
                    # If excess, mark as available
                    if found_quantity > required_quantity:
                        available_quantity = found_quantity - required_quantity
                        available_instruments = found_instruments_by_name[name][required_quantity:]
                        
                        self.available_items_dict["instruments"][name] = {
                            "quantity": available_quantity,
                            "ids": [instrument.id for instrument in available_instruments]
                        }
                        
                    # If some still missing, track quantity needed
                    if found_quantity < required_quantity:
                        self.missing_items_dict["instruments"][name] = {
                            "quantity": required_quantity - found_quantity,
                            "ids": []
                        }
                else:
                    # Not found any, mark as missing
                    self.missing_items_dict["instruments"][name] = {
                        "quantity": required_quantity,
                        "ids": []
                    }
        
        # Categorize trays - similar logic as instruments
        for name, required_quantity in required_tray_names.items():
            found_quantity = len(found_trays_by_name.get(name, []))
            
            # Add to processed set
            processed_tray_names.add(name)
            
            # If already tracked in used_items, update quantities and maintain previous ids
            if name in self.used_items_dict["trays"]:
                previous_ids = self.used_items_dict["trays"][name].get("ids", [])
                current_ids = [t.id for t in found_trays_by_name.get(name, [])]
                
                # Combine previous IDs with currently found IDs
                combined_ids = list(set(previous_ids) | set(current_ids))
                combined_quantity = len(combined_ids)
                
                # If we have enough or excess, they're used items
                if combined_quantity >= required_quantity:
                    self.used_items_dict["trays"][name] = {
                        "quantity": min(combined_quantity, required_quantity),  # Only count up to required
                        "ids": combined_ids[:required_quantity]  # Only include the required quantity
                    }
                    
                    # If we found more than needed, put extras in available
                    if combined_quantity > required_quantity:
                        excess_ids = combined_ids[required_quantity:]
                        if name not in self.available_items_dict["trays"]:
                            self.available_items_dict["trays"][name] = {"quantity": 0, "ids": []}
                        self.available_items_dict["trays"][name] = {
                            "quantity": len(excess_ids),
                            "ids": excess_ids
                        }
                        
                    # Remove from missing if previously there
                    if name in self.missing_items_dict["trays"]:
                        del self.missing_items_dict["trays"][name]
                else:
                    # Still missing some, update with what we have found
                    self.used_items_dict["trays"][name] = {
                        "quantity": combined_quantity,
                        "ids": combined_ids
                    }
                    # Still missing some quantity
                    self.missing_items_dict["trays"][name] = {
                        "quantity": required_quantity - combined_quantity,
                        "ids": []
                    }
            else:
                # Not previously tracked, handle as new
                if found_quantity > 0:
                    # Mark as used up to the required quantity
                    used_quantity = min(found_quantity, required_quantity)
                    used_trays = found_trays_by_name[name][:used_quantity]
                    
                    self.used_items_dict["trays"][name] = {
                        "quantity": used_quantity,
                        "ids": [tray.id for tray in used_trays]
                    }
                    
                    # If excess, mark as available
                    if found_quantity > required_quantity:
                        available_quantity = found_quantity - required_quantity
                        available_trays = found_trays_by_name[name][required_quantity:]
                        
                        self.available_items_dict["trays"][name] = {
                            "quantity": available_quantity,
                            "ids": [tray.id for tray in available_trays]
                        }
                        
                    # If some still missing, track quantity needed
                    if found_quantity < required_quantity:
                        self.missing_items_dict["trays"][name] = {
                            "quantity": required_quantity - found_quantity,
                            "ids": []
                        }
                else:
                    # Not found any, mark as missing
                    self.missing_items_dict["trays"][name] = {
                        "quantity": required_quantity,
                        "ids": []
                    }
        
        # Handle extra instruments (not required for operation)
        for name, instruments in found_instruments_by_name.items():
            if name not in required_instrument_names:
                # This instrument isn't required, so it's extra
                self.extra_items_dict["instruments"][name] = {
                    "quantity": len(instruments),
                    "ids": [instrument.id for instrument in instruments]
                }
                
        # Handle extra trays (not required for operation)
        for name, trays in found_trays_by_name.items():
            if name not in required_tray_names:
                # This tray isn't required, so it's extra
                self.extra_items_dict["trays"][name] = {
                    "quantity": len(trays),
                    "ids": [tray.id for tray in trays]
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
        """Set matched instruments to 'in_use' state."""
        # Update instruments based on used_items_dict
        for name, data in self.used_items_dict.get('instruments', {}).items():
            # Get the IDs of used instruments
            instrument_ids = data.get('ids', [])
            
            # Update status for each instrument
            Instrument.objects.filter(id__in=instrument_ids).update(status='in_use')
    
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
        self.verification_session.used_items_dict = self.used_items_dict
        self.verification_session.missing_items_dict = self.missing_items_dict
        self.verification_session.extra_items_dict = self.extra_items_dict
        self.verification_session.available_items_dict = self.available_items_dict
        
        # Save changes to database
        self.verification_session.save()
    
    def _format_items_for_tab(self, items_dict):
        """
        Transform the nested dictionary structure into a flat list format for frontend tables.
        
        Args:
            items_dict: Dictionary with instruments and trays grouped by name and quantity
            
        Returns:
            List of items formatted for frontend tables with name, type, and quantity
        """
        result = []
        
        # Process instruments
        for name, data in items_dict.get('instruments', {}).items():
            result.append({
                'name': name,
                'type': 'Instrument',
                'quantity': data.get('quantity', 0)
            })
            
        # Process trays
        for name, data in items_dict.get('trays', {}).items():
            result.append({
                'name': name,
                'type': 'Tray',
                'quantity': data.get('quantity', 0)
            })
            
        return result
    
    def _format_result(self):
        """
        Format result for API response using name-quantity based categorization.
        
        Returns:
            Dict containing verification results with items grouped by name and quantity
        """
        # Format output to match frontend tabs: Missing, Present, Extra, All Required
        present_items = self._format_items_for_tab(self.used_items_dict)
        missing_items = self._format_items_for_tab(self.missing_items_dict)
        extra_items = self._format_items_for_tab(self.extra_items_dict)
        
        # Combine used and missing for All Required
        required_items = []
        required_items.extend(present_items)
        required_items.extend(missing_items)
        
        return {
            "verification_id": self.verification_session.id,
            "state": self.verification_session.state,
            "tabs": {
                "present": {
                    "count": len(present_items),
                    "items": present_items
                },
                "missing": {
                    "count": len(missing_items),
                    "items": missing_items
                },
                "extra": {
                    "count": len(extra_items),
                    "items": extra_items
                },
                "required": {
                    "count": len(required_items),
                    "items": required_items
                }
            },
            # Keep original data structure for backward compatibility
            "used_items": self.used_items_dict,
            "missing_items": self.missing_items_dict,
            "extra_items": self.extra_items_dict,
            "available_items": self.available_items_dict
        }
