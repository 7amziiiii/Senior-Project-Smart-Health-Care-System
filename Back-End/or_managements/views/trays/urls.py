from django.urls import path
from .tray_views import TrayListCreateView, TrayRetrieveUpdateDestroyView

urlpatterns = [
    path('', TrayListCreateView.as_view(), name='tray-list-create'),
    path('<int:pk>/', TrayRetrieveUpdateDestroyView.as_view(), name='tray-detail'),
]
