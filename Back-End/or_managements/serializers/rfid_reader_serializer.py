from rest_framework import serializers
from ..models.rfid_reader import RFID_Reader
from django.utils import timezone

class RFIDReaderSerializer(serializers.ModelSerializer):
    """
    Serializer for RFID reader devices
    """
    class Meta:
        model = RFID_Reader
        fields = ['id', 'location',  'port', 'baud_rate','last_scan_time']
