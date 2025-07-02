from rest_framework import serializers
from ..models.tray import Tray
from ..models.rfid_tag import RFIDTag


class TraySerializer(serializers.ModelSerializer):
    """
    Serializer for instrument trays
    """
    # Custom field to only show unlinked tags
    tag = serializers.PrimaryKeyRelatedField(
        queryset=RFIDTag.objects.filter(
            # Filter out tags linked to instruments
            tag__isnull=True,
            # Filter out tags linked to other trays
            tray__isnull=True,
            # Filter out tags linked to large equipment
            largeequipment__isnull=True
        ),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Tray
        fields = ['id', 'name', 'number_of_instruments', 'tag']
