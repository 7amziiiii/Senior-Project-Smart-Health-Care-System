from rest_framework import serializers
from django.contrib.auth.models import User
from ..models.operation_session import OperationSession
from ..models.operation_type import OperationType
from ..models.operation_room import OperationRoom
from .operation_type_serializer import OperationTypeSerializer
from .operation_room_serializer import OperationRoomSerializer
from .auth.user_profile_serializer import UserWithProfileSerializer


class OperationSessionListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for listing operation sessions
    """
    operation_type = serializers.StringRelatedField()
    operation_room = serializers.StringRelatedField()
    state_display = serializers.CharField(source='get_state_display', read_only=True)
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = OperationSession
        fields = [
            'id', 'operation_type', 'operation_room', 
            'scheduled_time', 'state', 'state_display',
            'user_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_user_count(self, obj):
        return obj.users.count()


class OperationSessionDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for operation sessions
    """
    operation_type = OperationTypeSerializer(read_only=True)
    operation_type_id = serializers.PrimaryKeyRelatedField(
        queryset=OperationType.objects.all(),
        source='operation_type',
        write_only=True
    )
    
    operation_room = OperationRoomSerializer(read_only=True)
    operation_room_id = serializers.PrimaryKeyRelatedField(
        queryset=OperationRoom.objects.all(),
        source='operation_room',
        write_only=True
    )
    
    users = UserWithProfileSerializer(many=True, read_only=True)
    user_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='users',
        write_only=True,
        many=True
    )
    
    state_display = serializers.CharField(source='get_state_display', read_only=True)
    
    class Meta:
        model = OperationSession
        fields = [
            'id', 'operation_type', 'operation_type_id',
            'operation_room', 'operation_room_id',
            'scheduled_time', 'users', 'user_ids',
            'state', 'state_display', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
