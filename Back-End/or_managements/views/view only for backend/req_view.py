from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models.equipment_request import EquipmentRequest
from ..serializers.req_serializer import EquipmentRequestListSerializer, EquipmentRequestCreateSerializer
from ..permissions import IsMedical, IsNurse, IsStaff, IsDoctor, IsMaintenance, IsAdmin


class EquipmentRequestListCreateAPIView(generics.ListCreateAPIView):
    """
    API view to list all equipment requests and create new ones.
    List: GET /api/equipment-requests/
    Create: POST /api/equipment-requests/
    """
    queryset = EquipmentRequest.objects.all().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EquipmentRequestCreateSerializer
        return EquipmentRequestListSerializer
    
    def get_permissions(self):
        """
        * List action: Medical staff, Nurses, Doctors, Maintenance, and Admins can view requests
        * Create action: Medical staff, Nurses, and Doctors can create requests
        """
        if self.request.method == 'GET':
            return [IsAuthenticated() & (IsMedical() | IsNurse() | IsDoctor() | IsMaintenance() | IsAdmin())]
        return [IsAuthenticated() & (IsMedical() | IsNurse() | IsDoctor())]
    
    def perform_create(self, serializer):
        # Automatically set requester to current user if not specified
        if not serializer.validated_data.get('requester'):
            serializer.validated_data['requester'] = self.request.user
        
        # Default status for new requests is 'requested'
        if not serializer.validated_data.get('status'):
            serializer.validated_data['status'] = 'requested'
        
        serializer.save()
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
