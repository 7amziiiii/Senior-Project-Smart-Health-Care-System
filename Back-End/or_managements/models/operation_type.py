from django.db import models

# Example of canonical schema for required_instruments field
REQUIRED_SCHEMA_EXAMPLE = {
    "instruments": ["Scalpel", "Clamp"],
    "trays": ["Basic Tray"]
}

class OperationType(models.Model):
    name = models.CharField(max_length=100)
    required_instruments = models.JSONField(default=dict)
    """
    Stores the required instruments and trays for this operation type.
    Expected schema format:
    {
        "instruments": ["Scalpel", "Clamp"],
        "trays": ["Basic Tray"]
    }
    """
    
    def __str__(self):
        return self.name