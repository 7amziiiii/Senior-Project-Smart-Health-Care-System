from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework.views import APIView
from ...permissions.role_permissions import IsAdmin


class PendingUsersListView(generics.ListAPIView):
    """
    View to list all users pending approval.
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        return User.objects.filter(is_active=False)
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        users_data = []
        
        for user in queryset:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.profile.get_role_display(),
                'date_joined': user.date_joined
            })
        
        return Response({
            'count': len(users_data),
            'pending_users': users_data
        })


import logging
logger = logging.getLogger(__name__)

class UserApprovalView(APIView):
    """
    View to approve or reject user registrations.
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    
    def post(self, request, pk):
        try:
            # Log the received parameters to help debug
            logger.error(f"UserApprovalView received: user_id={pk}, request.data={request.data}")
            
            user = User.objects.get(id=pk, is_active=False)
            action = request.data.get('action', '').lower()
            
            if action == 'approve':
                user.is_active = True
                user.save()
                return Response({
                    'message': f'User {user.username} has been approved successfully.',
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.profile.get_role_display(),
                    'is_active': user.is_active
                }, status=status.HTTP_200_OK)
            elif action == 'reject':
                username = user.username
                user.delete()
                return Response({
                    'message': f'User {username} has been rejected and removed.'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': "Invalid action. Use 'approve' or 'reject'."
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({
                'error': 'User not found or already approved.'
            }, status=status.HTTP_404_NOT_FOUND)
