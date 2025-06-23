"""
Serializers module for or_managements app.
This file imports all serializers to make them accessible when importing from the app.
"""

# Import from auth module
from .auth import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UserWithProfileSerializer
)

# Import RFID serializers
from .rfid_reader_serializer import RFIDReaderSerializer
from .rfid_tag_serializer import RFIDTagSerializer, RFIDTagCreateUpdateSerializer

# Import equipment serializers
from .tray_serializer import TraySerializer
from .instrument_serializer import InstrumentSerializer
from .large_equipment_serializer import LargeEquipmentSerializer

# Import operation serializers
from .operation_type_serializer import OperationTypeSerializer
from .operation_room_serializer import OperationRoomSerializer
from .operation_session_serializer import OperationSessionListSerializer, OperationSessionDetailSerializer

__all__ = [
    # Authentication serializers
    'RegisterSerializer',
    'LoginSerializer',
    'UserProfileSerializer',
    'UserWithProfileSerializer',
    
    # RFID serializers
    'RFIDReaderSerializer',
    'RFIDTagSerializer',
    'RFIDTagCreateUpdateSerializer',
    
    # Equipment serializers
    'TraySerializer',
    'InstrumentSerializer',
    'LargeEquipmentSerializer',
    
    # Operation serializers
    'OperationTypeSerializer',
    'OperationRoomSerializer',
    'OperationSessionListSerializer',
    'OperationSessionDetailSerializer',
]
