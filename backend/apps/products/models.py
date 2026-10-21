import uuid
from decimal import Decimal
from pathlib import PurePath

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.producers.models import ProducerProfile, VerificationStatus


class Category(models.Model):
    """Two-level taxonomy: top-level categories with optional subcategories."""

    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=90, unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.PROTECT, related_name='children')
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'name']
        verbose_name_plural = 'categories'
        constraints = [
            models.UniqueConstraint(fields=['parent', 'name'], name='uniq_category_name_per_parent'),
            models.UniqueConstraint(fields=['name'], condition=Q(parent__isnull=True), name='uniq_top_level_category_name'),
        ]

    def __str__(self):
        return f'{self.parent.name} / {self.name}' if self.parent_id else self.name


class Unit(models.TextChoices):
    KG = 'kg', 'Kilogram'
    GRAM = 'g', 'Gram'
    LITRE = 'litre', 'Litre'
    ML = 'ml', 'Millilitre'
    DOZEN = 'dozen', 'Dozen'
    PIECE = 'piece', 'Piece'
    BUNCH = 'bunch', 'Bunch'
    PACK = 'pack', 'Pack'
    BOX = 'box', 'Box'


class ProductStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PUBLISHED = 'PUBLISHED', 'Published'
    UNPUBLISHED = 'UNPUBLISHED', 'Unpublished'


class ModerationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending review'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class ProductQuerySet(models.QuerySet):
    def public(self):
        """Listings visible in the marketplace."""
        qs = self.filter(
            status=ProductStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            producer__user__is_active=True,
            category__is_active=True,
        )
        if settings.PRODUCER_VERIFICATION_REQUIRED:
            qs = qs.filter(producer__verification_status=VerificationStatus.VERIFIED)
        return qs


class Product(models.Model):
    producer = models.ForeignKey(ProducerProfile, on_delete=models.CASCADE, related_name='products')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    subcategory = models.ForeignKey(Category, null=True, blank=True, on_delete=models.PROTECT, related_name='subcategory_products')

    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, default='INR')
    unit = models.CharField(max_length=10, choices=Unit.choices)
    stock_quantity = models.PositiveIntegerField(default=0, help_text='Units available to sell.')
    min_order_quantity = models.PositiveIntegerField(default=1)

    origin = models.CharField(max_length=160, help_text='Where it was grown or produced.')
    harvest_info = models.CharField(max_length=255, blank=True)
    is_seasonal = models.BooleanField(default=False)
    available_from = models.DateField(null=True, blank=True)
    available_until = models.DateField(null=True, blank=True)
    is_available = models.BooleanField(default=True, help_text='Untick to mark as currently unavailable.')
    is_organic = models.BooleanField(default=False)

    status = models.CharField(max_length=12, choices=ProductStatus.choices, default=ProductStatus.DRAFT)
    moderation_status = models.CharField(max_length=10, choices=ModerationStatus.choices, default=ModerationStatus.APPROVED)
    moderation_note = models.TextField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(condition=Q(price__gt=0), name='product_price_positive'),
            models.CheckConstraint(condition=Q(min_order_quantity__gte=1), name='product_moq_at_least_one'),
            models.CheckConstraint(
                condition=Q(available_from__isnull=True) | Q(available_until__isnull=True) | Q(available_until__gte=models.F('available_from')),
                name='product_availability_window_valid',
            ),
        ]
        indexes = [
            models.Index(fields=['status', 'moderation_status']),
            models.Index(fields=['price']),
            models.Index(fields=['published_at']),
        ]

    def __str__(self):
        return self.name

    @property
    def is_public(self):
        verified_ok = self.producer.is_verified or not settings.PRODUCER_VERIFICATION_REQUIRED
        return (
            self.status == ProductStatus.PUBLISHED
            and self.moderation_status == ModerationStatus.APPROVED
            and verified_ok
            and self.producer.user.is_active
            and self.category.is_active
        )

    @property
    def in_season(self):
        today = timezone.localdate()
        if self.available_from and today < self.available_from:
            return False
        if self.available_until and today > self.available_until:
            return False
        return True

    @property
    def is_purchasable(self):
        return self.is_public and self.is_available and self.in_season and self.stock_quantity >= self.min_order_quantity


def product_image_path(instance, filename):
    """Server-generated object key; the uploaded filename is never trusted."""
    extension = PurePath(filename).suffix.lower().lstrip('.') or 'jpg'
    return f'products/{instance.product_id}/{uuid.uuid4().hex}.{extension}'


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to=product_image_path, max_length=255)
    alt_text = models.CharField(max_length=200, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=40)
    size_bytes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position', 'id']

    def __str__(self):
        return f'{self.product} image {self.position}'


class PendingUpload(models.Model):
    """A short-lived permission for a producer's browser to upload one image straight to S3.
    The object is validated and re-encoded when the upload is confirmed."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='pending_uploads')
    key = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=40)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.key
