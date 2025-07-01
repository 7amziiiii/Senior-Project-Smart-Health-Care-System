"""
Tests for the VerificationService.
"""

import time
from datetime import datetime, timedelta
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from or_managements.models import (
    OperationSession,
    OperationType,
    OperationRoom,
    RFID_Reader,
    RFIDTag,
    Instrument,
    Tray,
    VerificationSession
)
from or_managements.services.verification_service import VerificationService


class VerificationServiceTestCase(TestCase):
    """Test cases for the VerificationService."""
    
    def setUp(self):
        """Set up test data."""
        # Create operation type with required instruments
        self.operation_type = OperationType.objects.create(
            name="Test Operation",
            required_instruments={
                "instrument_ids": [1, 2],  # Will create these instruments below
                "tray_ids": [1]  # Will create this tray below
            }
        )
        
        # Create operation room
        self.room = OperationRoom.objects.create(
            name="Test Room",
            number="101"
        )
        
        # Create RFID reader
        self.reader = RFID_Reader.objects.create(
            name="Test Reader",
            location="Test Room",
            port="COM3",
            baud_rate=9600,
            operationroom=self.room
        )
        
        # Create instruments
        self.instrument1 = Instrument.objects.create(
            id=1,
            name="Scalpel",
            status="available"
        )
        
        self.instrument2 = Instrument.objects.create(
            id=2,
            name="Forceps",
            status="available"
        )
        
        # Create another instrument for available but not required
        self.instrument3 = Instrument.objects.create(
            id=3,
            name="Retractor",
            status="available"
        )
        
        # Create instrument with same name as missing one for replacement testing
        self.instrument4 = Instrument.objects.create(
            id=4,
            name="Forceps",  # Same name as instrument2
            status="available"
        )
        
        # Create tray
        self.tray1 = Tray.objects.create(
            id=1,
            name="Surgery Tray",
            status="available"
        )
        
        # Create RFID tags
        self.tag1 = RFIDTag.objects.create(
            epc="035CC5007318024218305BE9",
            instrument=self.instrument1
        )
        
        self.tag3 = RFIDTag.objects.create(
            epc="035F150074E0061203044F4",
            instrument=self.instrument3
        )
        
        self.tag4 = RFIDTag.objects.create(
            epc="035CC4007318024318305BE2",
            instrument=self.instrument4
        )
        
        self.tag_tray = RFIDTag.objects.create(
            epc="035CC3007318024518305BE3",
            tray=self.tray1
        )
        
        # Create operation session
        self.operation_session = OperationSession.objects.create(
            type=self.operation_type,
            room=self.room,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=2)
        )
    
    @mock.patch('or_managements.services.verification_service.scan_all_rfid_tags')
    def test_perform_verification(self, mock_scan):
        """Test the perform_verification method."""
        # Mock scan results
        mock_scan.return_value = [
            {
                "epc": "035CC5007318024218305BE9",  # instrument1 (required)
                "reader_id": self.reader.id,
                "timestamp": timezone.now().isoformat()
            },
            {
                "epc": "035F150074E0061203044F4",  # instrument3 (not required)
                "reader_id": self.reader.id,
                "timestamp": timezone.now().isoformat()
            }
        ]
        
        # Create verification service
        service = VerificationService(self.operation_session.id)
        
        # Perform verification
        result = service.perform_verification()
        
        # Verify results
        self.assertEqual(result['state'], 'incomplete')
        
        # Should find instrument1 as used
        self.assertEqual(len(result['used_items']['instruments']), 1)
        self.assertEqual(result['used_items']['instruments'][0]['id'], self.instrument1.id)
        
        # Should find instrument2 as missing
        self.assertEqual(len(result['missing_items']['instruments']), 1)
        self.assertEqual(result['missing_items']['instruments'][0]['id'], self.instrument2.id)
        
        # Should find instrument3 as available
        self.assertEqual(len(result['available_items']['instruments']), 1)
        self.assertEqual(result['available_items']['instruments'][0]['id'], self.instrument3.id)
        
        # Should find tray1 as missing
        self.assertEqual(len(result['missing_items']['trays']), 1)
        
        # Check database updates
        self.instrument1.refresh_from_db()
        self.assertEqual(self.instrument1.status, 'in_use')
        
        # Check verification session updates
        verification_session = VerificationSession.objects.get(operation_session=self.operation_session)
        self.assertEqual(verification_session.state, 'incomplete')
        self.assertEqual(verification_session.used_items['instrument_ids'], [self.instrument1.id])
    
    @mock.patch('or_managements.services.verification_service.scan_all_rfid_tags')
    def test_perform_verification_with_potential_replacements(self, mock_scan):
        """Test finding potential replacements for missing items."""
        # Mock scan results - include instrument4 which has same name as missing instrument2
        mock_scan.return_value = [
            {
                "epc": "035CC5007318024218305BE9",  # instrument1 (required)
                "reader_id": self.reader.id,
                "timestamp": timezone.now().isoformat()
            },
            {
                "epc": "035CC4007318024318305BE2",  # instrument4 (same name as instrument2)
                "reader_id": self.reader.id,
                "timestamp": timezone.now().isoformat()
            }
        ]
        
        # Create verification service
        service = VerificationService(self.operation_session.id)
        
        # Perform verification
        result = service.perform_verification()
        
        # Check for potential replacements
        verification_session = VerificationSession.objects.get(operation_session=self.operation_session)
        self.assertTrue('missing_instrument_2' in verification_session.available_matches)
        self.assertEqual(verification_session.available_matches['missing_instrument_2'], [self.instrument4.id])
    
    @mock.patch('or_managements.services.verification_service.scan_all_rfid_tags')
    @mock.patch('or_managements.services.verification_service.time.sleep')
    def test_start_continuous_verification_stops_when_complete(self, mock_sleep, mock_scan):
        """Test that continuous verification stops when all items are found."""
        # First scan: only instrument1
        # Second scan: all required items
        mock_scan.side_effect = [
            # First scan: missing items
            [
                {
                    "epc": "035CC5007318024218305BE9",  # instrument1 (required)
                    "reader_id": self.reader.id,
                    "timestamp": timezone.now().isoformat()
                }
            ],
            # Second scan: all items found
            [
                {
                    "epc": "035CC5007318024218305BE9",  # instrument1 (required)
                    "reader_id": self.reader.id,
                    "timestamp": timezone.now().isoformat()
                },
                {
                    "epc": "035F110074E0057203044F2",  # instrument2 (required)
                    "reader_id": self.reader.id,
                    "timestamp": timezone.now().isoformat()
                },
                {
                    "epc": "035CC3007318024518305BE3",  # tray1 (required)
                    "reader_id": self.reader.id,
                    "timestamp": timezone.now().isoformat()
                }
            ]
        ]
        
        # Create mock tag for instrument2
        RFIDTag.objects.create(
            epc="035F110074E0057203044F2",
            instrument=self.instrument2
        )
        
        # Create verification service with shortened max_duration
        service = VerificationService(self.operation_session.id)
        
        # Start continuous verification with very short max_duration
        result = service.start_continuous_verification(max_duration=10)
        
        # Should have called scan_all_rfid_tags twice
        self.assertEqual(mock_scan.call_count, 2)
        
        # Should have state 'valid' since all items were found
        self.assertEqual(result['state'], 'valid')
        
        # Check verification session state
        verification_session = VerificationSession.objects.get(operation_session=self.operation_session)
        self.assertEqual(verification_session.state, 'valid')
        
        # All required items should be marked as in_use
        self.instrument1.refresh_from_db()
        self.instrument2.refresh_from_db()
        self.tray1.refresh_from_db()
        self.assertEqual(self.instrument1.status, 'in_use')
        self.assertEqual(self.instrument2.status, 'in_use')
        self.assertEqual(self.tray1.status, 'in_use')
