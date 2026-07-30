from django.conf import settings
from django.db import models

from .classifier import classify_product


class Product(models.Model):
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=180)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    images = models.JSONField(default=list, blank=True)
    location = models.CharField(max_length=180)
    district = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    organic = models.BooleanField(default=False)

    category = models.CharField(max_length=120, editable=False)
    subcategory = models.CharField(max_length=120, editable=False)
    flagged_for_admin_review = models.BooleanField(default=False)
    approved = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        self.category, self.subcategory, self.flagged_for_admin_review = classify_product(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
