from django.db import models
from django.db.models import JSONField
from django.utils import timezone


class OutboundTracking(models.Model):
    """
    Tracks post-operation room checks to verify that all instruments and trays
    have been properly removed from the operating room after a procedure.
    """
    
    # Link to operation session
    operation_session = models.ForeignKey('OperationSession', on_delete=models.CASCADE, 
                                         related_name='outbound_checks')
    
    # Timestamps
    check_time = models.DateTimeField(default=timezone.now, help_text="When the outbound check was performed")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Room status
    room_cleared = models.BooleanField(default=False, help_text="Whether all items were removed from room after operation")
    
    # Items remaining in the room
    remaining_items = JSONField(default=dict, blank=True, help_text="Items that remain in the room after operation")
    
    # Extra items found in the room (not part of the operation)
    extra_items = JSONField(default=dict, blank=True, help_text="Items found in the room that were not used in this operation")
    
    # User who performed the check
    checked_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Optional notes about the check
    notes = models.TextField(blank=True, help_text="Optional notes about the outbound check")
    
    class Meta:
        ordering = ['-check_time']
    
    def __str__(self):
        status = "Empty" if self.room_cleared else "Not Empty"
        return f"Outbound Check for Operation {self.operation_session.id} - {status} - {self.check_time}"
