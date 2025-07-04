"""
URL configuration for outbound tracking API endpoints
"""

from django.urls import path

from ..views.outbound_tracking_views import (
    OutboundTrackingView,
    OutboundTrackingStatusView
)

urlpatterns = [
    # Perform outbound tracking check
    path(
        'operation-sessions/<int:operation_session_id>/outbound-check/',
        OutboundTrackingView.as_view(),
        name='outbound-tracking-check'
    ),
    
    # Get outbound tracking status for an operation session
    path(
        'operation-sessions/<int:operation_session_id>/outbound-status/',
        OutboundTrackingStatusView.as_view(),
        name='outbound-tracking-status'
    ),
]
