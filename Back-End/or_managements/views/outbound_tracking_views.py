from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import get_object_or_404

from ..models.operation_session import OperationSession
from ..models.outbound_tracking import OutboundTracking
from ..services.outbound_tracking_service import OutboundTrackingService


class OutboundTrackingView(APIView):
    """
    API endpoint for outbound tracking of instruments and trays after operation.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, operation_session_id):
        """
        Perform an outbound tracking check for an operation session.
        
        Scans the room for RFID tags and checks if any items used in the operation remain.
        
        Args:
            request: HTTP request
            operation_session_id: ID of the operation session
            
        Returns:
            Response with outbound tracking results
        """
        try:
            # Parse scan duration from request (default to 5 seconds)
            scan_duration = request.data.get('scan_duration', 5)
            verbose = request.data.get('verbose', False)
            
            # Validate scan_duration
            try:
                scan_duration = int(scan_duration)
                if scan_duration <= 0:
                    return Response(
                        {"error": "scan_duration must be a positive integer"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {"error": "scan_duration must be a valid integer"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Get the operation session
            operation_session = get_object_or_404(OperationSession, id=operation_session_id)
            
            # Check if operation session is in a state where outbound tracking makes sense
            if operation_session.state == 'outbound_cleared':
                return Response(
                    {
                        "error": f"Room has already been cleared for this operation. "
                                 "No additional outbound tracking is needed."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif operation_session.state not in ['completed', 'verified']:
                return Response(
                    {
                        "error": f"Cannot perform outbound tracking on operation in '{operation_session.state}' state. "
                                 "Operation must be 'completed' or 'verified'."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Initialize outbound tracking service
            service = OutboundTrackingService(operation_session_id)
            
            # Perform outbound check
            result = service.perform_outbound_check(scan_duration, verbose)
            
            # Add the current user to the result if authenticated
            if request.user.is_authenticated:
                # Update the outbound tracking record with the user who performed the check
                outbound_check = OutboundTracking.objects.get(id=result['outbound_check_id'])
                outbound_check.checked_by = request.user
                outbound_check.save(update_fields=['checked_by'])
                
                # Add user info to result
                result['checked_by'] = {
                    'id': request.user.id,
                    'username': request.user.username
                }
            
            # Return results
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OutboundTrackingStatusView(APIView):
    """
    API endpoint for checking the status of outbound tracking.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, operation_session_id):
        """
        Get the status of outbound tracking for an operation session.
        
        Args:
            request: HTTP request
            operation_session_id: ID of the operation session
            
        Returns:
            Response with outbound tracking status
        """
        try:
            # Get the operation session
            operation_session = get_object_or_404(OperationSession, id=operation_session_id)
            
            # Get the latest outbound tracking record for this operation session
            outbound_check = OutboundTracking.objects.filter(
                operation_session_id=operation_session_id
            ).order_by('-check_time').first()
            
            # Check if outbound tracking has been performed
            if not outbound_check:
                return Response(
                    {
                        "operation_session_id": operation_session.id,
                        "room_cleared": None,
                        "check_time": None,
                        "remaining_items": {},
                        "message": "Outbound tracking has not been performed yet."
                    },
                    status=status.HTTP_200_OK
                )
            
            # Format user info if available
            checked_by = None
            if outbound_check.checked_by:
                checked_by = {
                    'id': outbound_check.checked_by.id,
                    'username': outbound_check.checked_by.username
                }
            
            # Return outbound tracking status
            return Response(
                {
                    "operation_session_id": operation_session.id,
                    "outbound_check_id": outbound_check.id,
                    "room_cleared": outbound_check.room_cleared,
                    "check_time": outbound_check.check_time,
                    "remaining_items": outbound_check.remaining_items,
                    "checked_by": checked_by,
                    "notes": outbound_check.notes
                },
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
