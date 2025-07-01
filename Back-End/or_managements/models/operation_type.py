from django.db import models

# Example of canonical schema for required_instruments field
REQUIRED_SCHEMA_EXAMPLE = {
    "instruments": {"Scalpel": 2, "Clamp": 1, "Forceps": 3},
    "trays": {"Basic Tray": 1, "Surgery Tray": 1}
}

class OperationType(models.Model):
    name = models.CharField(max_length=100)
    required_instruments = models.JSONField(default=dict)
    """
    Stores the required instruments and trays for this operation type,
    including the quantity required for each item.
    
    Expected schema format:
    {
        "instruments": {
            "Scalpel": 2,    # Instrument name: quantity required
            "Clamp": 1,
            "Forceps": 3
        },
        "trays": {
            "Basic Tray": 1,  # Tray name: quantity required
            "Surgery Tray": 1
        }
    }
    """
    
    def __str__(self):
        return self.name