from django.contrib import admin

from .models import EmailLog, WhatsAppLog


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['subject', 'status', 'created_at', 'updated_at']
    list_filter = ['status', 'created_at']
    search_fields = ['subject', 'error_message']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WhatsAppLog)
class WhatsAppLogAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'provider', 'status', 'created_at']
    list_filter = ['provider', 'status', 'created_at']
    search_fields = ['name', 'phone', 'message', 'provider_message_id']
    readonly_fields = ['created_at', 'updated_at']
