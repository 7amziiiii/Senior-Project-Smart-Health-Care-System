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
from .views.auth.admin_user_management_view import UserListView, UserDetailView

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
from .views.equipment_request_views import (
    EquipmentRequestViewSet, available_equipment,
    pending_requests, equipment_in_use, equipment_in_maintenance, equipment_usage_stats,
    operation_session_equipment, equipment_overview, update_equipment_notes
)
from .views.equipment_requests.room_scan_view import scan_room_for_equipment
from .views.large_equipment.large_equipment_views import (
    LargeEquipmentListCreateView, 
    LargeEquipmentRetrieveUpdateDestroyView
)
from .views.trays.tray_views import (
    TrayListCreateView, 
    TrayRetrieveUpdateDestroyView
)
from .views.verification.verification_views import VerificationViewSet
from .views.verification.outbound_tracking_views import OutboundTrackingViewSet
from .views.ml_views import equipment_usage_logs, equipment_maintenance_history, procedure_stats
from .views.rfid_tags.rfid_tag_scan_view import scan_and_register_rfid
from .views.equipment_request_views import (EquipmentRequestViewSet, available_equipment, 
    pending_requests, equipment_in_use, equipment_in_maintenance, equipment_usage_stats,
    operation_session_equipment)

# Import system logs URL patterns
from or_managements.views import system_logs_views

# Router for API endpoints
router = DefaultRouter()

# Register viewsets
router.register(r'verification', VerificationViewSet, basename='verification')
router.register(r'outbound-tracking', OutboundTrackingViewSet, basename='outbound-tracking')
router.register(r'equipment-requests', EquipmentRequestViewSet, basename='equipment-requests')

# URL patterns for the app
urlpatterns = [
    # Authentication URLs
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/users/approval/', PendingUsersListView.as_view(), name='pending-users'),
    path('auth/users/<int:pk>/approve/', UserApprovalView.as_view(), name='approve-user'),
    path('auth/profile/', UserProfileView.as_view(), name='user-profile'),
    
    # Admin User Management URLs
    path('auth/users/', UserListView.as_view(), name='user-list'),
    path('auth/users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    
    # Operation Type URLs
    path('operation-types/', OperationTypeListCreateView.as_view(), name='operation-type-list-create'),
    path('operation-types/<int:pk>/', OperationTypeRetrieveUpdateDestroyView.as_view(), name='operation-type-detail'),
    
    # RFID Reader URLs
    path('rfid-readers/', RFIDReaderListCreateView.as_view(), name='rfid-reader-list-create'),
    path('rfid-readers/<int:pk>/', RFIDReaderRetrieveUpdateDestroyView.as_view(), name='rfid-reader-detail'),
    
    # RFID Tag URLs
    path('rfid-tags/', RFIDTagListCreateView.as_view(), name='rfid-tag-list-create'),
    path('rfid-tags/<int:pk>/', RFIDTagRetrieveUpdateDestroyView.as_view(), name='rfid-tag-detail'),
    path('rfid-tags/scan/', scan_and_register_rfid, name='rfid-tag-scan'),
    
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
    
    # Note: Outbound Tracking URLs are now handled by the OutboundTrackingViewSet
    # Access via /outbound-tracking/{operation_session_id}/status/

    # Outbound Tracking URLs
    # path('outbound-tracking/', OutboundTrackingList.as_view(), name='outbound-tracking-list'),
    
    # ML API Endpoints
    path('ml/equipment/usage/', equipment_usage_logs, name='ml-equipment-usage'),
    path('ml/equipment/maintenance/', equipment_maintenance_history, name='ml-equipment-maintenance'),
    path('ml/procedures/stats/', procedure_stats, name='ml-procedure-stats'),
    
    # Equipment Request Endpoints
    path('equipment/available/', available_equipment, name='available-equipment'),
    path('equipment/pending-requests/', pending_requests, name='pending-requests'),
    path('equipment/in-use/', equipment_in_use, name='equipment-in-use'),
    path('equipment/in-maintenance/', equipment_in_maintenance, name='equipment-in-maintenance'),
    path('equipment/usage-stats/', equipment_usage_stats, name='equipment-usage-stats'),
    path('equipment/scan-room/', scan_room_for_equipment, name='scan-room-for-equipment'),
    path('equipment/overview/', equipment_overview, name='equipment-overview'),
    path('equipment/<int:equipment_id>/update-notes/', update_equipment_notes, name='update-equipment-notes'),
    
    # Operation Session Equipment
    path('operation-sessions/<int:session_id>/equipment/', operation_session_equipment, name='operation-session-equipment'),
    
    # Include router URLs for viewsets
    path('', include(router.urls)),
    
    # System Logs URLs
    path('system-logs/all/', system_logs_views.CombinedSystemLogsView.as_view(), name='all-logs'),
    path('system-logs/verification-logs/', system_logs_views.VerificationLogView.as_view(), name='verification-logs'),
    path('system-logs/outbound-logs/', system_logs_views.OutboundTrackingLogView.as_view(), name='outbound-logs'),
    path('system-logs/equipment-request-logs/', system_logs_views.EquipmentRequestLogView.as_view(), name='equipment-request-logs'),
]
