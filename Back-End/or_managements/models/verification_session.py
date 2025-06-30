from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

class VerificationSession(models.Model):
    """
    Represents a verification session for an operation session.
    Tracks the verification state, expiration time, and who verified it.
    """
    STATE_CHOICES = [
        ("valid", "valid"),
        ("incomplete", "incomplete"),
        ("invalid", "invalid")
    ]
    
    operation_session = models.OneToOneField('OperationSession', on_delete=models.CASCADE)
    state = models.CharField(max_length=10, choices=STATE_CHOICES)
    open_until = models.DateTimeField()
    verified_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Verification for Session {self.operation_session.id} - {self.state}"
