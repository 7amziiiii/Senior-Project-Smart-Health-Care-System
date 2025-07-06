"""
Views for handling verification API endpoints.
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny

from or_managements.models import OperationSession, VerificationSession
from or_managements.services.verification_service import VerificationService
from or_managements.permissions.role_permissions import IsDoctorOrNurse, IsAdmin

logger = logging.getLogger(__name__)

class VerificationViewSet(viewsets.ViewSet):
    # Apply specific permission classes for doctor/nurse roles and admin
    permission_classes = [IsAdmin, IsDoctorOrNurse]
    """
    API endpoints for verification operations.
    """
    
    @action(detail=True, methods=['GET'], url_path='status')
    def get_status(self, request, pk=None):
        """
        Get current verification status for an operation session.
        Always performs a new RFID scan and verification for real-time monitoring.
        
        Returns:
            Verification status with all categorized items
        """
        try:
            logger.debug(f"Verification status requested for operation_session_id={pk}")
            operation_session = OperationSession.objects.get(pk=pk)
            
            # Always create service and perform verification
            # VerificationService constructor will handle get_or_create with proper defaults
            logger.debug(f"Creating VerificationService for operation_session_id={pk}")
            service = VerificationService(operation_session.id)
            
            logger.debug(f"Performing verification for operation_session_id={pk}")
            result = service.perform_verification()
            
            logger.debug(f"Verification completed for operation_session_id={pk}: {result}")
            return Response(result)  # Return the result directly
            
        except OperationSession.DoesNotExist:
            logger.warning(f"Operation session not found: {pk}")
            return Response(
                {"error": "Operation session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.exception(f"Error in verification status: {str(e)}")
            return Response(
                {"error": "Verification failed", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
