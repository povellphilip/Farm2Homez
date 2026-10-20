from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['order', 'provider', 'status', 'amount', 'is_test', 'created_at']
    list_filter = ['provider', 'status', 'is_test']
    search_fields = ['order__number', 'reference']
