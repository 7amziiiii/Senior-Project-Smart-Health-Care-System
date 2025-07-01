"""
Tests for verification API views.
"""
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock

from or_managements.models import OperationSession, OperationType, OperationRoom, RFID_Reader, VerificationSession
from or_managements.models.operation_session import OperationSession
from or_managements.models.verification_session import VerificationSession


class VerificationViewsTestCase(TestCase):
    """Test case for verification views"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
        # Create operation type
        self.operation_type = OperationType.objects.create(
            name="Test Operation",
            required_instruments={"instruments": {"Scalpel": 2}, "trays": {"Basic Tray": 1}}
        )
        
        # Create operation room
        self.operation_room = OperationRoom.objects.create(
            room_id="OR101",
            state="available"
        )
        
        # Create RFID reader
        self.rfid_reader = RFID_Reader.objects.create(
            location="Test Room",
            last_scan_time=timezone.now(),
            port="COM3",
            baud_rate=115200
        )
        
        # Associate reader with room
        self.operation_room.reader = self.rfid_reader
        self.operation_room.save()
        
        # Create operation session
        self.operation_session = OperationSession.objects.create(
            operation_type=self.operation_type,
            operation_room=self.operation_room,
            scheduled_time=timezone.now(),
            state="in_progress"
        )
        
        # Create verification session
        self.verification_session = VerificationSession.objects.create(
            operation_session=self.operation_session,
            state="incomplete",
            open_until=timezone.now() + timezone.timedelta(hours=24),
            used_items={"instruments": {}, "trays": {}},
            missing_items={"instruments": {"Scalpel": 2}, "trays": {"Basic Tray": 1}},
            available_items={"instruments": {}, "trays": {}},
            available_matches={"instruments": {}, "trays": {}}
        )
    
    def test_get_verification_status_without_scan(self):
        """Test getting verification status without performing a new scan"""
        url = f"/api/verification/{self.operation_session.id}/status/"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["verification_id"], self.verification_session.id)
        self.assertEqual(data["state"], "incomplete")
        self.assertEqual(data["missing_items"]["instruments"]["Scalpel"], 2)
    
    @patch('or_managements.services.verification_service.VerificationService.perform_verification')
    def test_get_verification_status_with_scan(self, mock_perform_verification):
        """Test getting verification status with a new scan"""
        # Mock return value
        mock_result = {
            "verification_id": self.verification_session.id,
            "state": "complete",
            "used_items": {"instruments": {"Scalpel": 2}, "trays": {"Basic Tray": 1}},
            "missing_items": {"instruments": {}, "trays": {}},
            "available_items": {"instruments": {}, "trays": {}},
            "available_matches": {"instruments": {}, "trays": {}}
        }
        mock_perform_verification.return_value = mock_result
        
        # Make request with scan=true
        url = f"/api/verification/{self.operation_session.id}/status/?scan=true"
        response = self.client.get(url)
        
        # Check response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["state"], "complete")
        self.assertEqual(data["used_items"]["instruments"]["Scalpel"], 2)
        
        # Verify mock was called
        mock_perform_verification.assert_called_once()
    
    def test_get_verification_status_operation_not_found(self):
        """Test getting verification status for non-existent operation"""
        url = f"/api/verification/999/status/"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.json()["error"], "Operation session not found")
    
    def test_get_verification_status_no_verification_session(self):
        """Test getting verification status when no verification session exists"""
        # Create a new operation session without verification
        new_operation = OperationSession.objects.create(
            operation_type=self.operation_type,
            operation_room=self.operation_room,
            scheduled_time=timezone.now(),
            state="in_progress"
        )
        
        url = f"/api/verification/{new_operation.id}/status/"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.json()["error"], "No verification session exists for this operation")
