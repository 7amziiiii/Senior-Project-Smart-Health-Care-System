import json
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from or_managements.models.instrument import Instrument
from or_managements.models.rfid_tag import RFIDTag
from or_managements.models.tray import Tray
from or_managements.serializers.instrument_serializer import InstrumentSerializer


class InstrumentSerializerTestCase(TestCase):
    """Test suite for the Instrument serializer"""

    def setUp(self):
        """Set up test data"""
        # Create test RFID tag
        self.rfid_tag = RFIDTag.objects.create(
            tag_id="RFID12345",
            name="Test Instrument Tag",
            status="active",
            last_known_location="Storage Room A"
        )
        
        # Create test tray
        self.tray = Tray.objects.create(
            name="Surgical Tray A",
            number_of_instruments=5
        )
        
        # Create test instrument
        self.instrument = Instrument.objects.create(
            name="Surgical Scissors",
            status="available",
            rfid_tag=self.rfid_tag,
            tray=self.tray
        )
        
        # Initialize the serializer with our test instance
        self.serializer = InstrumentSerializer(instance=self.instrument)

    def test_serializer_contains_expected_fields(self):
        """Test that the serializer contains the expected fields"""
        data = self.serializer.data
        # Note: tray_id is write_only so it won't appear in serialized output
        self.assertEqual(
            set(data.keys()), 
            set(['id', 'name', 'status', 'status_display', 'rfid_tag', 'tray'])
        )
    
    def test_name_field_content(self):
        """Test the name field content is correctly serialized"""
        data = self.serializer.data
        self.assertEqual(data['name'], self.instrument.name)
        
    def test_status_field_content(self):
        """Test the status field content is correctly serialized"""
        data = self.serializer.data
        self.assertEqual(data['status'], self.instrument.status)
        
    def test_status_display_field_content(self):
        """Test the status_display field content is correctly serialized"""
        data = self.serializer.data
        self.assertEqual(data['status_display'], self.instrument.get_status_display())
        
    def test_nested_rfid_tag_serialization(self):
        """Test that the RFID tag is correctly nested and serialized"""
        data = self.serializer.data
        self.assertEqual(data['rfid_tag']['tag_id'], self.rfid_tag.tag_id)
        self.assertEqual(data['rfid_tag']['last_known_location'], self.rfid_tag.last_known_location)
        
    def test_nested_tray_serialization(self):
        """Test that the tray is correctly nested and serialized"""
        data = self.serializer.data
        self.assertEqual(data['tray']['name'], self.tray.name)
        self.assertEqual(data['tray']['number_of_instruments'], self.tray.number_of_instruments)
        
    def test_instrument_deserialization_validation(self):
        """Test instrument data validation during deserialization"""
        # Valid data should pass validation
        valid_data = {
            'name': 'New Test Instrument',
            'status': 'available',  # Using string literal instead of constant
            'tray_id': self.tray.id
        }
        serializer = InstrumentSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid())
        
        # Invalid data should fail validation
        invalid_data = {
            'name': '', # Empty name should fail
            'status': 'INVALID_STATUS', # Invalid status should fail
            'tray_id': 999 # Non-existent tray ID should fail
        }
        serializer = InstrumentSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
