from rest_framework import serializers
from ..models.equipment_request import EquipmentRequest
from ..models.large_equipment import LargeEquipment
from ..serializers.large_equipment_serializer import LargeEquipmentSerializer
from .operation_session_serializer import OperationSessionListSerializer
from ..models.user_models import User


class EquipmentRequestListSerializer(serializers.ModelSerializer):
    equipment_name = serializers.SerializerMethodField()
    requester_name = serializers.SerializerMethodField()
    equipment_details = LargeEquipmentSerializer(source='equipment', read_only=True)
    
    class Meta:
        model = EquipmentRequest
        fields = ['id', 'equipment', 'equipment_name', 'equipment_details', 'requester', 
                 'requester_name', 'check_out_time', 'expected_return_time', 
                 'actual_return_time', 'reason_for_request', 'status', 'created_at', 
                 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_equipment_name(self, obj):
        if obj.equipment:
            return obj.equipment.name
        return None
    
    def get_requester_name(self, obj):
        if obj.requester:
            return obj.requester.username
        return None


class EquipmentRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentRequest
        fields = ['equipment', 'requester', 'check_out_time', 'expected_return_time', 
                 'reason_for_request', 'status']
        
    def validate(self, data):
        # Validate that the equipment exists
        equipment_id = data.get('equipment')
        if not LargeEquipment.objects.filter(id=equipment_id.id).exists():
            raise serializers.ValidationError({'equipment': 'Equipment does not exist'})
        
        # Validate that the requester exists
        requester_id = data.get('requester')
        if not User.objects.filter(id=requester_id.id).exists():
            raise serializers.ValidationError({'requester': 'User does not exist'})
        
        # Validate check_out_time is before expected_return_time
        if data.get('check_out_time') and data.get('expected_return_time'):
            if data['check_out_time'] > data['expected_return_time']:
                raise serializers.ValidationError({'expected_return_time': 'Expected return time must be after check out time'})
        
        return data