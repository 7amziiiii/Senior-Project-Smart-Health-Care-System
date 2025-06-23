from django.db import models
from django.utils import timezone

class OperationRoom(models.Model):
    """
    Represents an operation room in the hospital
    """
    room_id = models.CharField(max_length=50, unique=True)
    state = models.CharField(
        max_length=50,
        choices=[
            ('available', 'Available'),
            ('in_use', 'In Use'),
            ('maintenance', 'Under Maintenance'),
            ('cleaning', 'Being Cleaned')
        ],
        default='available'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Room {self.room_id} - {self.get_state_display()}"
