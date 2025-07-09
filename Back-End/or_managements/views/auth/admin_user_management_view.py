from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied
from ...permissions.role_permissions import IsAdmin
from ...serializers.auth.admin_user_serializer import AdminUserSerializer
from django.utils import timezone

class AdminUserListView(generics.ListAPIView):
    """
    View to list all users in the system.
    Only accessible by admin users.
    """
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        return User.objects.all()


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    View to retrieve, update, and delete users in the system.
    Only accessible by admin users.
    """
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        
        # Prevent admins from deleting themselves
        if request.user.id == user.id:
            raise PermissionDenied("You cannot delete your own admin account.")
        
        # Get user info for response before deletion
        username = user.username
        user_id = user.id
        
        # Delete the user
        self.perform_destroy(user)
        
        return Response({
            'message': f'User {username} (ID: {user_id}) has been deleted successfully.'
        }, status=status.HTTP_200_OK)
