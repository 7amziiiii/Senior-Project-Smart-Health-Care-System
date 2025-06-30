"""
Tests for RFID scanning utilities
"""
import pytest
import time
from unittest.mock import patch, MagicMock, call
from datetime import datetime, timedelta
from django.utils import timezone

from or_managements.models import RFID_Reader
from or_managements.utils.rfid_scan import (
    verify_reader_connectivity,
    read_from_reader,
    scan_all_rfid_tags
)


@pytest.fixture
def mock_reader():
    """Create a mock RFID_Reader for testing"""
    reader = MagicMock(spec=RFID_Reader)
    reader.id = 1
    reader.location = "Test Location"
    reader.port = "COM1"
    reader.baud_rate = 9600
    reader.last_scan_time = timezone.now()
    return reader


@pytest.fixture
def mock_readers():
    """Create multiple mock RFID_Readers for testing"""
    readers = []
    for i in range(3):
        reader = MagicMock(spec=RFID_Reader)
        reader.id = i + 1
        reader.location = f"Test Location {i+1}"
        reader.port = f"COM{i+1}"
        reader.baud_rate = 9600
        reader.last_scan_time = timezone.now()
        readers.append(reader)
    return readers


@patch('or_managements.utils.rfid_scan.serial.Serial')
def test_verify_reader_connectivity_success(mock_serial, mock_reader):
    """Test successful reader connectivity verification"""
    # Configure the mock to return successfully
    mock_serial_instance = MagicMock()
    mock_serial.return_value.__enter__.return_value = mock_serial_instance
    
    result = verify_reader_connectivity(mock_reader)
    
    # Check that Serial was called with correct parameters
    mock_serial.assert_called_once_with(mock_reader.port, mock_reader.baud_rate, timeout=1)
    assert result is True


@patch('or_managements.utils.rfid_scan.serial.Serial')
def test_verify_reader_connectivity_failure(mock_serial, mock_reader):
    """Test reader connectivity verification failure"""
    # Configure the mock to raise an exception
    mock_serial.side_effect = Exception("Connection failed")
    
    result = verify_reader_connectivity(mock_reader)
    
    # Check that Serial was called with correct parameters
    mock_serial.assert_called_once_with(mock_reader.port, mock_reader.baud_rate, timeout=1)
    assert result is False


@patch('or_managements.utils.rfid_scan.serial.Serial')
@patch('or_managements.utils.rfid_scan.time')
def test_read_from_reader(mock_time, mock_serial, mock_reader):
    """Test reading RFID tags from a reader"""
    # Configure mock time to simulate duration
    mock_time.time.side_effect = [0, 0.1, 0.2, 0.6]  # Start, loop iterations, then exceed duration
    
    # Configure mock serial to return data
    mock_serial_instance = MagicMock()
    mock_serial.return_value.__enter__.return_value = mock_serial_instance
    
    # Simulate two tag reads
    mock_serial_instance.in_waiting = 10
    mock_serial_instance.readline.side_effect = [
        b'EPC:0123456789\r\n',
        b'EPC:9876543210\r\n'
    ]
    
    # Call function under test
    result = read_from_reader(mock_reader)
    
    # Verify results
    assert result == ['0123456789', '9876543210']
    assert mock_reader.save.called  # Verify last_scan_time was updated
    mock_serial_instance.write.assert_called_once_with(b'SCAN\r\n')


@patch('or_managements.utils.rfid_scan.verify_reader_connectivity')
@patch('or_managements.utils.rfid_scan.read_from_reader')
@patch('or_managements.utils.rfid_scan.time')
@patch('or_managements.utils.rfid_scan.timezone')
def test_scan_all_rfid_tags(mock_timezone, mock_time, mock_read, mock_verify, mock_readers):
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
        ["epc1", "epc2"],       # Reader 1 detects two tags
        ["epc2", "epc3"],       # Reader 2 detects two tags (one duplicate)
        ["epc4", "epc5", "epc2"]  # Reader 3 detects three tags (one duplicate)
    ]
    
    # Call function under test
    results = scan_all_rfid_tags(mock_readers, end_time)
    
    # Check we've tried to read from each reader
    assert mock_read.call_count == 3
    assert mock_verify.call_count == 3
    
    # Check results - should have 5 unique EPCs (epc2 deduplicated)
    assert len(results) == 5
    epcs = [r["epc"] for r in results]
    assert "epc1" in epcs
    assert "epc2" in epcs
    assert "epc3" in epcs
    assert "epc4" in epcs
    assert "epc5" in epcs
    
    # Check that we only kept the first instance of epc2
    epc2_entries = [r for r in results if r["epc"] == "epc2"]
    assert len(epc2_entries) == 1
    assert epc2_entries[0]["reader_id"] == 1  # From first reader
    
    # Check sleep was called between scans (2s interval)
    assert mock_time.sleep.call_count == 3
