from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from ...permissions.role_permissions import IsAdmin
from ...serializers.auth.user_profile_serializer import UserWithProfileSerializer
import logging

logger = logging.getLogger(__name__)


class UserListView(generics.ListAPIView):
    """
    View to list all users in the system.
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    serializer_class = UserWithProfileSerializer
    
    def get_queryset(self):
        # Get query parameters
        role_filter = self.request.query_params.get('role', None)
        
        queryset = User.objects.all().order_by('-date_joined')
        
        # Apply role filter if specified
        if role_filter and role_filter != 'all':
            queryset = queryset.filter(profile__role=role_filter)
            
        return queryset


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    View to retrieve, update, or delete a user.
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    serializer_class = UserWithProfileSerializer
    queryset = User.objects.all()
    
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
        if 'username' in serializer.validated_data:
            user.username = serializer.validated_data['username']
        if 'is_active' in serializer.validated_data:
            user.is_active = serializer.validated_data['is_active']
        
        # Update password if provided
        if 'password' in request.data:
            user.set_password(request.data['password'])
        
        # Update UserProfile fields
        profile = user.profile
        if 'role' in serializer.validated_data:
            profile.role = serializer.validated_data['role']
            # If setting role to admin, ensure is_staff is True
            if serializer.validated_data['role'] == 'admin':
                user.is_staff = True
            
        # Save both models
        user.save()
        profile.save()
        
        return Response(self.get_serializer(user).data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        username = user.username
        
        # Check if user is trying to delete themselves
        if request.user.id == user.id:
            return Response(
                {'error': 'You cannot delete your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform the deletion
        self.perform_destroy(user)
        
        return Response(
            {'message': f'User {username} has been deleted successfully.'},
            status=status.HTTP_200_OK
        )
