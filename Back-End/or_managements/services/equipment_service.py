from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q, Count, Sum, F, Avg
from django.db.models.functions import TruncDate

from ..models.equipment_request import EquipmentRequest
from ..models.large_equipment import LargeEquipment
from ..models.operation_session import OperationSession


class EquipmentService:
    """
    Service for managing large equipment requests, tracking, and maintenance
    
    This service handles:
    1. Equipment request/assignment for OR staff
    2. Request approval/rejection for maintenance staff
    3. Equipment availability checking
    4. Maintenance scheduling
    5. Usage statistics calculation (for ML)
    """
    
    @staticmethod
    def get_available_equipment(operation_date=None, operation_type=None):
        """
        Get equipment that is available for a given date and/or operation type
        
        Args:
            operation_date (datetime, optional): Date of operation
            operation_type (OperationType, optional): Type of operation
        
        Returns:
            QuerySet: Available LargeEquipment objects
        """
        # Start with all equipment
        available_equipment = LargeEquipment.objects.filter(is_active=True)
        
        # Filter out equipment in maintenance
        available_equipment = available_equipment.exclude(
            maintenance_status='in_maintenance'
        )
        
        # If operation date is provided, filter out equipment already scheduled for that date
        if operation_date:
            # Convert operation_date to datetime if it's just a date
            if not isinstance(operation_date, datetime):
                operation_date = datetime.combine(operation_date, datetime.min.time())
                
            # Get equipment IDs that are already booked for this date (requested or in_use)
            operation_start_time = operation_date
            operation_end_time = operation_date + timedelta(days=1)
            
            booked_equipment_ids = EquipmentRequest.objects.filter(
                Q(status__in=['requested', 'in_use']),
                Q(check_out_time__range=(operation_start_time, operation_end_time)) |
                Q(operation_session__scheduled_date=operation_date)
            ).values_list('equipment_id', flat=True).distinct()
            
            # Exclude booked equipment
            available_equipment = available_equipment.exclude(id__in=booked_equipment_ids)
        
        # If operation type is provided, filter by compatible types
        if operation_type:
            available_equipment = available_equipment.filter(
                compatible_operation_types=operation_type
            )
            
        return available_equipment
    
    @staticmethod
    def request_equipment(equipment_id, operation_session_id, requested_by_user):
        """
        Request equipment for an operation session
        
        Args:
            equipment_id (int): ID of the equipment to request
            operation_session_id (int): ID of the operation session
            requested_by_user (User): User requesting the equipment
            
        Returns:
            tuple: (EquipmentRequest, str) - The created request and status message
        """
        try:
            equipment = LargeEquipment.objects.get(id=equipment_id)
            operation_session = OperationSession.objects.get(id=operation_session_id)
            
            # Check if request already exists
            existing_request = EquipmentRequest.objects.filter(
                equipment=equipment,
                operation_session=operation_session
            ).first()
            
            if existing_request:
                return (existing_request, "Request already exists")
            
            # Check if equipment is available for this date
            operation_date = operation_session.scheduled_date
            available_equipment = EquipmentService.get_available_equipment(
                operation_date=operation_date
            )
            
            if equipment not in available_equipment:
                return (None, "Equipment is not available for this date")
            
            # Create new request
            request = EquipmentRequest.objects.create(
                equipment=equipment,
                operation_session=operation_session,
                requested_by=requested_by_user,
                status='requested'
            )
            
            return (request, "Equipment request created successfully")
            
        except LargeEquipment.DoesNotExist:
            return (None, "Equipment not found")
        except OperationSession.DoesNotExist:
            return (None, "Operation session not found")
        except Exception as e:
            return (None, f"Error creating request: {str(e)}")
    
    @staticmethod
    def approve_request(request_id, approved_by=None):
        """
        Approve an equipment request
        
        Args:
            request_id (int): ID of the request to approve
            approved_by (User, optional): User approving the request
            
        Returns:
            tuple: (EquipmentRequest, str) - The updated request and status message
        """
        try:
            request = EquipmentRequest.objects.get(id=request_id)
            
            # Only approve if in 'requested' status
            if request.status != 'requested':
                return (request, f"Request is already {request.get_status_display()}")
            
            # Update status and checkout time
            request.status = 'in_use'
            request.check_out_time = timezone.now()
            
            # Add approved_by information if a logging field is available
            # Currently not in the model, but could be added
            
            request.save()
            return (request, "Equipment request approved successfully")
            
        except EquipmentRequest.DoesNotExist:
            return (None, "Request not found")
        except Exception as e:
            return (None, f"Error approving request: {str(e)}")
    
    @staticmethod
    def reject_request(request_id, reason=None, rejected_by=None):
        """
        Reject an equipment request
        
        Args:
            request_id (int): ID of the request to reject
            reason (str, optional): Reason for rejection
            rejected_by (User, optional): User rejecting the request
            
        Returns:
            tuple: (EquipmentRequest, str) - The deleted request and status message
        """
        try:
            request = EquipmentRequest.objects.get(id=request_id)
            
            # Only reject if in 'requested' status
            if request.status != 'requested':
                return (request, f"Request is already {request.get_status_display()}")
            
            # For rejected requests, we'll delete them to keep the system clean
            # Alternative approach would be to add a 'rejected' status
            request_copy = request  # Copy for return value
            request.delete()
            
            return (request_copy, "Equipment request rejected successfully")
            
        except EquipmentRequest.DoesNotExist:
            return (None, "Request not found")
        except Exception as e:
            return (None, f"Error rejecting request: {str(e)}")
    
    @staticmethod
    def return_equipment(request_id):
        """
        Mark equipment as returned
        
        Args:
            request_id (int): ID of the request to mark as returned
            
        Returns:
            tuple: (EquipmentRequest, str) - The updated request and status message
        """
        try:
            request = EquipmentRequest.objects.get(id=request_id)
            
            # Only return if in 'in_use' status
            if request.status != 'in_use':
                return (request, f"Request is not in use, current status: {request.get_status_display()}")
            
            # Update status, check-in time, and duration
            now = timezone.now()
            request.status = 'returned'
            request.check_in_time = now
            
            # Calculate duration in minutes
            if request.check_out_time:
                delta = now - request.check_out_time
                request.duration_minutes = int(delta.total_seconds() / 60)
            
            request.save()
            return (request, "Equipment marked as returned successfully")
            
        except EquipmentRequest.DoesNotExist:
            return (None, "Request not found")
        except Exception as e:
            return (None, f"Error returning equipment: {str(e)}")
    
    @staticmethod
    def mark_for_maintenance(request_id, maintenance_type):
        """
        Mark equipment as needing maintenance after return
        
        Args:
            request_id (int): ID of the request
            maintenance_type (str): Type of maintenance needed
            
        Returns:
            tuple: (EquipmentRequest, str) - The updated request and status message
        """
        try:
            request = EquipmentRequest.objects.get(id=request_id)
            
            # Set maintenance fields
            request.status = 'maintenance'
            request.maintenance_type = maintenance_type
            request.maintenance_date = timezone.now()
            
            # Also update the equipment's maintenance status
            equipment = request.equipment
            equipment.maintenance_status = 'in_maintenance'
            equipment.last_maintenance_date = timezone.now()
            equipment.save()
            
            request.save()
            return (request, "Equipment marked for maintenance successfully")
            
        except EquipmentRequest.DoesNotExist:
            return (None, "Request not found")
        except Exception as e:
            return (None, f"Error marking for maintenance: {str(e)}")
    
    @staticmethod
    def complete_maintenance(request_id, notes=None):
        """
        Mark equipment maintenance as completed
        
        Args:
            request_id (int): ID of the maintenance request
            notes (str, optional): Notes about the maintenance performed
            
        Returns:
            tuple: (EquipmentRequest, str) - The updated request and status message
        """
        try:
            request = EquipmentRequest.objects.get(id=request_id)
            
            # Only complete if in 'maintenance' status
            if request.status != 'maintenance':
                return (request, f"Request is not in maintenance, current status: {request.get_status_display()}")
            
            # Update the equipment's maintenance status
            equipment = request.equipment
            equipment.maintenance_status = 'available'
            equipment.last_maintenance_date = timezone.now()
            # If we had a notes field, we would set it here
            equipment.save()
            
            # For completed maintenance, we can either delete the request
            # or keep it for record-keeping with a different status
            request_copy = request  # Copy for return value
            request.delete()
            
            return (request_copy, "Maintenance completed successfully")
            
        except EquipmentRequest.DoesNotExist:
            return (None, "Request not found")
        except Exception as e:
            return (None, f"Error completing maintenance: {str(e)}")
    
    @staticmethod
    def get_pending_requests():
        """
        Get all pending equipment requests
        
        Returns:
            QuerySet: EquipmentRequest objects with status 'requested'
        """
        return EquipmentRequest.objects.filter(status='requested')
    
    @staticmethod
    def get_equipment_in_use():
        """
        Get all equipment currently in use
        
        Returns:
            QuerySet: EquipmentRequest objects with status 'in_use'
        """
        return EquipmentRequest.objects.filter(status='in_use')
    
    @staticmethod
    def get_equipment_in_maintenance():
        """
        Get all equipment currently in maintenance
        
        Returns:
            QuerySet: EquipmentRequest objects with status 'maintenance'
        """
        return EquipmentRequest.objects.filter(status='maintenance')
    
    @staticmethod
    def get_equipment_usage_stats(equipment_id=None, start_date=None, end_date=None):
        """
        Get usage statistics for equipment
        
        Args:
            equipment_id (int, optional): ID of specific equipment
            start_date (datetime, optional): Start date for stats
            end_date (datetime, optional): End date for stats
            
        Returns:
            dict: Usage statistics
        """
        # Start with completed requests (have duration)
        requests = EquipmentRequest.objects.filter(
            duration_minutes__isnull=False
        )
        
        # Apply filters
        if equipment_id:
            requests = requests.filter(equipment_id=equipment_id)
        if start_date:
            requests = requests.filter(check_out_time__gte=start_date)
        if end_date:
            requests = requests.filter(check_in_time__lte=end_date)
            
        # Calculate statistics
        stats = {
            'total_requests': requests.count(),
            'total_usage_minutes': requests.aggregate(Sum('duration_minutes'))['duration_minutes__sum'] or 0,
            'avg_usage_minutes': requests.aggregate(Avg('duration_minutes'))['duration_minutes__avg'] or 0,
        }
        
        # Add usage by date if we have enough data
        if requests.count() > 0:
            usage_by_date = (
                requests
                .annotate(date=TruncDate('check_out_time'))
                .values('date')
                .annotate(count=Count('id'), minutes=Sum('duration_minutes'))
                .order_by('date')
            )
            
            stats['usage_by_date'] = list(usage_by_date)
            
        return stats
