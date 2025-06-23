"""
Serializers module for or_managements app.
This file imports all serializers to make them accessible when importing from the app.
"""

# Import from auth module
from .auth import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UserWithProfileSerializer
)

# Import instrument serializers
from .instrument_serializers import InstrumentSerializer

__all__ = [
    # Authentication serializers
    'RegisterSerializer',
    'LoginSerializer',
    'UserProfileSerializer',
    'UserWithProfileSerializer',
    
    # Equipment serializers
    'InstrumentSerializer',
]
