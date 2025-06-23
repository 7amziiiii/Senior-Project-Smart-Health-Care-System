from rest_framework import serializers
from ..models.operation_type import OperationType


class OperationTypeSerializer(serializers.ModelSerializer):
    """
    Serializer for operation types
    """
    class Meta:
        model = OperationType
        fields = ['id', 'name', 'required_instruments']
