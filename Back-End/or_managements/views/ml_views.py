from rest_framework import status, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404

from ..models.equipment_request import EquipmentRequest
from ..models.large_equipment import LargeEquipment
from ..models.operation_session import OperationSession
from ..serializers.ml_serializers import (
    EquipmentUsageLogSerializer, 
    EquipmentMaintenanceHistorySerializer,
    ProcedureStatsSerializer
)
from or_managements.permissions.role_permissions import IsAdmin, IsMaintenance


@api_view(['GET'])
@permission_classes([IsAdmin | IsMaintenance])
def equipment_usage_logs(request):
    """
    API endpoint for equipment usage logs for ML analysis
    GET /api/ml/equipment/usage/
    """
    # Query parameters for filtering
    equipment_id = request.query_params.get('equipment_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    # Base queryset - only include records with check-out and check-in times
    queryset = EquipmentRequest.objects.filter(
        check_out_time__isnull=False,
        check_in_time__isnull=False
    ).order_by('-check_out_time')
    
    # Apply filters if provided
    if equipment_id:
        queryset = queryset.filter(equipment__equipment_id=equipment_id)
    if start_date:
        queryset = queryset.filter(check_out_time__gte=start_date)
    if end_date:
        queryset = queryset.filter(check_in_time__lte=end_date)
        
    serializer = EquipmentUsageLogSerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdmin | IsMaintenance])
def equipment_maintenance_history(request):
    """
    API endpoint for equipment maintenance history for ML analysis
    GET /api/ml/equipment/maintenance/
    """
    # Query parameters for filtering
    equipment_id = request.query_params.get('equipment_id')
    maintenance_type = request.query_params.get('maintenance_type')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    # Base queryset - only include records with maintenance data
    queryset = EquipmentRequest.objects.filter(
        maintenance_date__isnull=False,
        maintenance_type__isnull=False
    ).order_by('-maintenance_date')
    
    # Apply filters if provided
    if equipment_id:
        queryset = queryset.filter(equipment__equipment_id=equipment_id)
    if maintenance_type:
        queryset = queryset.filter(maintenance_type=maintenance_type)
    if start_date:
        queryset = queryset.filter(maintenance_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(maintenance_date__lte=end_date)
        
    serializer = EquipmentMaintenanceHistorySerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdmin | IsMaintenance])
def procedure_stats(request):
    """
    API endpoint for equipment procedure statistics for ML analysis
    GET /api/ml/procedures/stats/
    """
    # Get all equipment IDs or filter by a specific ID
    equipment_id = request.query_params.get('equipment_id')
    
    if equipment_id:
        equipment_ids = [equipment_id]
    else:
        # Get all equipment IDs that have been used in at least one request
        equipment_ids = EquipmentRequest.objects.values_list(
            'equipment__equipment_id', flat=True
        ).distinct()
    
    # Generate stats for each equipment
    results = []
    for eq_id in equipment_ids:
        stats = ProcedureStatsSerializer.generate_stats(eq_id)
        if stats:
            serializer = ProcedureStatsSerializer(data=stats)
            if serializer.is_valid():
                results.append(serializer.data)
    
    return Response(results)
