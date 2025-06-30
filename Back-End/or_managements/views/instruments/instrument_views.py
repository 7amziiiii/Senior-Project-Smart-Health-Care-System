from rest_framework import generics
from ...models.instrument import Instrument
from ...serializers.instrument_serializer import InstrumentSerializer


class InstrumentListCreateView(generics.ListCreateAPIView):
    """
    API view to retrieve list of instruments or create a new one
    """
    queryset = Instrument.objects.all()
    serializer_class = InstrumentSerializer


class InstrumentRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update or delete an instrument
    """
    queryset = Instrument.objects.all()
    serializer_class = InstrumentSerializer
