from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class LogoutView(generics.GenericAPIView):
    """
    Generic API view for user logout.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        # Delete the user's authentication token
        try:
            request.user.auth_token.delete()
            return Response({
                "message": "Successfully logged out."
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
