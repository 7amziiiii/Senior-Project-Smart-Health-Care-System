from rest_framework import generics
from ...models.operation_session import OperationSession
from ...serializers.operation_session_serializer import OperationSessionListSerializer, OperationSessionDetailSerializer
from ...permissions.role_permissions import IsAdmin


class OperationSessionListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of operation sessions or create a new one
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = OperationSession.objects.all()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return OperationSessionDetailSerializer
        return OperationSessionListSerializer


class OperationSessionRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an operation session
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = OperationSession.objects.all()
    serializer_class = OperationSessionDetailSerializer
