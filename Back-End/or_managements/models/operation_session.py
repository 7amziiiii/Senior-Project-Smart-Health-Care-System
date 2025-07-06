from django.db import models

class OperationSession(models.Model):
    """
    Represents a scheduled or completed operation session
    """
    STATE_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('verified', 'Verified'),
        ('outbound_cleared', 'Outbound Cleared'),
        ('cancelled', 'Cancelled')
    ]
    
    operation_type = models.ForeignKey('OperationType', on_delete=models.CASCADE)
    operation_room = models.ForeignKey('OperationRoom', on_delete=models.CASCADE)
    scheduled_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True)
    users = models.ManyToManyField('auth.User')
    state = models.CharField(max_length=50, choices=STATE_CHOICES, default='scheduled')
    
    def __str__(self):
        return f"Operation {self.id} - {self.operation_type} - {self.get_state_display()}"
    
    