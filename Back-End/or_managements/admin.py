from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group, Permission
from django.contrib.admin.sites import AdminSite

# Import models
from .models.user_profile import UserProfile

# Define inline admin for UserProfile
# class UserProfileInline(admin.StackedInline):
#     model = UserProfile
#     can_delete = False
#     verbose_name_plural = 'User Profile'

# # Define a new User admin that includes the UserProfile inline
# class UserAdmin(BaseUserAdmin):
#     inlines = (UserProfileInline,)
#     list_display = ('username', 'email', 'first_name', 'last_name', 'get_role', 'get_approval_status', 'is_staff')
#     list_filter = ('profile__role', 'profile__approval_status', 'is_staff')
    
#     def get_role(self, obj):
#         return obj.profile.get_role_display() if hasattr(obj, 'profile') else ''
#     get_role.short_description = 'Role'
    
#     def get_approval_status(self, obj):
#         return obj.profile.get_approval_status_display() if hasattr(obj, 'profile') else ''
#     get_approval_status.short_description = 'Approval Status'

# # Re-register UserAdmin
# admin.site.unregister(User)
# admin.site.register(User, UserAdmin)

# Register only the essential models you need in admin

# You can add more models as needed
