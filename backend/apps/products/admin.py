from django.contrib import admin

from .models import Category, Product, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'slug', 'position', 'is_active']
    list_filter = ['is_active', 'parent']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    readonly_fields = ['width', 'height', 'content_type', 'size_bytes']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'producer', 'category', 'price', 'unit', 'stock_quantity', 'status', 'moderation_status']
    list_filter = ['status', 'moderation_status', 'category', 'is_available']
    search_fields = ['name', 'slug', 'producer__farm_name']
    readonly_fields = ['created_at', 'updated_at', 'published_at']
    inlines = [ProductImageInline]
