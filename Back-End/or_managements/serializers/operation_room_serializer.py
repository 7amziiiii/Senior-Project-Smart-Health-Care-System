from rest_framework import serializers
from ..models.operation_room import OperationRoom


class OperationRoomSerializer(serializers.ModelSerializer):
    """
    Serializer for operation rooms
    """
    state_display = serializers.CharField(source='get_state_display', read_only=True)
    
    class Meta:
        model = OperationRoom
        fields = ['id', 'room_id', 'state', 'state_display', 'reader']
