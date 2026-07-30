from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class Farm2HomezUserAdmin(UserAdmin):
    list_display = ['email', 'role', 'email_verified', 'seller_verified', 'is_staff']
    list_filter = ['role', 'email_verified', 'seller_verified', 'is_staff']
    search_fields = ['email', 'full_name', 'farm_name', 'owner_name', 'phone_number']
    fieldsets = UserAdmin.fieldsets + (
        (
            'Farm 2 Homez',
            {
                'fields': (
                    'full_name',
                    'phone_number',
                    'role',
                    'farm_name',
                    'owner_name',
                    'address',
                    'district',
                    'state',
                    'email_verified',
                    'seller_verified',
                )
            },
        ),
    )
