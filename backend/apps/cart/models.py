from django.conf import settings
from django.db import models
from django.db.models import Q


class CartItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart_items')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='cart_items')
    quantity = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at', 'id']
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='uniq_cart_item_per_product'),
            models.CheckConstraint(condition=Q(quantity__gte=1), name='cart_quantity_positive'),
        ]

    def __str__(self):
        return f'{self.quantity} x {self.product}'
