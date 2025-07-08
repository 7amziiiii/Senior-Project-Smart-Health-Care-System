from django.db import models

class LargeEquipment(models.Model):
    name = models.CharField(max_length=100)
    equipment_id = models.CharField(max_length=50, unique=True)
    rfid_tag = models.OneToOneField('RFIDTag', on_delete=models.SET_NULL, null=True)
    equipment_type = models.CharField(max_length=100)  # e.g., "C-Arm", "Microscope"
    location = models.CharField(max_length=100, null=True, blank=True)  # e.g., "OR Room 3", "Storage B"
    
    status = models.CharField(max_length=50, choices=[
        ('available', 'Available'),
        ('in_use', 'In Use'), 
        ('under_repair', 'Under Repair'),
        ('scheduled_maintenance', 'Scheduled Maintenance')
    ], default='available')
    notes = models.TextField(blank=True)
    
    # Maintenance tracking fields
    last_maintenance_date = models.DateTimeField(null=True, blank=True)
    next_maintenance_date = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.name} ({self.equipment_id}) - {self.get_status_display()}"