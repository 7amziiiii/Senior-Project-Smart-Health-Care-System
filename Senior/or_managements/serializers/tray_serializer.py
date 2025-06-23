from rest_framework import serializers
from ..models.tray import Tray


class TraySerializer(serializers.ModelSerializer):
    """
    Serializer for instrument trays
    """
    class Meta:
        model = Tray
        fields = ['id', 'name', 'number_of_instruments']
