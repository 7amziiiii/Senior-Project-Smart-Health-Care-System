from rest_framework import generics
from ...models.tray import Tray
from ...serializers.tray_serializer import TraySerializer
from ...permissions.role_permissions import IsAdmin


class TrayListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of trays or create a new one.
    """
    queryset = Tray.objects.all()
    serializer_class = TraySerializer


class TrayRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete a tray
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = Tray.objects.all()
    serializer_class = TraySerializer
