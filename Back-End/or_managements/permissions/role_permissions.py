from rest_framework import permissions
from ..models.user_profile import UserProfile


class IsAdmin(permissions.BasePermission):
    """
    Permission check for admin users
    """
    message = "Only admin users can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has the admin role OR is_staff=True
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Django admin (is_staff=True) always has permission
        if request.user.is_staff:
            return True
            
        # Custom admin role also has permission
        return (
            hasattr(request.user, 'profile') and 
            request.user.profile.role == UserProfile.ADMIN
        )


class IsMaintenance(permissions.BasePermission):
    """
    Permission check for maintenance staff or admin
    """
    message = "Only maintenance staff or admin can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has the maintenance role or is admin
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Custom role permissions
        return (
            hasattr(request.user, 'profile') and 
            (request.user.profile.role == UserProfile.MAINTENANCE or
             request.user.profile.role == UserProfile.ADMIN)
        )


class IsDoctor(permissions.BasePermission):
    """
    Permission check for doctors or admin
    """
    message = "Only doctors or admin can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has the doctor role or is admin
        if not request.user or not request.user.is_authenticated:
            return False
            
 
        # Custom role permissions
        return (
            hasattr(request.user, 'profile') and 
            (request.user.profile.role == UserProfile.DOCTOR or
             request.user.profile.role == UserProfile.ADMIN)
        )


class IsNurse(permissions.BasePermission):
    """
    Permission check for nurses or admin
    """
    message = "Only nurses or admin can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has the nurse role or is admin
        if not request.user or not request.user.is_authenticated:
            return False
            

        # Custom role permissions
        return (
            hasattr(request.user, 'profile') and 
            (request.user.profile.role == UserProfile.NURSE or
             request.user.profile.role == UserProfile.ADMIN)
        )


class IsDoctorOrNurse(permissions.BasePermission):
    """
    Permission check for medical staff (doctors or nurses) or admin
    """
    message = "Only medical staff (doctors or nurses) or admin can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has either doctor or nurse role or is admin
        if not request.user or not request.user.is_authenticated:
            return False
            

        # Custom role permissions
        return (
            hasattr(request.user, 'profile') and 
            request.user.profile.role in [UserProfile.DOCTOR, UserProfile.NURSE, UserProfile.ADMIN]
        )


class IsAdminOrStaff(permissions.BasePermission):
    """
    Permission check for users who are either Django staff users (is_staff=True)
    or have the custom admin role in UserProfile
    """
    message = "Only admin users or staff can access this resource."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            

        # Custom admin role also has permission
        return (
            hasattr(request.user, 'profile') and 
            request.user.profile.role == UserProfile.ADMIN
        )
