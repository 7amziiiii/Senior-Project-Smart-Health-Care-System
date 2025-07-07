from rest_framework import generics
from ...models.operation_room import OperationRoom
from ...serializers.operation_room_serializer import OperationRoomSerializer
from ...permissions.role_permissions import IsAdmin, IsDoctorOrNurse


class OperationRoomListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of operation rooms or create a new one.
    """
    permission_classes = [IsAdmin | IsDoctorOrNurse]
    queryset = OperationRoom.objects.all()
    serializer_class = OperationRoomSerializer


class OperationRoomRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an operation room
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin | IsDoctorOrNurse]
    queryset = OperationRoom.objects.all()
    serializer_class = OperationRoomSerializer
