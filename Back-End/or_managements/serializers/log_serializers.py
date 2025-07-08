from rest_framework import serializers
from ..models.verification_session import VerificationSession
from ..models.outbound_tracking import OutboundTracking
from ..models.equipment_request import EquipmentRequest


class BaseLogSerializer(serializers.Serializer):
    """
    Base serializer for all system log entries with common fields that match 
    the frontend SystemLog interface.
    """
    id = serializers.IntegerField(read_only=True)
    timestamp = serializers.DateTimeField(read_only=True)
    user = serializers.CharField(read_only=True)
    action = serializers.CharField(read_only=True)
    details = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    logType = serializers.CharField(read_only=True)


class VerificationLogSerializer(BaseLogSerializer):
    """
    Serializer for verification session logs.
    """
    class Meta:
        model = VerificationSession
        fields = ['id', 'timestamp', 'user', 'action', 'details', 'status', 'logType']
    
    def to_representation(self, instance):
        """
        Convert verification session instance to log format
        """
        log_entry = {
            'id': instance.id,
            'timestamp': instance.last_updated,
            'user': instance.verified_by.username if instance.verified_by else 'System',
            'action': 'Instrument Verification',
            'details': f"Surgery #{instance.operation_session.id} - {instance.operation_session.operation_type.name}",
            'status': instance.state,  # 'valid', 'incomplete', 'invalid', 'failed'
            'logType': 'verification'
        }
        return log_entry


class OutboundTrackingLogSerializer(BaseLogSerializer):
    """
    Serializer for outbound tracking logs.
    """
    class Meta:
        model = OutboundTracking
        fields = ['id', 'timestamp', 'user', 'action', 'details', 'status', 'logType']
    
    def to_representation(self, instance):
        """
        Convert outbound tracking instance to log format
        """
        status = 'complete' if instance.room_cleared else 'issue'
        
        log_entry = {
            'id': instance.id,
            'timestamp': instance.check_time,
            'user': instance.checked_by.username if instance.checked_by else 'System',
            'action': 'Room Outbound Check',
            'details': f"Surgery #{instance.operation_session.id} - Room {instance.operation_session.operation_room.room_id if instance.operation_session.operation_room else 'Unknown'}",
            'status': status,
            'logType': 'outbound'
        }
        return log_entry


class EquipmentRequestLogSerializer(BaseLogSerializer):
    """
    Serializer for equipment request logs.
    """
    class Meta:
        model = EquipmentRequest
        fields = ['id', 'timestamp', 'user', 'action', 'details', 'status', 'logType']
    
    def to_representation(self, instance):
        """
        Convert equipment request instance to log format
        """
        # Map model status to frontend status
        status_mapping = {
            'requested': 'pending',
            'approved': 'complete',
            'rejected': 'issue',
            'in_use': 'pending',
            'returned': 'complete',
            'maintenance': 'issue'
        }
        
        # Determine the most appropriate timestamp field
        if instance.check_in_time:
            timestamp = instance.check_in_time
        elif instance.check_out_time:
            timestamp = instance.check_out_time
        elif instance.maintenance_date:
            timestamp = instance.maintenance_date
        else:
            # Default to model's auto field
            timestamp = instance.id  # This will use the auto_now_add field
        
        # Format the action based on status
        action_mapping = {
            'requested': 'Equipment Request',
            'approved': 'Equipment Approval',
            'rejected': 'Equipment Rejection',
            'in_use': 'Equipment Check-out',
            'returned': 'Equipment Return',
            'maintenance': 'Equipment Maintenance'
        }
        
        log_entry = {
            'id': instance.id,
            'timestamp': timestamp,
            'user': instance.requested_by.username if instance.requested_by else 'System',
            'action': action_mapping.get(instance.status, 'Equipment Action'),
            'details': f"{instance.equipment.name} - {instance.equipment.equipment_id} for Surgery #{instance.operation_session.id}",
            'status': status_mapping.get(instance.status, 'pending'),
            'logType': 'system'
        }
        return log_entry
