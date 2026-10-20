from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['product', 'consumer', 'rating', 'created_at']
    list_filter = ['rating']
    search_fields = ['product__name', 'consumer__email', 'comment']
