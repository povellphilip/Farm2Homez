from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'seller', 'category', 'subcategory', 'price', 'stock', 'approved', 'flagged_for_admin_review']
    list_filter = ['category', 'subcategory', 'approved', 'flagged_for_admin_review', 'organic', 'state', 'district']
    search_fields = ['name', 'description', 'seller__email', 'seller__farm_name']
    readonly_fields = ['category', 'subcategory', 'flagged_for_admin_review', 'created_at', 'updated_at']
