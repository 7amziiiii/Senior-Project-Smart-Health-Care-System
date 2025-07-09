from rest_framework import serializers
from django.contrib.auth.models import User
from ...models.user_profile import UserProfile


class AdminUserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'approval_status']


class AdminUserSerializer(serializers.ModelSerializer):
    profile = AdminUserProfileSerializer()
    role_display = serializers.CharField(source='profile.get_role_display', read_only=True)
    approval_status_display = serializers.CharField(source='profile.get_approval_status_display', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'profile', 'role_display', 'approval_status_display', 'is_active', 'date_joined'
        ]
        
    def update(self, instance, validated_data):
        # Extract profile data
        profile_data = validated_data.pop('profile', None)
        
        # Update User model fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        # Handle password separately (if provided)
        password = self.context.get('request').data.get('password', None) if self.context.get('request') else None
        if password:
            instance.set_password(password)
            
        # Save the user instance
        instance.save()
        
        # Update profile if data provided
        if profile_data and hasattr(instance, 'profile'):
            for attr, value in profile_data.items():
                setattr(instance.profile, attr, value)
                
            # If role is being set to admin, ensure is_staff is True
            if profile_data.get('role') == UserProfile.ADMIN:
                instance.is_staff = True
                instance.save(update_fields=['is_staff'])
            # If role is being changed from admin to something else, update is_staff
            elif instance.profile.role != UserProfile.ADMIN and instance.is_staff:
                instance.is_staff = False
                instance.save(update_fields=['is_staff'])
                
            # Save profile
            instance.profile.save()
            
        return instance
