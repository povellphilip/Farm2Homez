from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'status', 'total_amount', 'district', 'state', 'created_at']
    list_filter = ['status', 'district', 'state', 'created_at']
    search_fields = ['customer__email', 'phone_number']
    inlines = [OrderItemInline]
