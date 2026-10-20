import io
import itertools
import re
from decimal import Decimal

import pytest
from django.core import mail
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.core.utils import unique_slug
from apps.producers.models import ProducerProfile, VerificationStatus
from apps.products.catalog_data import install_default_categories
from apps.products.models import Category, ModerationStatus, Product, ProductStatus

PASSWORD = 'Harvest2026x'
_counter = itertools.count(1)


@pytest.fixture(autouse=True)
def _isolated_media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / 'media'


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def categories(db):
    install_default_categories(Category)
    return {category.slug: category for category in Category.objects.all()}


def make_user(role=Role.CONSUMER, *, email=None, verified=True, active=True, **extra):
    n = next(_counter)
    return User.objects.create_user(
        email=email or f'{role.lower()}{n}@example.com',
        password=PASSWORD,
        full_name=extra.pop('full_name', f'Test {role.title()} {n}'),
        phone_number=extra.pop('phone_number', f'+9198000{n:05d}'),
        role=role,
        email_verified=verified,
        is_active=active,
        **extra,
    )


def make_producer(*, verified=True, farm_name=None, **user_extra):
    user = make_user(Role.PRODUCER, **user_extra)
    name = farm_name or f'Farm {user.pk}'
    ProducerProfile.objects.create(
        user=user,
        farm_name=name,
        slug=unique_slug(ProducerProfile, name),
        address_line1='1 Farm Road',
        city='Kalpetta',
        district='Wayanad',
        state='Kerala',
        postal_code='673121',
        verification_status=VerificationStatus.VERIFIED if verified else VerificationStatus.PENDING,
        verified_at=timezone.now() if verified else None,
    )
    return user


def make_product(producer_user, category, *, name=None, price='100.00', stock=50, moq=1, published=True, **extra):
    name = name or f'Product {next(_counter)}'
    profile = producer_user.producer_profile
    return Product.objects.create(
        producer=profile,
        category=category,
        name=name,
        slug=unique_slug(Product, f'{name} {profile.farm_name}'),
        description=extra.pop('description', 'Freshly harvested.'),
        price=Decimal(price),
        unit=extra.pop('unit', 'kg'),
        stock_quantity=stock,
        min_order_quantity=moq,
        origin='Wayanad, Kerala',
        status=ProductStatus.PUBLISHED if published else ProductStatus.DRAFT,
        moderation_status=extra.pop('moderation_status', ModerationStatus.APPROVED),
        published_at=timezone.now() if published else None,
        **extra,
    )


@pytest.fixture
def consumer(db):
    return make_user(Role.CONSUMER)


@pytest.fixture
def producer(db):
    return make_producer()


@pytest.fixture
def admin_user(db):
    return make_user(Role.ADMIN)


@pytest.fixture
def product(producer, categories):
    return make_product(producer, categories['fruits'], name='Hass Avocado', price='320.00', stock=10)


def as_user(user):
    """Authenticated client for a fresh copy of `user`, like a real request would load."""
    client = APIClient()
    client.force_authenticate(User.objects.get(pk=user.pk))
    return client


def last_code(email):
    """Pull the most recent 6-digit code emailed to `email`."""
    for message in reversed(mail.outbox):
        if email in message.to:
            match = re.search(r'\b(\d{6})\b', message.body)
            if match:
                return match.group(1)
    raise AssertionError(f'No code emailed to {email}')


def image_file(fmt='JPEG', size=(64, 48), name='photo.jpg', exif_gps=False):
    buffer = io.BytesIO()
    image = Image.new('RGB', size, (34, 120, 60))
    kwargs = {}
    if exif_gps:
        exif = Image.Exif()
        exif[0x010F] = 'TestCamera'  # Make
        kwargs['exif'] = exif.tobytes()
    image.save(buffer, fmt, **kwargs)
    buffer.seek(0)
    buffer.name = name
    return buffer
