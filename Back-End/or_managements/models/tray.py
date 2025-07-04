from django.db import models




class Tray(models.Model):
    name = models.CharField(max_length=100)
    number_of_instruments = models.IntegerField()
    tag = models.ForeignKey('RFIDTag', on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=100, choices=[
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('missing', 'Missing'),
        ('under_sterilization', 'Under Sterilization')
    ], default='available')
    def __str__(self):
        return self.name

