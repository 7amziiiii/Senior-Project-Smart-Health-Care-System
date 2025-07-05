from rest_framework import generics
from ..models.outbound_tracking import OutboundTracking
from ..serializers.log import OutboundTrackingSerializer


class OutboundTrackingList(generics.ListCreateAPIView):
    queryset = OutboundTracking.objects.all()
    serializer_class = OutboundTrackingSerializer


class OutboundTrackingDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = OutboundTracking.objects.all()
    serializer_class = OutboundTrackingSerializer
