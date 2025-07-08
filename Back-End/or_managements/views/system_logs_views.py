from rest_framework import generics, permissions
from rest_framework.response import Response
from django.db.models import F
from ..serializers.log_serializers import (
    VerificationLogSerializer, 
    OutboundTrackingLogSerializer, 
    EquipmentRequestLogSerializer
)
from ..models.verification_session import VerificationSession
from ..models.outbound_tracking import OutboundTracking
from ..models.equipment_request import EquipmentRequest
from ..permissions.role_permissions import IsAdmin

class BaseLogView(generics.ListAPIView):
    """Base view for all system log endpoints"""
    permission_classes = [permissions.IsAuthenticated | IsAdmin]
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class VerificationLogView(BaseLogView):
    """Read-only view for verification session logs"""
    serializer_class = VerificationLogSerializer
    queryset = VerificationSession.objects.all().order_by('-last_updated')


class OutboundTrackingLogView(BaseLogView):
    """Read-only view for outbound tracking logs"""
    serializer_class = OutboundTrackingLogSerializer
    queryset = OutboundTracking.objects.all().order_by('-check_time')


class EquipmentRequestLogView(BaseLogView):
    """Read-only view for equipment request logs"""
    serializer_class = EquipmentRequestLogSerializer
    
    def get_queryset(self):
        """
        Dynamically order by the most recent timestamp available (check_in_time, 
        check_out_time, or maintenance_date)
        """
        # Base queryset - get all equipment requests
        queryset = EquipmentRequest.objects.all()
        
        # Order by most recent activity (prefer check_in, then check_out, then maintenance date)
        # Use case to handle null values in order
        queryset = queryset.order_by(
            F('check_in_time').desc(nulls_last=True),
            F('check_out_time').desc(nulls_last=True),
            F('maintenance_date').desc(nulls_last=True),
            '-id'  # Fall back to ID for consistent ordering
        )
        
        return queryset


class CombinedSystemLogsView(generics.ListAPIView):
    """
    Combined view that returns all system logs in a unified format,
    including verification sessions, outbound tracking, and equipment requests.
    """
    permission_classes = [permissions.IsAuthenticated | IsAdmin]
    
    def list(self, request, *args, **kwargs):
        # Get logs from each source
        verification_logs = VerificationSession.objects.all()
        outbound_logs = OutboundTracking.objects.all()
        equipment_logs = EquipmentRequest.objects.all()
        
        # Serialize each type of log
        verification_serializer = VerificationLogSerializer(verification_logs, many=True)
        outbound_serializer = OutboundTrackingLogSerializer(outbound_logs, many=True)
        equipment_serializer = EquipmentRequestLogSerializer(equipment_logs, many=True)
        
        # Combine all logs
        all_logs = (
            verification_serializer.data + 
            outbound_serializer.data + 
            equipment_serializer.data
        )
        
        # Ensure all timestamps are strings before sorting
        for log in all_logs:
            # Convert datetime objects or integers to strings if needed
            if not isinstance(log['timestamp'], str):
                if hasattr(log['timestamp'], 'isoformat'):
                    # Handle datetime objects
                    log['timestamp'] = log['timestamp'].isoformat()
                else:
                    # Handle integers or other types
                    log['timestamp'] = str(log['timestamp'])
        
        # Sort combined logs by timestamp (descending)
        sorted_logs = sorted(all_logs, key=lambda x: x['timestamp'], reverse=True)
        
        return Response(sorted_logs)
