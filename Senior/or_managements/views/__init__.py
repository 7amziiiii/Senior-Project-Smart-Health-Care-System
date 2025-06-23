"""
Views module for or_managements app.
This file imports all views to make them accessible when importing from the app.
"""

# Import from auth module
from .auth import (
    RegisterView,
    LoginView,
    LogoutView,
    PendingUsersListView,
    UserApprovalView
)

from .auth.user_profile_view import UserProfileView

__all__ = [
    # Authentication views
    'RegisterView',
    'LoginView',
    'LogoutView',
    'PendingUsersListView',
    'UserApprovalView',
    'UserProfileView',
]
