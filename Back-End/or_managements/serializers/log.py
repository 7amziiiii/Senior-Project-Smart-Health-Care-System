from rest_framework import serializers
from ..models.outbound_tracking import OutboundTracking


class OutboundTrackingSerializer(serializers.ModelSerializer):
    """
    Serializer for outbound tracking
    """
    class Meta:
        model = OutboundTracking
        fields = [
            'id', 'operation_session', 'room_cleared', 'checked_by',
            'remaining_items', 'extra_items', 'check_time'
        ]
