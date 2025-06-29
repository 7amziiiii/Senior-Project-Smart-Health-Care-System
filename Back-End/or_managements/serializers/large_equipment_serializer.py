from rest_framework import serializers
from ..models.large_equipment import LargeEquipment
from .rfid_tag_serializer import RFIDTagSerializer


class LargeEquipmentSerializer(serializers.ModelSerializer):
    """
    Serializer for large medical equipment
    """
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = LargeEquipment
        fields = [
            'id', 'name', 'equipment_id', 'rfid_tag',
            'equipment_type', 'status', 'status_display', 'notes'
        ]
