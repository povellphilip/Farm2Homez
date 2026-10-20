import re

from django.conf import settings
from django.db import models


class VerificationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending review'
    VERIFIED = 'VERIFIED', 'Verified'
    REJECTED = 'REJECTED', 'Rejected'


class ProducerProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='producer_profile')
    farm_name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True)
    description = models.TextField(blank=True)

    address_line1 = models.CharField(max_length=200)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, db_index=True)
    postal_code = models.CharField(max_length=12)
    country = models.CharField(max_length=60, default='India')

    registration_number = models.CharField(
        max_length=80, blank=True, help_text='Business, FSSAI or farmer registration number, if any.'
    )
    verification_details = models.TextField(blank=True, help_text='Anything that helps admins verify the farm.')
    verification_status = models.CharField(
        max_length=10, choices=VerificationStatus.choices, default=VerificationStatus.PENDING, db_index=True
    )
    verification_note = models.TextField(blank=True, help_text='Admin note shown to the producer.')
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )

    # WhatsApp contact is shown publicly only when the producer opts in.
    whatsapp_number = models.CharField(max_length=20, blank=True)
    whatsapp_enabled = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['farm_name']

    def __str__(self):
        return self.farm_name

    @property
    def is_verified(self):
        return self.verification_status == VerificationStatus.VERIFIED

    @property
    def location(self):
        return ', '.join(part for part in [self.city, self.district, self.state] if part)

    @property
    def whatsapp_link(self):
        if not (self.whatsapp_enabled and self.whatsapp_number):
            return None
        return f'https://wa.me/{re.sub(r"[^0-9]", "", self.whatsapp_number)}'
