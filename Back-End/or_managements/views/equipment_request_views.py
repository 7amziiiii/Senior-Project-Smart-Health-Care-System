import sys

from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.serializers import ValidationError

from django.shortcuts import get_object_or_404
import datetime

from ..models.equipment_request import EquipmentRequest
from ..models.large_equipment import LargeEquipment
from ..serializers.equipment_request_serializer import EquipmentRequestSerializer, EquipmentRequestCreateSerializer
from ..serializers.large_equipment_serializer import LargeEquipmentSerializer
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
    
    def create(self, request, *args, **kwargs):
        # Use the equipment service to create the request
        equipment_id = request.data.get('equipment')
        operation_session_id = request.data.get('operation_session')
        
        # Get serializer and validate data
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Call the equipment service
        equipment_request, message = EquipmentService.request_equipment(
            equipment_id=equipment_id,
            operation_session_id=operation_session_id,
            requested_by_user=request.user
        )
        
        if not equipment_request:
            # If request creation failed, raise an exception
            raise ValidationError({"error": message})
        
        # Set the instance on the serializer
        serializer.instance = equipment_request
        
        # Get the equipment status to include in response
        equipment_status = LargeEquipment.objects.get(id=equipment_id).status
        
        # Return custom response with equipment status
        return Response({
            "request": serializer.data,
            "message": message,
            "equipment_status": equipment_status
        }, status=status.HTTP_201_CREATED)
    
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
        
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin | IsMaintenance])
    def fulfill(self, request, pk=None):
        """
        Fulfill an equipment request (mark as in_use)
        """
        equipment_request, message = EquipmentService.fulfill_request(
            request_id=pk
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
            # Try to convert to integer ID first
            try:
                operation_type_id_int = int(operation_type_id)
                operation_type = OperationType.objects.get(id=operation_type_id_int)
            except (ValueError, TypeError):
                # If not an integer, try to find by name
                operation_type = OperationType.objects.filter(name=operation_type_id).first()
                
            # If we couldn't find it by ID or name
            if operation_type is None:
                return Response(
                    {"error": f"Operation type not found: {operation_type_id}"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                {"error": f"Error finding operation type: {str(e)}"}, 
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
@permission_classes([IsAuthenticated])
def equipment_overview(request):
    """
    Get an overview of all equipment for the dashboard
    
    Returns a simplified view with:
    - Equipment basic info (name, type, ID)
    - Current status (based on equipment's own status field)
    """
    try:
        import logging
        import sys
        print("\nDEBUG: Processing equipment overview request", file=sys.stderr)
        
        # Get all equipment 
        equipment = LargeEquipment.objects.all()
        print(f"DEBUG: Found {equipment.count()} equipment items", file=sys.stderr)
        
        # Create result list
        results = []
        
        for eq in equipment:
            print(f"DEBUG: Processing equipment #{eq.id}: {eq.name}", file=sys.stderr)
            
            # Use the equipment's own status field
            status = "Available"
            status_class = "available"
            
            # Map status from equipment model
            if eq.status == 'in_use':
                status = "In OR Room"
                status_class = "in-or-room"
            elif eq.status == 'under_repair':
                status = "In Maintenance"
                status_class = "in-maintenance"
            elif eq.status == 'scheduled_maintenance':
                status = "Scheduled Maintenance"
                status_class = "maintenance-scheduled"
                
            # Use equipment's own location field
            location = eq.location or "-"
                
            results.append({
                'id': eq.id,
                'name': eq.name,
                'type': eq.equipment_type,
                'status': status,
                'status_class': status_class,
                'location': location,
                'last_maintenance': eq.last_maintenance_date.strftime('%Y-%m-%d') if eq.last_maintenance_date else "-",
                'next_maintenance': eq.next_maintenance_date.strftime('%Y-%m-%d') if eq.next_maintenance_date else "-",
                'notes': eq.notes  # Include notes field
            })
            
        print(f"DEBUG: Returning {len(results)} equipment items", file=sys.stderr)
        return Response(results)
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"ERROR in equipment_overview: {str(e)}\n{tb}", file=sys.stderr)
        return Response(
            {"error": f"Error retrieving equipment overview: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_equipment_notes(request, equipment_id):
    """
    Update notes for a specific piece of equipment
    
    Args:
        request: The HTTP request
        equipment_id: ID of the equipment to update
        
    Returns:
        Response with updated equipment data or error message
    """
    try:
        # Get the equipment
        equipment = get_object_or_404(LargeEquipment, id=equipment_id)
        
        # Get notes from request data
        notes = request.data.get('notes', '')
        print(f"DEBUG: Updating notes for equipment {equipment_id}: {notes}", file=sys.stderr)
        
        # Update notes field
        equipment.notes = notes
        equipment.save()
        
        return Response({
            'id': equipment.id,
            'name': equipment.name,
            'notes': equipment.notes,
            'message': 'Equipment notes updated successfully'
        })
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"ERROR in update_equipment_notes: {str(e)}\n{tb}", file=sys.stderr)
        return Response(
            {"error": f"Error updating equipment notes: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def operation_session_equipment(request, session_id):
    """
    Get equipment needed for a specific operation session
    """
    try:
        # Import here to avoid circular imports
        from ..models.operation_session import OperationSession
        from ..models.operation_type import OperationType
        from ..models.large_equipment import LargeEquipment
        from ..models.equipment_request import EquipmentRequest
        import logging
        
        # Enable debug logging
        logger = logging.getLogger(__name__)
        logger.debug(f"Processing equipment request for session_id: {session_id}")
        
        # Get the operation session
        operation_session = OperationSession.objects.get(id=session_id)
        logger.debug(f"Found operation session: {operation_session}")
        
        # Get the operation type for this session
        operation_type = operation_session.operation_type
        logger.debug(f"Operation type: {operation_type}")
        
        if operation_type is None:
            return Response([], status=status.HTTP_200_OK)
        
        # Get equipment for this operation type
        # Note: We're getting ALL equipment (both available and unavailable) to show the request button
        try:
            equipment_list = LargeEquipment.objects.all()
            logger.debug(f"Found {len(equipment_list)} equipment items")
        except Exception as eq:
            logger.error(f"Error querying equipment: {str(eq)}")
            # Return an empty list if we can't find any equipment
            equipment_list = []
        
        # Check which equipment is already assigned/requested
        try:
            requested_equipment_ids = set(EquipmentRequest.objects.filter(
                operation_session=operation_session
            ).values_list('equipment_id', flat=True))
            logger.debug(f"Found {len(requested_equipment_ids)} requested equipment items")
        except Exception as req_err:
            logger.error(f"Error querying equipment requests: {str(req_err)}")
            requested_equipment_ids = set()
        
        # Prepare response data
        equipment_data = []
        for equipment in equipment_list:
            try:
                # Add each piece of equipment with its availability status
                is_requested = equipment.id in requested_equipment_ids
                is_available = equipment.status == 'available'
                
                equipment_data.append({
                    'surgery_id': operation_session.id,
                    'equipment_id': equipment.id,
                    'equipment': {
                        'id': equipment.id,
                        'name': equipment.name,
                        'equipment_id': equipment.equipment_id,
                        'equipment_type': equipment.equipment_type,
                        'status': equipment.status,
                        'location': equipment.location,  # Include location field
                        'maintenance_date': equipment.next_maintenance_date.isoformat() if equipment.next_maintenance_date else None,
                    },
                    'isAvailable': is_available and not is_requested,
                    'isRequested': is_requested,
                    'isRequired': True  # All equipment shown is required for the surgery
                })
            except Exception as e_err:
                logger.error(f"Error processing equipment item {equipment.id}: {str(e_err)}")
        
        logger.debug(f"Returning {len(equipment_data)} equipment items")
        return Response(equipment_data, status=status.HTTP_200_OK)
        
    except OperationSession.DoesNotExist:
        return Response(
            {"error": f"Operation session {session_id} not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"ERROR: {str(e)}\n{tb}")
        return Response(
            {"error": f"Error retrieving equipment: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
