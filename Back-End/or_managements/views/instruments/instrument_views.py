from rest_framework import generics
from ...models.instrument import Instrument
from ...serializers.instrument_serializer import InstrumentSerializer
from ...permissions.role_permissions import IsAdmin


class InstrumentListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of instruments or create a new one.
    """
    
    queryset = Instrument.objects.all()
    serializer_class = InstrumentSerializer


class InstrumentRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an instrument
    Only accessible by admin users.
    """
    permission_classes = [IsAdmin]
    queryset = Instrument.objects.all()
    serializer_class = InstrumentSerializer
