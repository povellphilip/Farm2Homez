from django.db import models


class EmailLog(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'

    contact = models.ForeignKey('contacts.ContactSubmission', on_delete=models.SET_NULL, null=True, blank=True)
    subject = models.CharField(max_length=255)
    recipients = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.subject} ({self.status})'


class WhatsAppLog(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'

    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    message = models.TextField()
    provider = models.CharField(max_length=30, default='twilio')
    provider_message_id = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.phone} ({self.status})'
