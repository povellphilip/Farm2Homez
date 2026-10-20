"""Product listing business rules: publishing, moderation, deletion and images."""
import io

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError

from apps.core import audit
from apps.core.exceptions import Conflict, ServiceError
from apps.core.notifications import send_email
from apps.core.utils import unique_slug

from .models import ModerationStatus, Product, ProductImage, ProductStatus

ALLOWED_IMAGE_FORMATS = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}
MAX_IMAGE_PIXELS = 40_000_000  # reject decompression bombs
MAX_IMAGE_EDGE = 2000  # longest side after resizing


def create_product(producer, data):
    product = Product(producer=producer, currency=settings.CURRENCY, **data)
    product.moderation_status = ModerationStatus.PENDING if settings.PRODUCT_PREMODERATION else ModerationStatus.APPROVED
    product.slug = unique_slug(Product, f'{product.name} {producer.farm_name}', max_length=180)
    product.save()
    return product


def update_product(product, data):
    for field, value in data.items():
        setattr(product, field, value)
    product.save()
    return product


def _ensure_can_publish(product):
    producer = product.producer
    if settings.PRODUCER_VERIFICATION_REQUIRED and not producer.is_verified:
        raise ServiceError(
            'Your farm must be verified by an administrator before listings can be published.',
            code='producer_not_verified',
            status_code=403,
        )


@transaction.atomic
def publish(product):
    _ensure_can_publish(product)
    product.status = ProductStatus.PUBLISHED
    product.published_at = product.published_at or timezone.now()
    if product.moderation_status == ModerationStatus.REJECTED:
        # A rejected listing goes back to review; republishing cannot bypass moderation.
        product.moderation_status = ModerationStatus.PENDING
    product.save(update_fields=['status', 'published_at', 'moderation_status', 'updated_at'])
    return product


def unpublish(product):
    product.status = ProductStatus.UNPUBLISHED
    product.save(update_fields=['status', 'updated_at'])
    return product


@transaction.atomic
def delete_product(product):
    from apps.orders.models import TERMINAL_STATUSES, OrderItem

    open_items = OrderItem.objects.filter(product=product).exclude(producer_order__status__in=TERMINAL_STATUSES)
    if open_items.exists():
        raise Conflict(
            'This product is part of orders that are still in progress. Unpublish it instead, '
            'or delete it after those orders are completed.',
            code='product_has_open_orders',
        )
    files = [image.image.name for image in product.images.all()]
    storage = ProductImage._meta.get_field('image').storage
    product.delete()
    transaction.on_commit(lambda: [storage.delete(name) for name in files])


@transaction.atomic
def moderate(product, *, decision, note, actor, request=None):
    if decision not in (ModerationStatus.APPROVED, ModerationStatus.REJECTED):
        raise ServiceError('Decision must be APPROVED or REJECTED.', code='invalid_decision')
    if decision == ModerationStatus.REJECTED and not note.strip():
        raise ServiceError('Give a reason so the producer can fix the listing.', code='note_required', errors={'note': ['A reason is required.']})
    previous = product.moderation_status
    product.moderation_status = decision
    product.moderation_note = note.strip()
    product.save(update_fields=['moderation_status', 'moderation_note', 'updated_at'])
    audit.record(
        f'product.{decision.lower()}',
        actor=actor,
        target=product,
        metadata={'previous': previous, 'note': product.moderation_note},
        request=request,
    )
    if decision == ModerationStatus.REJECTED:
        send_email(
            f'Listing needs changes: {product.name}',
            f'Hi {product.producer.user.full_name},\n\nYour listing "{product.name}" was removed from the marketplace '
            f'by a moderator.\n\nReason: {product.moderation_note}\n\nEdit the listing and publish it again to request a new review.\n',
            [product.producer.user.email],
        )
    return product


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------
def _process_image(upload):
    if upload.size > settings.MAX_IMAGE_UPLOAD_BYTES:
        limit_mb = settings.MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)
        raise ServiceError(f'Images must be {limit_mb} MB or smaller.', code='image_too_large')
    try:
        upload.seek(0)
        with Image.open(upload) as probe:
            probe.verify()
        upload.seek(0)
        image = Image.open(upload)
        image_format = image.format
        if image_format not in ALLOWED_IMAGE_FORMATS:
            raise ServiceError('Upload a JPEG, PNG or WebP image.', code='image_type')
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise ServiceError('This image is too large in dimensions.', code='image_dimensions')
        image = ImageOps.exif_transpose(image)
        image.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
    except ServiceError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ServiceError('This file is not a valid image.', code='image_invalid') from exc

    # Re-encoding drops EXIF metadata (including GPS location) from the stored file.
    buffer = io.BytesIO()
    if image_format == 'JPEG':
        image.convert('RGB').save(buffer, 'JPEG', quality=85, optimize=True)
        extension = 'jpg'
    elif image_format == 'PNG':
        image.save(buffer, 'PNG', optimize=True)
        extension = 'png'
    else:
        image.save(buffer, 'WEBP', quality=85)
        extension = 'webp'
    return ContentFile(buffer.getvalue(), name=f'upload.{extension}'), image.width, image.height, ALLOWED_IMAGE_FORMATS[image_format]


@transaction.atomic
def add_image(product, upload, alt_text=''):
    # Lock the product row so concurrent uploads cannot exceed the image limit.
    Product.objects.select_for_update().filter(pk=product.pk).first()
    if product.images.count() >= settings.MAX_IMAGES_PER_PRODUCT:
        raise ServiceError(f'A product can have at most {settings.MAX_IMAGES_PER_PRODUCT} images.', code='image_limit')
    content, width, height, content_type = _process_image(upload)
    next_position = (product.images.aggregate(m=Max('position'))['m'] or -1) + 1
    image = ProductImage(
        product=product,
        alt_text=(alt_text or product.name)[:200],
        position=next_position,
        width=width,
        height=height,
        content_type=content_type,
        size_bytes=content.size,
    )
    image.image.save(content.name, content, save=False)
    image.save()
    return image


@transaction.atomic
def delete_image(image):
    name = image.image.name
    storage = image.image.storage
    image.delete()
    transaction.on_commit(lambda: storage.delete(name))


@transaction.atomic
def reorder_images(product, ordered_ids):
    images = {image.id: image for image in product.images.all()}
    if set(ordered_ids) != set(images):
        raise ServiceError('Provide every image id for this product exactly once.', code='invalid_order')
    for position, image_id in enumerate(ordered_ids):
        images[image_id].position = position
    ProductImage.objects.bulk_update(images.values(), ['position'])
