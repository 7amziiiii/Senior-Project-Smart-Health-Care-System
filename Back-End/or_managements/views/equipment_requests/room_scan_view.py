from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ...models.large_equipment import LargeEquipment
from ...serializers.large_equipment_serializer import LargeEquipmentSerializer
from ...services.equipment_service import EquipmentService
from ...permissions.role_permissions import IsAdmin, IsDoctorOrNurse

import logging

# Configure logger
logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAdmin | IsDoctorOrNurse])
def scan_room_for_equipment(request):
    """
    Scan a room for equipment using RFID technology
    
    Request body:
    - room_id: ID or name of the room to scan (required)
    - scan_duration: Duration to scan in seconds (default: 3)
    
    Returns:
    - equipment_in_room: Equipment properly located in this room
    - unexpected_equipment: Equipment found but not assigned to this room
    - missing_equipment: Equipment assigned to this room but not found
    """
    room_id = request.data.get('room_id')
    scan_duration = request.data.get('scan_duration', 3)
    
    if not room_id:
        return Response(
            {"error": "Room ID is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        logger.info(f"Starting room scan for room {room_id} with duration {scan_duration}s")
        
        # Call the service method to scan the room
        results = EquipmentService.scan_room_for_equipment(room_id, scan_duration)
        
        # Serialize the equipment lists
        serialized_results = {
            'equipment_in_room': LargeEquipmentSerializer(results['equipment_in_room'], many=True).data,
            'unexpected_equipment': LargeEquipmentSerializer(results['unexpected_equipment'], many=True).data,
            'missing_equipment': LargeEquipmentSerializer(results['missing_equipment'], many=True).data,
        }
        
        return Response(serialized_results, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error during room scan: {str(e)}")
        return Response(
            {"error": f"Failed to scan room: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
