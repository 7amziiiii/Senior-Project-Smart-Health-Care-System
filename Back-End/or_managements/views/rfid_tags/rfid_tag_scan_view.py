from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ...models.rfid_tag import RFIDTag
from ...models.instrument import Instrument
from ...models.tray import Tray
from ...models.large_equipment import LargeEquipment
from ...serializers.rfid_tag_serializer import RFIDTagSerializer
from ...serializers.instrument_serializer import InstrumentSerializer
from ...serializers.tray_serializer import TraySerializer
from ...serializers.large_equipment_serializer import LargeEquipmentSerializer
from ...permissions.role_permissions import IsAdmin
from ...scripts.test import scan_rfid_tags  # Hilitand 125KHZ reader
import logging

# Configure logger
logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAdmin])
def scan_and_register_rfid(request):
    """
    Scan for RFID tags using the configured reader and register a new tag.
    This unified endpoint is used by all asset types (instruments, trays, large equipment).
    
    Request body:
    - scan_duration: Duration to scan in seconds (default: 3)
    - port: Optional COM port for the reader
    - baud_rate: Optional baud rate for the reader
    
    Returns:
    - If tag found and registered: 201 Created with tag data
    - If tag already exists: 200 OK with tag data
    - If no tag found: 404 Not Found
    - On error: 500 Internal Server Error
    """
    # Get parameters from request or use defaults
    scan_duration = request.data.get('scan_duration', 3)
    port = request.data.get('port', '')  # Empty string will use default from settings
    baud_rate = request.data.get('baud_rate', 0)  # 0 will use default from settings
    
    try:
        logger.info(f"Starting RFID scan with duration {scan_duration}s")
        # Scan for RFID tags
        scan_results = scan_rfid_tags(port, baud_rate, scan_duration, verbose=True)
        
        # Check if any tags were found
        tags = scan_results.get('tags', [])
        if not tags:
            logger.warning("No RFID tags detected during scan")
            return Response(
                {"error": "No RFID tags detected during scan"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Use the first tag found (usually only one tag should be presented at a time for registration)
        # The tag object contains {'epc': '...', 'timestamp': '...'}
        first_tag = tags[0]
        
        # Extract the tag_id (epc) from the tag object
        if isinstance(first_tag, dict) and 'epc' in first_tag:
            tag_id = first_tag['epc']
        else:
            # Fallback in case the format is different
            tag_id = str(first_tag)
            
        logger.info(f"RFID tag detected: {tag_id}")
        
        # Check if tag already exists
        try:
            existing_tag = RFIDTag.objects.get(tag_id=tag_id)
            logger.info(f"Tag {tag_id} already exists in database")
            
            # Check if tag is linked to any assets
            linked_asset = None
            asset_type = None
            asset_serializer = None
            
            try:
                instrument = Instrument.objects.get(rfid_tag=existing_tag)
                linked_asset = instrument
                asset_type = 'instrument'
                asset_serializer = InstrumentSerializer(instrument)
                logger.info(f"Tag is linked to instrument: {instrument.name}")
            except Instrument.DoesNotExist:
                try:
                    tray = Tray.objects.get(rfid_tag=existing_tag)
                    linked_asset = tray
                    asset_type = 'tray'
                    asset_serializer = TraySerializer(tray)
                    logger.info(f"Tag is linked to tray: {tray.name}")
                except Tray.DoesNotExist:
                    try:
                        equipment = LargeEquipment.objects.get(rfid_tag=existing_tag)
                        linked_asset = equipment
                        asset_type = 'large_equipment'
                        asset_serializer = LargeEquipmentSerializer(equipment)
                        logger.info(f"Tag is linked to large equipment: {equipment.name}")
                    except LargeEquipment.DoesNotExist:
                        logger.info(f"Tag exists but is not linked to any asset")
            
            serializer = RFIDTagSerializer(existing_tag)
            response_data = {
                "message": "Tag already exists",
                "tag": serializer.data,
                "exists": True,
                "is_linked": linked_asset is not None,
            }
            
            # If linked to an asset, include asset details
            if linked_asset:
                response_data["asset_type"] = asset_type
                response_data["asset"] = asset_serializer.data
                
            return Response(response_data)
        except RFIDTag.DoesNotExist:
            # Create new tag
            logger.info(f"Creating new tag with ID {tag_id}")
            tag = RFIDTag.objects.create(tag_id=tag_id)
            serializer = RFIDTagSerializer(tag)
            return Response({
                "message": "New RFID tag registered successfully",
                "tag": serializer.data,
                "exists": False
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        logger.error(f"Error in RFID tag scanning: {str(e)}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
