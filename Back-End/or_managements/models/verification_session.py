from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import JSONField

User = get_user_model()

class VerificationSession(models.Model):
    """
    Represents a verification session for an operation session.
    Tracks the verification state, expiration time, who verified it,
    and lists of used, missing, extra, and available instruments and trays.
    
    JSON fields store instrument/tray data in the following format:
    
    used_items: {
        "instruments": {
            "ItemName": {
                "required": <int>,     # Required quantity
                "used": <int>,         # Actually used quantity
                "ids": [<id>, ...]     # IDs of specific instruments used
            }
        },
        "trays": { similar structure }
    }
    
    missing_items: {
        "instruments": {
            "ItemName": {
                "required": <int>,     # Required quantity
                "missing": <int>       # Number still missing
            }
        },
        "trays": { similar structure }
    }
    
    extra_items: {
        "instruments": {
            "ItemName": [<id>, ...],   # IDs of extra items in room (beyond required or not required)
        },
        "trays": { similar structure }
    }
    
    available_items: {
        "instruments": {
            "ItemName": [<id>, ...],   # IDs of items outside room with same name as missing items
        },
        "trays": { similar structure }
    }
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
    
    # Track instruments and trays that were found and used in the operation
    used_items = JSONField(default=dict, blank=True, help_text="Instruments and trays used in the operation")
    
    # Track instruments and trays that were required but not found
    missing_items = JSONField(default=dict, blank=True, help_text="Required instruments and trays that were not found")
    
    # Track instruments and trays that were found but not used in the operation
    available_items = JSONField(default=dict, blank=True, help_text="Instruments and trays that were found but not used")
    
    # Track available instruments/trays with same names as missing ones (potential replacements)
    available_matches = JSONField(default=dict, blank=True, help_text="Available instruments/trays with same names as missing ones")
   
    def __str__(self):
        return f"Verification for Session {self.operation_session.id} - {self.state}"
