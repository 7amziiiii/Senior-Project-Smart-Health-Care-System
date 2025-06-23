from rest_framework import serializers
from ...models import Instrument, Tray


class InstrumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instrument
        fields = '__all__'


class TraySerializer(serializers.ModelSerializer):
    class Meta:
        model = Tray
        fields = '__all__'
