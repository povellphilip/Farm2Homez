from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        SELLER = 'seller', 'Seller'
        ADMIN = 'admin', 'Admin'

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)

    farm_name = models.CharField(max_length=150, blank=True)
    owner_name = models.CharField(max_length=150, blank=True)
    address = models.TextField(blank=True)
    district = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    seller_verified = models.BooleanField(default=False)

    email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def save(self, *args, **kwargs):
        if self.email and not self.username:
            self.username = self.email
        if self.is_superuser or self.is_staff:
            self.role = self.Role.ADMIN
            self.email_verified = True
        super().save(*args, **kwargs)
