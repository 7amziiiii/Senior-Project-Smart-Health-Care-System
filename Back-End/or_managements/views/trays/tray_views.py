from rest_framework import generics
from ...models.tray import Tray
from ...serializers.tray_serializer import TraySerializer


class TrayListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of trays or create a new one
    """
    queryset = Tray.objects.all()
    serializer_class = TraySerializer


class TrayRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete a tray
    """
    queryset = Tray.objects.all()
    serializer_class = TraySerializer
