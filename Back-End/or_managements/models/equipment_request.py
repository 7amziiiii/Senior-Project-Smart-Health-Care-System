from django.db import models
from django.utils import timezone


class EquipmentRequest(models.Model):
    """
    Tracks equipment requests, assignments, and usage for operations.
    Also serves as the data source for ML predictions.
    """
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('approved', 'Approved'),   # Add approved status for maintenance staff approval
        ('rejected', 'Rejected'),   # Add rejected status for maintenance staff rejection
        ('in_use', 'In Use'),
        ('returned', 'Returned'),
        ('maintenance', 'Maintenance')
    ]
    
    # Core relationships
    equipment = models.ForeignKey('LargeEquipment', on_delete=models.CASCADE, related_name='requests')
    operation_session = models.ForeignKey('OperationSession', on_delete=models.CASCADE, related_name='equipment_requests')
    
    # Basic fields
    requested_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='requested')
    
    # Time tracking fields (for ML)
    check_out_time = models.DateTimeField(null=True, blank=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    
    # Maintenance info (minimal)
    maintenance_type = models.CharField(max_length=50, null=True, blank=True)
    maintenance_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-check_out_time']
        indexes = [
            models.Index(fields=['equipment']),
            models.Index(fields=['operation_session']),
        ]
    
    def save(self, *args, **kwargs):
        # Calculate duration if check-in time is provided
        if self.check_in_time and self.check_out_time:
            delta = self.check_in_time - self.check_out_time
            self.duration_minutes = int(delta.total_seconds() / 60)
        
        super().save(*args, **kwargs)
    
    def check_out(self):
        """Check out equipment for use in operation"""
        self.status = 'in_use'
        self.check_out_time = timezone.now()
        
        # Update equipment status
        if self.equipment:
            self.equipment.status = 'in_use'
            self.equipment.save()
            
        self.save()
        return self
    
    def check_in(self):
        """Check in equipment after operation"""
        self.status = 'returned'
        self.check_in_time = timezone.now()
        
        # Update equipment status
        if self.equipment:
            self.equipment.status = 'available'
            self.equipment.save()
            
        self.save()
        return self
    
    def set_maintenance(self, maintenance_type):
        """Set equipment for maintenance"""
        self.status = 'maintenance'
        self.maintenance_type = maintenance_type
        self.maintenance_date = timezone.now()
        
        # Update equipment status
        if self.equipment:
            self.equipment.status = 'under_repair'
            self.equipment.save()
            
        self.save()
        return self
        
    def approve(self):
        """Approve equipment request"""
        self.status = 'approved'
        
        # Update equipment status to 'in_use' immediately upon approval
        if self.equipment:
            self.equipment.status = 'in_use'
            self.equipment.save()
                
        self.save()
        return self
        
    def reject(self):
        """Reject equipment request"""
        self.status = 'rejected'
        
        # No change to equipment status since rejection means equipment remains in its current state
        
        self.save()
        return self
    
    def __str__(self):
        return f"{self.equipment} - {self.get_status_display()} for {self.operation_session}"
