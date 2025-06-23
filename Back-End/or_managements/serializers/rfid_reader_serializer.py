from rest_framework import serializers
from ..models.rfid_reader import RFID_Reader


class RFIDReaderSerializer(serializers.ModelSerializer):
    """
    Serializer for RFID reader devices
    """
    class Meta:
        model = RFID_Reader
        fields = ['id', 'location', 'last_scan_time']
