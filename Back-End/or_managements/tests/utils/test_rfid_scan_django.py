"""
Tests for RFID scanning utilities using Django TestCase
"""
from django.test import TestCase
from unittest.mock import patch, MagicMock
from datetime import timedelta
from django.utils import timezone

from or_managements.models import RFID_Reader
from or_managements.utils.rfid_scan import (
    verify_reader_connectivity,
    read_from_reader,
    scan_all_rfid_tags
)


class RFIDScanTestCase(TestCase):
    """Test case for RFID scanning utilities"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_reader = MagicMock(spec=RFID_Reader)
        self.mock_reader.id = 1
        self.mock_reader.location = "Test Location"
        self.mock_reader.port = "COM1"
        self.mock_reader.baud_rate = 9600
        self.mock_reader.last_scan_time = timezone.now()
        
        # Create multiple readers
        self.mock_readers = []
        for i in range(3):
            reader = MagicMock(spec=RFID_Reader)
            reader.id = i + 1
            reader.location = f"Test Location {i+1}"
            reader.port = f"COM{i+1}"
            reader.baud_rate = 9600
            reader.last_scan_time = timezone.now()
            self.mock_readers.append(reader)
    
    @patch('or_managements.utils.rfid_scan.serial.Serial')
    def test_verify_reader_connectivity_success(self, mock_serial):
        """Test successful reader connectivity verification"""
        # Configure the mock to return successfully
        mock_serial_instance = MagicMock()
        mock_serial.return_value.__enter__.return_value = mock_serial_instance
        
        result = verify_reader_connectivity(self.mock_reader)
        
        # Check that Serial was called with correct parameters
        mock_serial.assert_called_once_with(self.mock_reader.port, self.mock_reader.baud_rate, timeout=1)
        self.assertTrue(result)
    
    @patch('or_managements.utils.rfid_scan.serial.Serial')
    def test_verify_reader_connectivity_failure(self, mock_serial):
        """Test reader connectivity verification failure"""
        # Configure the mock to raise an exception
        mock_serial.side_effect = Exception("Connection failed")
        
        result = verify_reader_connectivity(self.mock_reader)
        
        # Check that Serial was called with correct parameters
        mock_serial.assert_called_once_with(self.mock_reader.port, self.mock_reader.baud_rate, timeout=1)
        self.assertFalse(result)
    
    @patch('or_managements.utils.rfid_scan.serial.Serial')
    @patch('or_managements.utils.rfid_scan.time')
    def test_read_from_reader(self, mock_time, mock_serial):
        """Test reading RFID tags from a reader"""
        # Configure mock time to simulate duration
        mock_time.time.side_effect = [0, 0.1, 0.2, 0.6]  # Start, loop iterations, then exceed duration
        
        # Configure mock serial to return data
        mock_serial_instance = MagicMock()
        mock_serial.return_value.__enter__.return_value = mock_serial_instance
        
        # Simulate two tag reads - matching our updated implementation's expected format
        mock_serial_instance.in_waiting = 10
        mock_serial_instance.readline.side_effect = [
            b'1 | 035CC9 | 12 | 035CC907318024318305BE2 | 3 | /\r\n',
            b'2 | 035CC4 | 12 | 035CC407318024318305BE2 | 5 | /\r\n'
        ]
        
        # Call function under test
        result = read_from_reader(self.mock_reader)
        
        # Verify results
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0], '035CC907318024318305BE2')
        self.assertEqual(result[1], '035CC407318024318305BE2')
        self.assertTrue(self.mock_reader.save.called)  # Verify last_scan_time was updated
        # Check for the hex command format from YaoZeo reader
        mock_serial_instance.write.assert_called_once_with(b'7C FF FF 11 32 00 43\r\n')
    
    @patch('or_managements.utils.rfid_scan.verify_reader_connectivity')
    @patch('or_managements.utils.rfid_scan.read_from_reader')
    @patch('or_managements.utils.rfid_scan.time')
    @patch('or_managements.utils.rfid_scan.timezone')
    def test_scan_all_rfid_tags(self, mock_timezone, mock_time, mock_read, mock_verify):
        """Test scanning all RFID tags from multiple readers"""
        # Configure mocks
        end_time = timezone.now() + timedelta(seconds=10)
        mock_timezone.now.side_effect = [
            end_time - timedelta(seconds=9),  # First check, continue loop
            end_time - timedelta(seconds=8),  # After scan 1
            end_time - timedelta(seconds=7),  # After wait 1
            end_time - timedelta(seconds=6),  # After scan 2
            end_time - timedelta(seconds=5),  # After wait 2
            end_time - timedelta(seconds=4),  # After scan 3
            end_time - timedelta(seconds=3),  # After wait 3
            end_time                          # Last check, end loop
        ]
        
        # All readers are available
        mock_verify.return_value = True
        
        # Mock reader scan results
        mock_read.side_effect = [
            ["035CC907318024318305BE2", "035CC407318024318305BE2"],  # Reader 1
            ["035CC407318024318305BE2", "035F1007405720304F2"],      # Reader 2 (one duplicate)
            ["035CB807318025818305C09", "035F1507406120304F4", "035CC407318024318305BE2"]  # Reader 3 (one duplicate)
        ]
        
        # Call function under test
        results = scan_all_rfid_tags(self.mock_readers, end_time)
        
        # Check we've tried to read from each reader
        self.assertEqual(mock_read.call_count, 3)
        self.assertEqual(mock_verify.call_count, 3)
        
        # Check results - should have 5 unique EPCs (duplicates removed)
        self.assertEqual(len(results), 5)
        epcs = [r["epc"] for r in results]
        self.assertIn("035CC907318024318305BE2", epcs)
        self.assertIn("035CC407318024318305BE2", epcs)
        self.assertIn("035F1007405720304F2", epcs)
        self.assertIn("035CB807318025818305C09", epcs)
        self.assertIn("035F1507406120304F4", epcs)
        
        # Check that we only kept the first instance of the duplicate EPC
        epc2_entries = [r for r in results if r["epc"] == "035CC407318024318305BE2"]
        self.assertEqual(len(epc2_entries), 1)
        self.assertEqual(epc2_entries[0]["reader_id"], 1)  # From first reader
        
        # Check sleep was called between scans (2s interval)
        self.assertEqual(mock_time.sleep.call_count, 3)
