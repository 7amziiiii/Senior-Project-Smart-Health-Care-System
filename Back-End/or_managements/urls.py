"""
URL configuration for or_managements app.
"""
from django.urls import path, include
from rest_framework import routers
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    PendingUsersListView,
    UserApprovalView,
    UserProfileView
)

# Router for API endpoints
router = routers.DefaultRouter()

# URL patterns for the app
urlpatterns = [
    # Authentication URLs
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/users/approval/', PendingUsersListView.as_view(), name='pending-users'),
    path('auth/users/<int:pk>/approve/', UserApprovalView.as_view(), name='approve-user'),
    path('auth/profile/', UserProfileView.as_view(), name='user-profile'),
    
    # Include router URLs
    path('', include(router.urls)),
]
