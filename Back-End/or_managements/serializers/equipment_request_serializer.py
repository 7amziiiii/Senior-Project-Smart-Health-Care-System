from rest_framework import serializers
from ..models.equipment_request import EquipmentRequest
from ..models.large_equipment import LargeEquipment
from ..serializers.large_equipment_serializer import LargeEquipmentSerializer
from ..serializers.operation_session_serializer import OperationSessionSerializer


class EquipmentRequestSerializer(serializers.ModelSerializer):
    """Serializer for the EquipmentRequest model"""
    
    equipment_details = LargeEquipmentSerializer(source='equipment', read_only=True)
    operation_session_details = OperationSessionSerializer(source='operation_session', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    
    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip() or obj.requested_by.username
        return None
    
    class Meta:
        model = EquipmentRequest
        fields = [
            'id', 'equipment', 'equipment_details', 'operation_session', 
            'operation_session_details', 'requested_by', 'requested_by_name',
            'status', 'status_display', 'check_out_time', 'check_in_time', 
            'duration_minutes', 'maintenance_type', 'maintenance_date'
        ]


class EquipmentRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new EquipmentRequest objects"""
    
    class Meta:
        model = EquipmentRequest
        fields = ['equipment', 'operation_session', 'requested_by', 'status']
