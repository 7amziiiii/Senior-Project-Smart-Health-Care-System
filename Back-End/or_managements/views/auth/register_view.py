from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from ...serializers.auth import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    """
    Generic API view for user registration.
    """
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response({
            "message": "User registered successfully. Account pending admin approval.",
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.profile.get_role_display(),
            "is_active": user.is_active
        }, status=status.HTTP_201_CREATED)
