"""
Custom permission backend to allow admin users to access all views
"""
from ..models.user_profile import UserProfile

class AdminPermissionBackend:
    """
    Custom authentication backend that gives admin users permission to do anything.
    This follows Django's authentication backend pattern.
    """
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        # We don't handle authentication here, just permissions
        # Return None to fall back to the next authentication backend
        return None
    
    def has_perm(self, user_obj, perm, obj=None):
        # Check if user is admin, if so allow any permission
        return (
            user_obj and 
            user_obj.is_authenticated and 
            hasattr(user_obj, 'profile') and 
            user_obj.profile.role == UserProfile.ADMIN
        )
    
    def has_module_perms(self, user_obj, app_label):
        # Admin has permissions for all modules/apps
        return (
            user_obj and 
            user_obj.is_authenticated and 
            hasattr(user_obj, 'profile') and 
            user_obj.profile.role == UserProfile.ADMIN
        )
