from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from ...serializers.auth.user_profile_serializer import UserWithProfileSerializer


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    API endpoint for users to view and update their profile
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserWithProfileSerializer
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        # Update User model fields
        if 'first_name' in serializer.validated_data:
            user.first_name = serializer.validated_data['first_name']
        if 'last_name' in serializer.validated_data:
            user.last_name = serializer.validated_data['last_name']
        if 'email' in serializer.validated_data:
            user.email = serializer.validated_data['email']
        
        # Update password if provided
        if 'password' in request.data:
            user.set_password(request.data['password'])
        
        user.save()
        
        # Return updated user data
        return Response(UserWithProfileSerializer(user).data, status=status.HTTP_200_OK)
