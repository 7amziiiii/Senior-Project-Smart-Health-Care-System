from django.test import TestCase
from rest_framework import serializers

from or_managements.models.rfid_tag import RFIDTag
from or_managements.serializers.rfid_tag_serializer import RFIDTagSerializer


class RFIDTagSerializerTestCase(TestCase):
    """Test suite for the RFID tag serializer"""
    
    def setUp(self):
        """Set up test data"""
        # Create test RFID tag
        self.rfid_tag = RFIDTag.objects.create(
            tag_id="RFID54321",
            name="Test Tag",
            status="active",
            last_known_location="Operating Room 1"
        )
        
        # Initialize the serializer with our test instance
        self.serializer = RFIDTagSerializer(instance=self.rfid_tag)
    
    def test_serializer_contains_expected_fields(self):
        """Test that the serializer contains the expected fields"""
        data = self.serializer.data
        expected_fields = set(['id', 'tag_id', 'name', 'status', 'last_known_location', 'last_detection_time', 'last_detected_by', 'created_at', 'updated_at'])
        self.assertEqual(set(data.keys()), expected_fields)
    
    def test_tag_id_field_content(self):
        """Test the tag_id field content is correctly serialized"""
        data = self.serializer.data
        self.assertEqual(data['tag_id'], self.rfid_tag.tag_id)
    
    def test_last_known_location_field_content(self):
        """Test the last_known_location field content is correctly serialized"""
        data = self.serializer.data
        self.assertEqual(data['last_known_location'], self.rfid_tag.last_known_location)
    
    def test_rfid_tag_deserialization_validation(self):
        """Test RFID tag data validation during deserialization"""
        # Valid data should pass validation
        valid_data = {
            'tag_id': 'NEW_RFID_12345',
            'name': 'New Test Tag',
            'status': 'active',
            'last_known_location': 'Equipment Storage Room'
        }
        serializer = RFIDTagSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid())
        
        # Invalid data should fail validation
        invalid_data = {
            'tag_id': '',  # Empty tag_id should fail
        }
        serializer = RFIDTagSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
    
    def test_create_rfid_tag(self):
        """Test creating an RFID tag through the serializer"""
        new_tag_data = {
            'tag_id': 'NEW_RFID_67890',
            'name': 'Another Test Tag',
            'status': 'active',
            'last_known_location': 'Recovery Room 2'
        }
        
        serializer = RFIDTagSerializer(data=new_tag_data)
        self.assertTrue(serializer.is_valid())
        
        # Save the new tag
        new_tag = serializer.save()
        
        # Verify it was saved correctly
        self.assertEqual(new_tag.tag_id, new_tag_data['tag_id'])
        self.assertEqual(new_tag.name, new_tag_data['name'])
        self.assertEqual(new_tag.last_known_location, new_tag_data['last_known_location'])
        
        # Verify it exists in the database
        self.assertTrue(
            RFIDTag.objects.filter(tag_id=new_tag_data['tag_id']).exists()
        )
    
    def test_update_rfid_tag(self):
        """Test updating an RFID tag through the serializer"""
        update_data = {
            'tag_id': self.rfid_tag.tag_id,  # Keep the same ID
            'last_known_location': 'Updated Location'  # Change the location
        }
        
        serializer = RFIDTagSerializer(
            instance=self.rfid_tag, 
            data=update_data,
            partial=True
        )
        self.assertTrue(serializer.is_valid())
        
        # Update the tag
        updated_tag = serializer.save()
        
        # Verify it was updated correctly
        self.assertEqual(updated_tag.last_known_location, update_data['last_known_location'])
        
        # Refresh from database to make sure it was persisted
        self.rfid_tag.refresh_from_db()
        self.assertEqual(self.rfid_tag.last_known_location, update_data['last_known_location'])
