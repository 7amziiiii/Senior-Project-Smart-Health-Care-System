from django.db import models
from django.utils import timezone


class RFIDTag(models.Model):
    tag_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=50, choices=[
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('maintenance', 'Maintenance'),
    ], default='active')
    last_detected_by = models.ForeignKey('RFID_Reader', on_delete=models.SET_NULL, null=True, blank=True, related_name='detected_tags')
    last_detection_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_known_location = models.CharField(max_length=100, null=True, blank=True)

    def update_from_reader(self, reader):
        """Update tag location data based on reader detection"""
        self.last_detected_by = reader
        self.last_detection_time = timezone.now()
        self.last_known_location = reader.location
        self.save()

    def __str__(self):
        return f"{self.name} ({self.tag_id})"