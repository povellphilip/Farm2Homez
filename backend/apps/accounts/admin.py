from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class Farm2HomeUserAdmin(UserAdmin):
    ordering = ['-date_joined']
    list_display = ['email', 'full_name', 'role', 'email_verified', 'is_active', 'date_joined']
    list_filter = ['role', 'email_verified', 'is_active', 'is_staff']
    search_fields = ['email', 'full_name', 'phone_number']
    readonly_fields = ['date_joined', 'last_login', 'updated_at']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('full_name', 'phone_number', 'role', 'email_verified')}),
        ('Status', {'fields': ('is_active', 'suspended_at', 'suspension_reason')}),
        ('Django admin access', {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('date_joined', 'last_login', 'updated_at')}),
    )
    add_fieldsets = ((None, {'classes': ('wide',), 'fields': ('email', 'full_name', 'role', 'password1', 'password2')}),)
