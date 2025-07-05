import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import get_object_or_404

from ..models.operation_session import OperationSession
from ..models.outbound_tracking import OutboundTracking
from ..services.outbound_tracking_service import OutboundTrackingService

logger = logging.getLogger(__name__)


class OutboundTrackingViewSet(viewsets.ViewSet):
    """
    API endpoints for outbound tracking operations.
    
    This ViewSet follows the verification service pattern, with a single endpoint
    that always performs a scan before returning status information.
    """
    # Using default permission classes from project settings
    
    @action(detail=True, methods=['GET'], url_path='status')
    def get_status(self, request, pk=None):
        """
        Get current outbound tracking status for an operation session.
        Always performs a new RFID scan for real-time monitoring.
        
        Returns:
            Outbound tracking status with all remaining items
        """
        try:
            logger.debug(f"Outbound tracking status requested for operation_session_id={pk}")
            
            # Parse scan duration from request (default to 5 seconds)
            scan_duration = request.query_params.get('scan_duration', 5)
            verbose = request.query_params.get('verbose', False) == 'true'
            
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
            try:
                operation_session = OperationSession.objects.get(pk=pk)
            except OperationSession.DoesNotExist:
                logger.warning(f"Operation session not found: {pk}")
                return Response(
                    {"error": "Operation session not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # # Check if operation session is in a state where outbound tracking makes sense
            # if operation_session.state == 'outbound_cleared':
            #     return Response(
            #         {
            #             "error": f"Room has already been cleared for this operation. "
            #                      "No additional outbound tracking is needed."
            #         },
            #         status=status.HTTP_400_BAD_REQUEST
            #     )
            # elif operation_session.state not in ['completed', 'verified']:
            #     return Response(
            #         {
            #             "error": f"Cannot perform outbound tracking on operation in '{operation_session.state}' state. "
            #                      "Operation must be 'completed' or 'verified'."
            #         },
            #         status=status.HTTP_400_BAD_REQUEST
            #     )
            
            # Initialize outbound tracking service
            logger.debug(f"Creating OutboundTrackingService for operation_session_id={pk}")
            service = OutboundTrackingService(operation_session.id)
            
            # Always perform a new outbound check
            logger.debug(f"Performing outbound check for operation_session_id={pk} with scan_duration={scan_duration}")
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
            
            logger.debug(f"Outbound check completed for operation_session_id={pk}: {result['room_cleared']}")
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            logger.warning(f"Validation error in outbound tracking: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception(f"Error in outbound tracking: {str(e)}")
            return Response(
                {"error": "Outbound tracking failed", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
