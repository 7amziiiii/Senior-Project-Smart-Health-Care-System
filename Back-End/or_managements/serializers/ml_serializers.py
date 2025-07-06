from rest_framework import serializers
from datetime import datetime, timedelta
from django.db.models import Count, Sum, F
from ..models.equipment_request import EquipmentRequest
from ..models.large_equipment import LargeEquipment
from ..models.operation_session import OperationSession


class EquipmentUsageLogSerializer(serializers.ModelSerializer):
    """
    Serializer for ML Equipment Usage Logs API endpoint
    """
    equipment_id = serializers.CharField(source='equipment.equipment_id')
    procedure_id = serializers.CharField(source='operation_session.id')
    
    class Meta:
        model = EquipmentRequest
        fields = [
            'equipment_id',
            'check_out_time',
            'check_in_time',
            'duration_minutes',
            'procedure_id'
        ]


class EquipmentMaintenanceHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for ML Equipment Maintenance History API endpoint
    """
    equipment_id = serializers.CharField(source='equipment.equipment_id')
    days_since_last = serializers.SerializerMethodField()
    
    class Meta:
        model = EquipmentRequest
        fields = [
            'equipment_id',
            'maintenance_date',
            'maintenance_type',
            'days_since_last'
        ]
    
    def get_days_since_last(self, obj):
        """Calculate days since last maintenance for this equipment"""
        if not obj.maintenance_date:
            return None
            
        # Find previous maintenance record for this equipment
        previous_maintenance = EquipmentRequest.objects.filter(
            equipment=obj.equipment,
            maintenance_date__lt=obj.maintenance_date,
            maintenance_type__isnull=False
        ).order_by('-maintenance_date').first()
        
        if previous_maintenance and previous_maintenance.maintenance_date:
            delta = obj.maintenance_date - previous_maintenance.maintenance_date
            return delta.days
        
        return None


class ProcedureStatsSerializer(serializers.Serializer):
    """
    Serializer for ML Procedure Stats API endpoint
    """
    equipment_id = serializers.CharField()
    total_procedures = serializers.IntegerField()
    procedure_types = serializers.ListField(child=serializers.CharField())
    total_usage_hours = serializers.FloatField()
    
    @classmethod
    def generate_stats(cls, equipment_id):
        """
        Generate procedure statistics for a given equipment
        Returns a dictionary that can be used to instantiate this serializer
        """
        equipment = LargeEquipment.objects.filter(equipment_id=equipment_id).first()
        if not equipment:
            return None
            
        # Get all requests for this equipment
        requests = EquipmentRequest.objects.filter(equipment=equipment)
        
        # Count total procedures (unique operation sessions)
        operation_sessions = set(request.operation_session_id for request in requests if request.operation_session_id)
        total_procedures = len(operation_sessions)
        
        # Get procedure types
        procedure_types = OperationSession.objects.filter(
            id__in=operation_sessions
        ).values_list('operation_type__name', flat=True).distinct()
        
        # Calculate total usage hours
        total_minutes = requests.filter(duration_minutes__isnull=False).aggregate(
            total=Sum('duration_minutes')
        )['total'] or 0
        total_usage_hours = round(total_minutes / 60, 1)
        
        return {
            'equipment_id': equipment_id,
            'total_procedures': total_procedures,
            'procedure_types': list(procedure_types),
            'total_usage_hours': total_usage_hours
        }
