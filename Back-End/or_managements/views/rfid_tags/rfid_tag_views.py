from rest_framework import generics
from ...models.rfid_tag import RFIDTag
from ...serializers.rfid_tag_serializer import RFIDTagSerializer, RFIDTagCreateUpdateSerializer


class RFIDTagListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of RFID tags or create a new one
    """
    queryset = RFIDTag.objects.all()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RFIDTagCreateUpdateSerializer
        return RFIDTagSerializer


class RFIDTagRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an RFID tag
    """
    queryset = RFIDTag.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return RFIDTagCreateUpdateSerializer
        return RFIDTagSerializer
