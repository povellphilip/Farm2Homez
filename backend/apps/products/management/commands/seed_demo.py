from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import Role, User
from apps.core.utils import unique_slug
from apps.producers.models import ProducerProfile, VerificationStatus
from apps.products import services as product_services
from apps.products.catalog_data import install_default_categories
from apps.products.models import Category, ModerationStatus, Product, ProductStatus

DEMO_PASSWORD = 'FarmDemo2026'
IMAGE_DIR = Path(settings.BASE_DIR) / 'demo_data' / 'images'

PRODUCERS = [
    {
        'email': 'greenvalley@demo.farm2home.example',
        'full_name': 'Anitha Joseph',
        'phone_number': '+919847000101',
        'farm': {
            'farm_name': 'Green Valley Farms',
            'description': 'A family farm in the Wayanad hills growing tropical fruit and vegetables without synthetic pesticides since 1998.',
            'address_line1': 'Pozhuthana Road', 'city': 'Vythiri', 'district': 'Wayanad', 'state': 'Kerala', 'postal_code': '673576',
            'whatsapp_number': '+919847000101', 'whatsapp_enabled': True,
        },
        'products': [
            ('Hass Avocado', 'fruits', 'tropical-fruits', '320.00', 'kg', 60, 1, 'Seasonal Hass avocados, hand-picked and ripened on the tree.', True, 'Picked to order between May and August.'),
            ('Rambutan', 'fruits', 'exotic-fruits', '260.00', 'kg', 40, 1, 'Sweet, juicy rambutan harvested the morning it ships.', True, 'Peak season June to August.'),
            ('Nendran Banana', 'fruits', 'tropical-fruits', '75.00', 'kg', 200, 2, 'Kerala Nendran bananas, ideal for chips or eating ripe.', False, ''),
            ('Organic Tomatoes', 'vegetables', 'everyday-vegetables', '48.00', 'kg', 150, 1, 'Vine-ripened tomatoes grown in raised beds.', False, 'Harvested twice a week.'),
            ('Bush Beans', 'vegetables', 'everyday-vegetables', '90.00', 'kg', 80, 1, 'Tender green beans picked young.', False, ''),
        ],
    },
    {
        'email': 'malnad@demo.farm2home.example',
        'full_name': 'Ravi Gowda',
        'phone_number': '+919845000202',
        'farm': {
            'farm_name': 'Malnad Estates',
            'description': 'Shade-grown arabica coffee and spices from a third-generation estate in Chikkamagaluru.',
            'address_line1': 'Mullayanagiri Road', 'city': 'Chikkamagaluru', 'district': 'Chikkamagaluru', 'state': 'Karnataka', 'postal_code': '577101',
        },
        'products': [
            ('Arabica Coffee Beans', 'plantation-crops', 'coffee', '640.00', 'kg', 90, 1, 'Medium roast estate arabica with notes of jaggery and orange peel.', False, 'Roasted weekly in small batches.'),
            ('Filter Coffee Powder', 'plantation-crops', 'coffee', '380.00', 'pack', 120, 1, '500 g pack, 80:20 coffee-chicory blend, ground for South Indian filters.', False, ''),
            ('Black Pepper', 'plantation-crops', 'spices', '780.00', 'kg', 70, 1, 'Sun-dried Malabar black pepper, bold and aromatic.', False, 'Harvest of January 2026.'),
            ('Green Cardamom', 'plantation-crops', 'spices', '2400.00', 'kg', 25, 1, '8 mm bold green cardamom pods.', False, ''),
        ],
    },
    {
        'email': 'nilgiribees@demo.farm2home.example',
        'full_name': 'Lakshmi Raman',
        'phone_number': '+919443000303',
        'farm': {
            'farm_name': 'Nilgiri Bee Collective',
            'description': 'A collective of tribal beekeepers harvesting wild and forest honey in the Nilgiri biosphere.',
            'address_line1': 'Kotagiri Main Road', 'city': 'Kotagiri', 'district': 'The Nilgiris', 'state': 'Tamil Nadu', 'postal_code': '643217',
            'whatsapp_number': '+919443000303', 'whatsapp_enabled': True,
        },
        'products': [
            ('Wild Forest Honey', 'honey-bee-products', 'honey', '650.00', 'pack', 100, 1, '500 g jar of raw, unfiltered multi-flora forest honey.', True, 'Collected April to June.'),
            ('Stingless Bee Honey', 'honey-bee-products', 'honey', '1400.00', 'pack', 30, 1, '250 g jar of rare stingless bee honey, tangy and medicinal.', True, ''),
            ('Pure Beeswax Block', 'honey-bee-products', 'beeswax-propolis', '220.00', 'piece', 50, 2, '200 g block of filtered beeswax for cosmetics and crafts.', False, ''),
        ],
    },
    {
        'email': 'sunrise@demo.farm2home.example',
        'full_name': 'Prakash Patil',
        'phone_number': '+919822000404',
        'farm': {
            'farm_name': 'Sunrise Pasture Farm',
            'description': 'Free-range poultry and a small Gir cow herd on open pasture outside Pune.',
            'address_line1': 'Mulshi Road', 'city': 'Paud', 'district': 'Pune', 'state': 'Maharashtra', 'postal_code': '412108',
        },
        'products': [
            ('Free-Range Country Eggs', 'livestock-products', 'eggs', '144.00', 'dozen', 80, 1, 'Eggs from hens that roam on pasture all day.', False, 'Collected daily.'),
            ('A2 Gir Cow Ghee', 'livestock-products', 'dairy', '1100.00', 'pack', 40, 1, '500 ml jar of bilona-churned A2 ghee.', False, ''),
            ('Fresh Paneer', 'livestock-products', 'dairy', '420.00', 'kg', 20, 1, 'Soft paneer made the same morning it ships.', False, 'Made fresh on order days.'),
        ],
    },
]

PENDING_PRODUCER = {
    'email': 'newfarm@demo.farm2home.example',
    'full_name': 'Meera Nair',
    'phone_number': '+919847000505',
    'farm': {
        'farm_name': 'Kuttanad Paddy & Greens',
        'description': 'Backwater farm growing leafy greens and vegetables, awaiting verification.',
        'address_line1': 'Kainakary', 'city': 'Alappuzha', 'district': 'Alappuzha', 'state': 'Kerala', 'postal_code': '688501',
        'registration_number': 'KL-AGRI-2026-0412',
    },
}

CONSUMERS = [
    ('asha@demo.farm2home.example', 'Asha Menon', '+919900000111'),
    ('vikram@demo.farm2home.example', 'Vikram Shah', '+919900000222'),
]


class Command(BaseCommand):
    help = f'Load demo producers, consumers and products for local development. All demo accounts use the password {DEMO_PASSWORD}.'

    def add_arguments(self, parser):
        parser.add_argument('--with-admin', action='store_true', help='Also create admin@demo.farm2home.example.')

    @transaction.atomic
    def handle(self, *args, **options):
        if settings.IS_PRODUCTION:
            raise CommandError('seed_demo is for development only and refuses to run in production.')

        install_default_categories(Category)
        categories = {category.slug: category for category in Category.objects.all()}

        for entry in PRODUCERS:
            profile = self._producer(entry, VerificationStatus.VERIFIED)
            for name, category, subcategory, price, unit, stock, moq, description, seasonal, harvest in entry['products']:
                fields = {
                    'category': categories[category],
                    'subcategory': categories[subcategory],
                    'description': description,
                    'price': Decimal(price),
                    'unit': unit,
                    'stock_quantity': stock,
                    'min_order_quantity': moq,
                    'origin': f'{profile.city}, {profile.state}',
                    'harvest_info': harvest,
                    'is_seasonal': seasonal,
                    'is_organic': 'Organic' in name or profile.farm_name == 'Green Valley Farms',
                    'status': ProductStatus.PUBLISHED,
                    'moderation_status': ModerationStatus.APPROVED,
                    'published_at': timezone.now(),
                }
                product, _ = Product.objects.update_or_create(
                    producer=profile,
                    name=name,
                    defaults=fields,
                    create_defaults={**fields, 'slug': unique_slug(Product, f'{name} {profile.farm_name}', max_length=180)},
                )
                self._attach_photo(product)
        self._producer(PENDING_PRODUCER, VerificationStatus.PENDING)

        for email, name, phone in CONSUMERS:
            self._user(email, name, phone, Role.CONSUMER)

        if options['with_admin']:
            self._user('admin@demo.farm2home.example', 'Demo Admin', '', Role.ADMIN)

        self.stdout.write(self.style.SUCCESS(
            f'Demo data ready: {Product.objects.count()} products, {ProducerProfile.objects.count()} producers. '
            f'Password for every demo account: {DEMO_PASSWORD}'
        ))

    def _attach_photo(self, product):
        """Attach the bundled demo photo (see demo_data/CREDITS.md) through the normal image pipeline."""
        photo = IMAGE_DIR / f'{slugify(product.name)}.jpg'
        if product.images.exists() or not photo.exists():
            return
        product_services.add_image(product, ContentFile(photo.read_bytes(), name=photo.name), product.name)

    def _user(self, email, full_name, phone, role):
        user, created = User.objects.get_or_create(
            email=email, defaults={'full_name': full_name, 'phone_number': phone, 'role': role, 'email_verified': True}
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save(update_fields=['password'])
        return user

    def _producer(self, entry, verification_status):
        user = self._user(entry['email'], entry['full_name'], entry['phone_number'], Role.PRODUCER)
        farm = entry['farm']
        profile, created = ProducerProfile.objects.get_or_create(
            user=user,
            defaults={**farm, 'slug': unique_slug(ProducerProfile, farm['farm_name']), 'verification_status': verification_status},
        )
        if created and verification_status == VerificationStatus.VERIFIED:
            profile.verified_at = timezone.now()
            profile.save(update_fields=['verified_at'])
        return profile
