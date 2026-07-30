from django.contrib import admin

from .models import CartItem, WishlistItem


admin.site.register(CartItem)
admin.site.register(WishlistItem)
