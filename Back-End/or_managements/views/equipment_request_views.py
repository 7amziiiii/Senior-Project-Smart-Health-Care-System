from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import get_object_or_404

from ..models.equipment_request import EquipmentRequest
from ..models.large_equipment import LargeEquipment
from ..serializers.equipment_request_serializer import EquipmentRequestSerializer, EquipmentRequestCreateSerializer
from ..services.equipment_service import EquipmentService
from ..permissions.role_permissions import IsAdmin, IsMaintenance, IsDoctor, IsNurse


class EquipmentRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing equipment requests
    """
    queryset = EquipmentRequest.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return EquipmentRequestCreateSerializer
        return EquipmentRequestSerializer
    
    def get_permissions(self):
        """
        - List/Retrieve: Admin or Maintenance
        - Create: Admin, Doctor, or Nurse
        - Update/Delete: Admin or Maintenance
        """
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAdmin | IsMaintenance]
        elif self.action == 'create':
            permission_classes = [IsAdmin | IsDoctor | IsNurse]
        else:
            permission_classes = [IsAdmin | IsMaintenance]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        # Use the equipment service to create the request
        equipment_id = self.request.data.get('equipment')
        operation_session_id = self.request.data.get('operation_session')
        
        request, message = EquipmentService.request_equipment(
            equipment_id=equipment_id,
            operation_session_id=operation_session_id,
            requested_by_user=self.request.user
        )
        
        if not request:
            # If request creation failed, raise an exception
            raise serializer.ValidationError({"error": message})
        
        # No need to save serializer as the service created the object
        serializer.instance = request
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin | IsMaintenance])
    def approve(self, request, pk=None):
        """
        Approve an equipment request
        """
        equipment_request, message = EquipmentService.approve_request(
            request_id=pk,
            approved_by=request.user
        )
        
        if not equipment_request:
            return Response({"error": message}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = EquipmentRequestSerializer(equipment_request)
        return Response({"message": message, "request": serializer.data})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin | IsMaintenance])
    def reject(self, request, pk=None):
        """
        Reject an equipment request
        """
        reason = request.data.get('reason', '')
        equipment_request, message = EquipmentService.reject_request(
            request_id=pk,
            reason=reason,
            rejected_by=request.user
        )
        
        if not equipment_request:
            return Response({"error": message}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = EquipmentRequestSerializer(equipment_request)
        return Response({"message": message, "request": serializer.data})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin | IsMaintenance | IsDoctor | IsNurse])
    def return_equipment(self, request, pk=None):
        """
        Mark equipment as returned
        """
        equipment_request, message = EquipmentService.return_equipment(
            request_id=pk
        )
        
        if not equipment_request:
            return Response({"error": message}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = EquipmentRequestSerializer(equipment_request)
        return Response({"message": message, "request": serializer.data})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin | IsMaintenance])
    def mark_for_maintenance(self, request, pk=None):
        """
        Mark equipment as needing maintenance
        """
        maintenance_type = request.data.get('maintenance_type', 'routine')
        equipment_request, message = EquipmentService.mark_for_maintenance(
            request_id=pk,
            maintenance_type=maintenance_type
        )
        
        if not equipment_request:
            return Response({"error": message}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = EquipmentRequestSerializer(equipment_request)
        return Response({"message": message, "request": serializer.data})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin | IsMaintenance])
    def complete_maintenance(self, request, pk=None):
        """
        Complete maintenance on equipment
        """
        notes = request.data.get('notes', '')
        equipment_request, message = EquipmentService.complete_maintenance(
            request_id=pk,
            notes=notes
        )
        
        if not equipment_request:
            return Response({"error": message}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = EquipmentRequestSerializer(equipment_request)
        return Response({"message": message, "request": serializer.data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_equipment(request):
    """
    Get equipment available for a given date and operation type
    """
    operation_date = request.query_params.get('operation_date')
    operation_type_id = request.query_params.get('operation_type')
    
    # Convert operation_type_id to OperationType object if provided
    operation_type = None
    if operation_type_id:
        try:
            from ..models.operation_type import OperationType
            operation_type = OperationType.objects.get(id=operation_type_id)
        except Exception:
            return Response(
                {"error": "Invalid operation type ID"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Get available equipment using the service
    equipment_list = EquipmentService.get_available_equipment(
        operation_date=operation_date,
        operation_type=operation_type
    )
    
    # Serialize the results
    from ..serializers.large_equipment_serializer import LargeEquipmentSerializer
    serializer = LargeEquipmentSerializer(equipment_list, many=True)
    
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdmin | IsMaintenance])
def pending_requests(request):
    """
    Get all pending equipment requests
    """
    requests = EquipmentService.get_pending_requests()
    serializer = EquipmentRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdmin | IsMaintenance])
def equipment_in_use(request):
    """
    Get all equipment currently in use
    """
    requests = EquipmentService.get_equipment_in_use()
    serializer = EquipmentRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdmin | IsMaintenance])
def equipment_in_maintenance(request):
    """
    Get all equipment currently in maintenance
    """
    requests = EquipmentService.get_equipment_in_maintenance()
    serializer = EquipmentRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdmin | IsMaintenance])
def equipment_usage_stats(request):
    """
    Get equipment usage statistics
    """
    equipment_id = request.query_params.get('equipment_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    stats = EquipmentService.get_equipment_usage_stats(
        equipment_id=equipment_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return Response(stats)
