"""
Views for handling verification API endpoints.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from or_managements.models import OperationSession, VerificationSession
from or_managements.services.verification_service import VerificationService


class VerificationViewSet(viewsets.ViewSet):
    """
    API endpoints for verification operations.
    """
    
    @action(detail=True, methods=['GET'], url_path='status')
    def get_status(self, request, pk=None):
        """
        Get current verification status for an operation session.
        
        Query Parameters:
            scan: If 'true', performs a new RFID scan and verification
                  If 'false' or omitted, returns the current status
        
        Returns:
            Verification status with all categorized items
        """
        try:
            operation_session = OperationSession.objects.get(pk=pk)
            
            # Check if we need to perform a new verification
            perform_new_verification = request.query_params.get('scan', 'false').lower() == 'true'
            
            if perform_new_verification:
                # Create service and perform verification
                service = VerificationService(operation_session)
                result = service.perform_verification()
                return Response(result)
            else:
                # Just return the current state from the verification session
                try:
                    verification_session = operation_session.verificationsession
                    # Format result similar to VerificationService._format_result
                    result = {
                        "verification_id": verification_session.id,
                        "state": verification_session.state,
                        "used_items": verification_session.used_items,
                        "missing_items": verification_session.missing_items,
                        "extra_items": verification_session.extra_items if hasattr(verification_session, 'extra_items') else {},
                        "available_items": verification_session.available_items,
                        "available_matches": verification_session.available_matches,
                        "last_updated": verification_session.updated_at.isoformat() 
                    }
                    return Response(result)
                except VerificationSession.DoesNotExist:
                    # No verification has been performed yet
                    return Response(
                        {"error": "No verification session exists for this operation"},
                        status=status.HTTP_404_NOT_FOUND
                    )
        except OperationSession.DoesNotExist:
            return Response(
                {"error": "Operation session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
