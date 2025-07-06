from rest_framework import generics
from ...models.rfid_tag import RFIDTag
from ...serializers.rfid_tag_serializer import RFIDTagSerializer, RFIDTagCreateUpdateSerializer
from ...permissions.role_permissions import IsAdmin


class RFIDTagListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of RFID tags or create a new one.
    """
    queryset = RFIDTag.objects.all()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RFIDTagCreateUpdateSerializer
        return RFIDTagSerializer


class RFIDTagRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an RFID tag
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = RFIDTag.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return RFIDTagCreateUpdateSerializer
        return RFIDTagSerializer
