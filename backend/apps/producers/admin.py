from django.contrib import admin

from .models import ProducerProfile


@admin.register(ProducerProfile)
class ProducerProfileAdmin(admin.ModelAdmin):
    list_display = ['farm_name', 'user', 'state', 'verification_status', 'created_at']
    list_filter = ['verification_status', 'state']
    search_fields = ['farm_name', 'user__email', 'city', 'district']
    readonly_fields = ['verified_at', 'verified_by', 'created_at', 'updated_at']
