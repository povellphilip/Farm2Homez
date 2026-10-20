from django.contrib import admin

from .models import Order, OrderItem, OrderStatusEvent, ProducerOrder


class ProducerOrderInline(admin.TabularInline):
    model = ProducerOrder
    extra = 0
    fields = ['producer', 'status', 'subtotal', 'delivery_fee', 'total']
    readonly_fields = fields
    show_change_link = True


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['number', 'consumer', 'status', 'payment_method', 'total', 'created_at']
    list_filter = ['status', 'payment_method']
    search_fields = ['number', 'consumer__email', 'ship_name']
    readonly_fields = [f.name for f in Order._meta.fields]
    inlines = [ProducerOrderInline]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['product', 'product_name', 'unit', 'unit_price', 'quantity', 'line_total']


class StatusEventInline(admin.TabularInline):
    model = OrderStatusEvent
    extra = 0
    readonly_fields = ['from_status', 'to_status', 'actor', 'actor_role', 'note', 'created_at']


@admin.register(ProducerOrder)
class ProducerOrderAdmin(admin.ModelAdmin):
    list_display = ['order', 'producer', 'status', 'total', 'created_at']
    list_filter = ['status']
    search_fields = ['order__number', 'producer__farm_name']
    readonly_fields = [f.name for f in ProducerOrder._meta.fields]
    inlines = [OrderItemInline, StatusEventInline]
