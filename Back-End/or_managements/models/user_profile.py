from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User

class UserProfile(models.Model):
    """
    Extended user profile model that adds role information to the Django User model
    """
    # Define role choices
    NURSE = 'nurse'
    DOCTOR = 'doctor'
    MAINTENANCE = 'maintenance'
    ADMIN = 'admin'
    
    ROLE_CHOICES = [
        (NURSE, 'Nurse'),
        (DOCTOR, 'Doctor'),
        (MAINTENANCE, 'Maintenance'),
        (ADMIN, 'Admin'),
    ]
    
    # Define approval status choices
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    
    APPROVAL_CHOICES = [
        (PENDING, 'Pending Approval'),
        (APPROVED, 'Approved'),
        (REJECTED, 'Rejected'),
    ]
    
    # Link to the Django User model (using lazy reference)
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, related_name='profile')
    
    # Additional fields
    role = models.CharField(
        max_length=20, 
        choices=ROLE_CHOICES,
        default=NURSE,
        help_text='User role in the system'
    )
    
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default=PENDING,
        help_text='Approval status of the user account'
    )
    
    approved_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_profiles',
        help_text='Admin who approved this user'
    )
    
    approval_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()} ({self.get_approval_status_display()})"
    
    @property
    def is_approved(self):
        """Convenience method to check if user is approved"""
        return self.approval_status == self.APPROVED
        
    def save(self, *args, **kwargs):
        # Set is_staff=True for admin users
        if self.role == self.ADMIN and hasattr(self, 'user') and not self.user.is_staff:
            self.user.is_staff = True
            self.user.save(update_fields=['is_staff'])
            
        super().save(*args, **kwargs)


# Signals to automatically create/update user profile when User is saved
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a UserProfile for every new User"""
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Save the UserProfile when the User is saved"""
    if hasattr(instance, 'profile'):
        instance.profile.save()