from rest_framework import serializers
from ..models.instrument import Instrument
from ..models.tray import Tray
from .rfid_tag_serializer import RFIDTagSerializer
from .tray_serializer import TraySerializer


class InstrumentSerializer(serializers.ModelSerializer):
    """
    Serializer for surgical instruments
    """

    tray_id = serializers.PrimaryKeyRelatedField(
        queryset=Tray.objects.all(),
        source='tray',
        write_only=True,
        required=False,
        allow_null=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Instrument
        fields = ['id', 'name', 'status', 'status_display', 'rfid_tag', 'tray', 'tray_id']
