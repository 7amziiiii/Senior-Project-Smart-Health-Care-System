from rest_framework import permissions
from ..models.user_profile import UserProfile


class IsMaintenance(permissions.BasePermission):
    """
    Permission check for maintenance staff
    """
    message = "Only maintenance staff can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has the maintenance role
        return (
            request.user and 
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and 
            request.user.profile.role == UserProfile.MAINTENANCE
        )


class IsDoctor(permissions.BasePermission):
    """
    Permission check for doctors
    """
    message = "Only doctors can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has the doctor role
        return (
            request.user and 
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and 
            request.user.profile.role == UserProfile.DOCTOR
        )


class IsNurse(permissions.BasePermission):
    """
    Permission check for nurses
    """
    message = "Only nurses can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has the nurse role
        return (
            request.user and 
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and 
            request.user.profile.role == UserProfile.NURSE
        )


class IsDoctorOrNurse(permissions.BasePermission):
    """
    Permission check for medical staff (doctors or nurses)
    """
    message = "Only medical staff (doctors or nurses) can access this resource."

    def has_permission(self, request, view):
        # Check if user is authenticated and has either doctor or nurse role
        return (
            request.user and 
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and 
            request.user.profile.role in [UserProfile.DOCTOR, UserProfile.NURSE]
        )
