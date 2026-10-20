from django.conf import settings
from django.db import models
from django.db.models import Q


class Address(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=40, blank=True, help_text='e.g. Home, Office')
    recipient_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20)
    line1 = models.CharField(max_length=200)
    line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=12)
    country = models.CharField(max_length=60, default='India')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', '-updated_at']
        verbose_name_plural = 'addresses'
        constraints = [
            models.UniqueConstraint(fields=['user'], condition=Q(is_default=True), name='one_default_address_per_user'),
        ]

    def __str__(self):
        return f'{self.recipient_name}, {self.city}'


class FavoriteProduct(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorite_products')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'product'], name='uniq_favorite_product')]

    def __str__(self):
        return f'{self.user} likes {self.product}'


class FavoriteProducer(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorite_producers')
    producer = models.ForeignKey('producers.ProducerProfile', on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'producer'], name='uniq_favorite_producer')]

    def __str__(self):
        return f'{self.user} follows {self.producer}'
