from django.conf import settings
from django.db import models


class InquiryStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    ANSWERED = 'ANSWERED', 'Answered'
    CLOSED = 'CLOSED', 'Closed'


class Inquiry(models.Model):
    """A question sent to a producer, or to the Farm2Home team when `producer` is empty."""

    producer = models.ForeignKey('producers.ProducerProfile', null=True, blank=True, on_delete=models.CASCADE, related_name='inquiries')
    product = models.ForeignKey('products.Product', null=True, blank=True, on_delete=models.SET_NULL, related_name='inquiries')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='sent_inquiries')
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    status = models.CharField(max_length=10, choices=InquiryStatus.choices, default=InquiryStatus.OPEN, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'inquiries'

    def __str__(self):
        return self.subject


class InquiryReply(models.Model):
    inquiry = models.ForeignKey(Inquiry, on_delete=models.CASCADE, related_name='replies')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    author_role = models.CharField(max_length=10)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        verbose_name_plural = 'inquiry replies'

    def __str__(self):
        return f'Reply to {self.inquiry}'
