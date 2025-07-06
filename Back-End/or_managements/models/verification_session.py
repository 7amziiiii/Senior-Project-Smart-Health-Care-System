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
                "quantity": <int>,    # Quantity found/used
                "ids": [<id>, ...]    # IDs of specific instruments used
            }
        },
        "trays": { similar structure }
    }
    
    missing_items: {
        "instruments": {
            "ItemName": {
                "quantity": <int>,    # Quantity still missing
                "required": <int>     # Total quantity required
            }
        },
        "trays": { similar structure }
    }
    
    extra_items: {
        "instruments": {
            "ItemName": {
                "quantity": <int>,    # Quantity of extra items
                "ids": [<id>, ...]    # IDs of extra items 
            }
        },
        "trays": { similar structure }
    }
    
    available_items: {
        "instruments": {
            "ItemName": {
                "quantity": <int>,    # Quantity available
                "ids": [<id>, ...]    # IDs of available items
            }
        },
        "trays": { similar structure }
    }
    
    The service also formats data for frontend tabs:
    "tabs": {
        "present": { "count": <int>, "items": [{"name": <str>, "type": <str>, "quantity": <int>}, ...] },
        "missing": { "count": <int>, "items": [{"name": <str>, "type": <str>, "quantity": <int>}, ...] },
        "extra": { "count": <int>, "items": [{"name": <str>, "type": <str>, "quantity": <int>}, ...] },
        "required": { "count": <int>, "items": [{"name": <str>, "type": <str>, "quantity": <int>}, ...] }
    }
    """
    STATE_CHOICES = [
        ("valid", "valid"),
        ("incomplete", "incomplete"),
        ("invalid", "invalid"),
        ("failed", "failed")
    ]
    
    operation_session = models.OneToOneField('OperationSession', on_delete=models.CASCADE)
    state = models.CharField(max_length=10, choices=STATE_CHOICES)
    open_until = models.DateTimeField()
    verified_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Track instruments and trays that were found and used in the operation
    used_items_dict = JSONField(default=dict, blank=True, help_text="Instruments and trays used in the operation")
    
    # Track instruments and trays that were required but not found
    missing_items_dict = JSONField(default=dict, blank=True, help_text="Required instruments and trays that were not found")
    
    # Track instruments and trays that were found but not part of the requirement (extras)
    extra_items_dict = JSONField(default=dict, blank=True, help_text="Extra instruments and trays found in the room")
    
    # Track instruments and trays that were found but not used in the operation
    available_items_dict = JSONField(default=dict, blank=True, help_text="Instruments and trays that were found but not used")
    
    # Last updated timestamp for real-time tracking
    last_updated = models.DateTimeField(auto_now=True)
   
    def __str__(self):
        return f"Verification for Session {self.operation_session.id} - {self.state}"
