from rest_framework import generics
from ...models.operation_type import OperationType
from ...serializers.operation_type_serializer import OperationTypeSerializer
from ...permissions.role_permissions import IsAdmin


class OperationTypeListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of operation types or create a new one.
    """
    queryset = OperationType.objects.all()
    serializer_class = OperationTypeSerializer


class OperationTypeRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an operation type
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = OperationType.objects.all()
    serializer_class = OperationTypeSerializer
