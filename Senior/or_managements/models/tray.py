from django.db import models




class Tray(models.Model):
    name = models.CharField(max_length=100)
    number_of_instruments = models.IntegerField()
    
    def __str__(self):
        return self.name
