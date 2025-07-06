from rest_framework import generics
from ...models.rfid_reader import RFID_Reader
from ...serializers.rfid_reader_serializer import RFIDReaderSerializer
from ...permissions.role_permissions import IsAdmin


class RFIDReaderListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of RFID readers or create a new one.
    """
    queryset = RFID_Reader.objects.all()
    serializer_class = RFIDReaderSerializer


class RFIDReaderRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an RFID reader
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = RFID_Reader.objects.all()
    serializer_class = RFIDReaderSerializer
