from rest_framework import generics
from ...models.operation_room import OperationRoom
from ...serializers.operation_room_serializer import OperationRoomSerializer


class OperationRoomListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of operation rooms or create a new one
    """
    queryset = OperationRoom.objects.all()
    serializer_class = OperationRoomSerializer


class OperationRoomRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an operation room
    """
    queryset = OperationRoom.objects.all()
    serializer_class = OperationRoomSerializer
