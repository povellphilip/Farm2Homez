from django.contrib import admin

from .models import Inquiry, InquiryReply


class ReplyInline(admin.TabularInline):
    model = InquiryReply
    extra = 0
    readonly_fields = ['author', 'author_role', 'message', 'created_at']


@admin.register(Inquiry)
class InquiryAdmin(admin.ModelAdmin):
    list_display = ['subject', 'name', 'producer', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['subject', 'name', 'email', 'message']
    inlines = [ReplyInline]
