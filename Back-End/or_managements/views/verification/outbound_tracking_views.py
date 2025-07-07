import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import get_object_or_404

from or_managements.permissions.role_permissions import IsDoctorOrNurse, IsAdmin

from or_managements.models.operation_session import OperationSession
from or_managements.models.outbound_tracking import OutboundTracking
from or_managements.services.outbound_tracking_service import OutboundTrackingService

logger = logging.getLogger(__name__)


class OutboundTrackingViewSet(viewsets.ViewSet):
    """
    API endpoints for outbound tracking operations.
    
    This ViewSet follows the verification service pattern, with a single endpoint
    that always performs a scan before returning status information.
    """
    permission_classes = [IsAdmin | IsDoctorOrNurse]
    
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
                logger.debug(f"Found operation session: {pk}")
            except OperationSession.DoesNotExist:
                logger.warning(f"Operation session not found: {pk}")
                return Response(
                    {"error": "Operation session not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
                
            # Verify that this operation session has a verification session
            from or_managements.models.verification_session import VerificationSession
            try:
                verification_session = VerificationSession.objects.get(operation_session=operation_session)
                logger.debug(f"Found verification session for operation session: {pk}")
                if not verification_session.used_items_dict:
                    logger.warning(f"Verification session has no used_items_dict for operation session: {pk}")
                    return Response(
                        {"error": "No used items found in verification session"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except VerificationSession.DoesNotExist:
                logger.warning(f"No verification session found for operation session: {pk}")
                return Response(
                    {"error": "No verification session found. Please complete verification first."},
                    status=status.HTTP_400_BAD_REQUEST
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
            
            # Initialize outbound tracking service - use existing one if available
            logger.info(f"Creating OutboundTrackingService for operation_session_id={pk}")
            try:
                # Create service using existing record (if any)
                service = OutboundTrackingService(operation_session.id)
            except Exception as e:
                logger.error(f"Failed to initialize OutboundTrackingService: {str(e)}")
                return Response(
                    {"error": "Failed to initialize outbound tracking service", "details": str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Always perform a fresh scan and update the existing record
            logger.info(f"Performing fresh scan for operation_session_id={pk} with scan_duration={scan_duration}")
            try:
                result = service.perform_outbound_check(scan_duration, verbose)
                logger.debug(f"Outbound check result: {result}")
            except Exception as e:
                logger.error(f"Error performing outbound check: {str(e)}", exc_info=True)
                return Response(
                    {"error": "Error performing outbound check", "details": str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
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
