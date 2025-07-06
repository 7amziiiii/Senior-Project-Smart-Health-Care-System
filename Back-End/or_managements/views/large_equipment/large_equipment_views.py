from rest_framework import generics
from ...models.large_equipment import LargeEquipment
from ...serializers.large_equipment_serializer import LargeEquipmentSerializer
from ...permissions.role_permissions import IsAdmin


class LargeEquipmentListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of large equipment or create a new one.
    """
    queryset = LargeEquipment.objects.all()
    serializer_class = LargeEquipmentSerializer


class LargeEquipmentRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete a large equipment
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = LargeEquipment.objects.all()
    serializer_class = LargeEquipmentSerializer
