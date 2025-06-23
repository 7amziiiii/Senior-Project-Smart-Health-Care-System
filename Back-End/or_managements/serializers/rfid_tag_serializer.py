from rest_framework import serializers
from ..models.rfid_tag import RFIDTag
from .rfid_reader_serializer import RFIDReaderSerializer


class RFIDTagSerializer(serializers.ModelSerializer):
    """
    Serializer for RFID tags (detailed view)
    """
    last_detected_by = RFIDReaderSerializer(read_only=True)
    
    class Meta:
        model = RFIDTag
        fields = [
            'id', 'tag_id', 'name', 'status', 'last_detected_by',
            'last_detection_time', 'created_at', 'updated_at', 'last_known_location'
        ]
        read_only_fields = ['created_at', 'updated_at']


class RFIDTagCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating RFID tags
    """
    class Meta:
        model = RFIDTag
        fields = ['tag_id', 'name', 'status', 'last_detected_by']
