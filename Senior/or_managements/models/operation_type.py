from django.db import models

class OperationType(models.Model):
    name = models.CharField(max_length=100)
    required_instruments = models.JSONField(default=dict)
    
    def __str__(self):
        return self.name