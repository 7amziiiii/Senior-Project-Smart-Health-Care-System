from rest_framework import serializers
from django.contrib.auth.models import User
from ...models.user_profile import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role']


class UserWithProfileSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    role = serializers.CharField(source='profile.get_role_display', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile', 'role', 'is_active', 'date_joined']
        read_only_fields = ['is_active', 'date_joined']
