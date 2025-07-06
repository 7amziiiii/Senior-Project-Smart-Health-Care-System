from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.models import Token
from ...serializers.auth import LoginSerializer
from ...models.user_profile import UserProfile


class LoginView(generics.GenericAPIView):
    """
    Generic API view for user login.
    """
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data
        
        # Create or get token for authenticated user
        token, created = Token.objects.get_or_create(user=user)
        
        # Get user profile information
        try:
            profile = user.profile
            role = profile.role
        except UserProfile.DoesNotExist:
            role = None
        
        return Response({
            "message": "Login successful",
            "user_id": user.id,
            "username": user.username,
            "token": token.key,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "role": role,
            "profile": {
                "role": role
            }
        }, status=status.HTTP_200_OK)
