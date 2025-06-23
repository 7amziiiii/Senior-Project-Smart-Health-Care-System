from django.db import models

class Instrument(models.Model):
    rfid_tag = models.OneToOneField('RFIDTag', on_delete=models.SET_NULL, related_name='tag', null=True,)
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=100, choices=[
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('missing', 'Missing'),
        ('under_sterilization', 'Under Sterilization')
    ])
    tray = models.ForeignKey('Tray', on_delete=models.SET_NULL, null=True)  
    def __str__(self):
        return f"{self.name} - {self.get_status_display()}"