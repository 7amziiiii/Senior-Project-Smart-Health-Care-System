from rest_framework import serializers
from ..models.large_equipment import LargeEquipment
from ..models.rfid_tag import RFIDTag
from .rfid_tag_serializer import RFIDTagSerializer


class LargeEquipmentSerializer(serializers.ModelSerializer):
    """
    Serializer for large medical equipment
    """
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Custom field to only show unlinked RFID tags
    rfid_tag = serializers.PrimaryKeyRelatedField(
        queryset=RFIDTag.objects.filter(
            # Filter out tags linked to instruments
            tag__isnull=True,
            # Filter out tags linked to trays
            tray__isnull=True,
            # Filter out tags linked to other large equipment
            largeequipment__isnull=True
        ),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = LargeEquipment
        fields = [
            'id', 'name', 'equipment_id', 'rfid_tag',
            'equipment_type', 'status', 'status_display', 'notes'
        ]
