from django.contrib import admin

from .models import ContactSubmission


@admin.register(ContactSubmission)
class ContactSubmissionAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'company', 'phone', 'created_at']
    list_filter = ['created_at', 'company']
    search_fields = ['name', 'email', 'company', 'message', 'phone']
    readonly_fields = ['created_at']
