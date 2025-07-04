"""
URL configuration for or_managements app.
"""
from django.urls import path, include
from rest_framework import routers
from rest_framework.routers import DefaultRouter

# Import authentication views
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    PendingUsersListView,
    UserApprovalView,
    UserProfileView
)

# Import model views
from .views.operation_types.operation_type_views import (
    OperationTypeListCreateView, 
    OperationTypeRetrieveUpdateDestroyView
)
from .views.rfid_readers.rfid_reader_views import (
    RFIDReaderListCreateView, 
    RFIDReaderRetrieveUpdateDestroyView
)
from .views.rfid_tags.rfid_tag_views import (
    RFIDTagListCreateView, 
    RFIDTagRetrieveUpdateDestroyView
)
from .views.operation_rooms.operation_room_views import (
    OperationRoomListCreateView, 
    OperationRoomRetrieveUpdateDestroyView
)
from .views.operation_sessions.operation_session_views import (
    OperationSessionListCreateView, 
    OperationSessionRetrieveUpdateDestroyView
)
from .views.instruments.instrument_views import (
    InstrumentListCreateView, 
    InstrumentRetrieveUpdateDestroyView
)
from .views.large_equipment.large_equipment_views import (
    LargeEquipmentListCreateView, 
    LargeEquipmentRetrieveUpdateDestroyView
)
from .views.trays.tray_views import (
    TrayListCreateView, 
    TrayRetrieveUpdateDestroyView
)
from .views.verification_views import VerificationViewSet
from .views.outbound_tracking_views import (
    OutboundTrackingView,
    OutboundTrackingStatusView
)


# Router for API endpoints
router = DefaultRouter()

# Register viewsets
router.register(r'verification', VerificationViewSet, basename='verification')

# URL patterns for the app
urlpatterns = [
    # Authentication URLs
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/users/approval/', PendingUsersListView.as_view(), name='pending-users'),
    path('auth/users/<int:pk>/approve/', UserApprovalView.as_view(), name='approve-user'),
    path('auth/profile/', UserProfileView.as_view(), name='user-profile'),
    
    # Operation Type URLs
    path('operation-types/', OperationTypeListCreateView.as_view(), name='operation-type-list-create'),
    path('operation-types/<int:pk>/', OperationTypeRetrieveUpdateDestroyView.as_view(), name='operation-type-detail'),
    
    # RFID Reader URLs
    path('rfid-readers/', RFIDReaderListCreateView.as_view(), name='rfid-reader-list-create'),
    path('rfid-readers/<int:pk>/', RFIDReaderRetrieveUpdateDestroyView.as_view(), name='rfid-reader-detail'),
    
    # RFID Tag URLs
    path('rfid-tags/', RFIDTagListCreateView.as_view(), name='rfid-tag-list-create'),
    path('rfid-tags/<int:pk>/', RFIDTagRetrieveUpdateDestroyView.as_view(), name='rfid-tag-detail'),
    
    # Operation Room URLs
    path('operation-rooms/', OperationRoomListCreateView.as_view(), name='operation-room-list-create'),
    path('operation-rooms/<int:pk>/', OperationRoomRetrieveUpdateDestroyView.as_view(), name='operation-room-detail'),
    
    # Operation Session URLs
    path('operation-sessions/', OperationSessionListCreateView.as_view(), name='operation-session-list-create'),
    path('operation-sessions/<int:pk>/', OperationSessionRetrieveUpdateDestroyView.as_view(), name='operation-session-detail'),
    
    # Instrument URLs
    path('instruments/', InstrumentListCreateView.as_view(), name='instrument-list-create'),
    path('instruments/<int:pk>/', InstrumentRetrieveUpdateDestroyView.as_view(), name='instrument-detail'),
    
    # Large Equipment URLs
    path('large-equipment/', LargeEquipmentListCreateView.as_view(), name='large-equipment-list-create'),
    path('large-equipment/<int:pk>/', LargeEquipmentRetrieveUpdateDestroyView.as_view(), name='large-equipment-detail'),
    
    # Tray URLs
    path('trays/', TrayListCreateView.as_view(), name='tray-list-create'),
    path('trays/<int:pk>/', TrayRetrieveUpdateDestroyView.as_view(), name='tray-detail'),
    
    # Outbound Tracking URLs
    path('operation-sessions/<int:operation_session_id>/outbound-check/', 
         OutboundTrackingView.as_view(), 
         name='outbound-tracking-check'),
    path('operation-sessions/<int:operation_session_id>/outbound-status/', 
         OutboundTrackingStatusView.as_view(), 
         name='outbound-tracking-status'),

    # Include router URLs for viewsets
    path('', include(router.urls)),
]
