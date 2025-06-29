from django.db import models


class RFID_Reader(models.Model):
    location = models.CharField(max_length=100)
    last_scan_time = models.DateTimeField()
    port = models.IntegerField()
    baud_rate = models.IntegerField()
    class Meta: 
        ordering = ["last_scan_time"]

    def __str__(self):
        return f"{self.location} ({self.last_scan_time})"
