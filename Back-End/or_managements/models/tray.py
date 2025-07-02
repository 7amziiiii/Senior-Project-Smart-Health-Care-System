from django.db import models




class Tray(models.Model):
    name = models.CharField(max_length=100)
    number_of_instruments = models.IntegerField()
    tag = models.ForeignKey('RFIDTag', on_delete=models.SET_NULL, null=True)
    def __str__(self):
        return self.name

