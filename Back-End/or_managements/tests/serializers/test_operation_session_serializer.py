from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
import datetime

from or_managements.models.operation_session import OperationSession
from or_managements.models.operation_type import OperationType
from or_managements.models.operation_room import OperationRoom
from or_managements.models.instrument import Instrument
from or_managements.models.rfid_tag import RFIDTag
from or_managements.models.large_equipment import LargeEquipment
from or_managements.serializers.operation_session_serializer import (
    OperationSessionListSerializer,
    OperationSessionDetailSerializer
)


class OperationSessionSerializerTestCase(TestCase):
    """Test suite for the Operation Session serializers"""
    
    def setUp(self):
        """Set up test data"""
        # Create users
        self.user1 = User.objects.create_user(
            username='doctor1',
            email='doctor1@example.com',
            password='password123',
            first_name='John',
            last_name='Doe'
        )
        
        self.user2 = User.objects.create_user(
            username='nurse1',
            email='nurse1@example.com',
            password='password123',
            first_name='Jane',
            last_name='Smith'
        )
        
        # Create operation type
        self.op_type = OperationType.objects.create(
            name="Appendectomy",
            required_instruments={"instruments": ["scalpel", "clamp"]}
        )
        
        # Create operation room
        self.op_room = OperationRoom.objects.create(
            room_id="OR-101",
            state="available"  # Using string value instead of constant
        )
        
        # Create an RFID tag for an instrument
        self.rfid_tag = RFIDTag.objects.create(
            tag_id="INSTR-TAG-123",
            name="Instrument Tag",
            status="active",
            last_known_location="Operating Room 101"
        )
        
        # Create an instrument
        self.instrument = Instrument.objects.create(
            name="Scalpel",
            status="available",
            rfid_tag=self.rfid_tag
        )
        
        # Create operation session
        self.operation_session = OperationSession.objects.create(
            operation_type=self.op_type,
            operation_room=self.op_room,
            scheduled_time=timezone.now() + datetime.timedelta(hours=1),
            state="scheduled"
        )
        
        # Add users to the operation session
        self.operation_session.users.add(self.user1, self.user2)
        
        # Note: There is no instruments relationship in the OperationSession model
        # The instrument is created but not attached to operation session
        
        # Initialize the serializers with our test instance
        self.list_serializer = OperationSessionListSerializer(instance=self.operation_session)
        self.detail_serializer = OperationSessionDetailSerializer(instance=self.operation_session)
    
    def test_list_serializer_contains_expected_fields(self):
        """Test that the list serializer contains the expected fields"""
        data = self.list_serializer.data
        expected_fields = set([
            'id', 'operation_type', 'operation_room', 'scheduled_time', 
            'state', 'state_display', 'user_count', 'created_at', 'updated_at'
        ])
        self.assertEqual(set(data.keys()), expected_fields)
    
    def test_detail_serializer_contains_expected_fields(self):
        """Test that the detail serializer contains the expected fields"""
        data = self.detail_serializer.data
        expected_fields = set([
            'id', 'operation_type', 'operation_room', 'scheduled_time',
            'state', 'state_display', 'users', 'created_at', 'updated_at'
        ])
        self.assertEqual(set(data.keys()), expected_fields)
    
    def test_operation_type_field_content(self):
        """Test the operation_type field content is correctly serialized"""
        data = self.detail_serializer.data
        self.assertEqual(data['operation_type']['id'], self.op_type.id)
        self.assertEqual(data['operation_type']['name'], self.op_type.name)
    
    def test_operation_room_field_content(self):
        """Test the operation_room field content is correctly serialized"""
        data = self.detail_serializer.data
        self.assertEqual(data['operation_room']['id'], self.op_room.id)
        self.assertEqual(data['operation_room']['room_id'], self.op_room.room_id)
    
    def test_users_field_content(self):
        """Test the users field content is correctly serialized"""
        data = self.detail_serializer.data
        self.assertEqual(len(data['users']), 2)
        
        # Extract usernames from serialized data to make comparison easier
        serialized_usernames = [user['username'] for user in data['users']]
        self.assertIn(self.user1.username, serialized_usernames)
        self.assertIn(self.user2.username, serialized_usernames)
    
    # Note: The instruments field test is removed because the OperationSession model
    # doesn't have an instruments relationship
    
    def test_state_display_field_content(self):
        """Test the state_display field content is correctly serialized"""
        data = self.detail_serializer.data
        self.assertEqual(data['state_display'], self.operation_session.get_state_display())
    
    def test_serializer_validation(self):
        """Test operation session data validation during deserialization"""
        # Valid data should pass validation
        valid_data = {
            'operation_type_id': self.op_type.id,
            'operation_room_id': self.op_room.id,
            'scheduled_time': timezone.now() + datetime.timedelta(hours=2),
            'state': 'scheduled',  # Using string value instead of constant
            'user_ids': [self.user1.id, self.user2.id]
        }
        serializer = OperationSessionDetailSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        
        # Invalid data (end time before start time) should fail validation
        invalid_data = {
            'operation_type': self.op_type.id,
            'operation_room': self.op_room.id,
            'scheduled_start': timezone.now() + datetime.timedelta(days=2),
            'scheduled_end': timezone.now() + datetime.timedelta(days=1),  # End before start
            'state': 'scheduled',  # Using string literal instead of constant
        }
        serializer = OperationSessionDetailSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
