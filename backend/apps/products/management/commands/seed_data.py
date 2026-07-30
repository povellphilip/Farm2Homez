from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.products.models import Product

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed Farm2Homez with test users and products.'

    def handle(self, *args, **options):
        admin, _ = User.objects.get_or_create(
            email='admin@farm2homez.com',
            defaults={
                'username': 'admin@farm2homez.com',
                'full_name': 'Farm2Homez Admin',
                'role': User.Role.ADMIN,
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
                'email_verified': True,
            },
        )
        admin.set_password('Admin@12345')
        admin.save()

        seller, _ = User.objects.get_or_create(
            email='seller@farm2homez.com',
            defaults={
                'username': 'seller@farm2homez.com',
                'farm_name': 'Green Valley Farms',
                'owner_name': 'Demo Seller',
                'full_name': 'Demo Seller',
                'phone_number': '+919876543210',
                'address': 'Demo Farm Road',
                'district': 'Wayanad',
                'state': 'Kerala',
                'role': User.Role.SELLER,
                'is_active': True,
                'email_verified': True,
                'seller_verified': True,
            },
        )
        seller.set_password('Seller@12345')
        seller.save()

        customer, _ = User.objects.get_or_create(
            email='customer@farm2homez.com',
            defaults={
                'username': 'customer@farm2homez.com',
                'full_name': 'Demo Customer',
                'phone_number': '+919999999999',
                'role': User.Role.CUSTOMER,
                'is_active': True,
                'email_verified': True,
            },
        )
        customer.set_password('Customer@12345')
        customer.save()

        products = [
            {
                'name': 'Avocado',
                'description': 'Fresh farm avocados from verified sellers.',
                'price': Decimal('120.00'),
                'stock': 100,
                'location': 'Wayanad, Kerala',
                'district': 'Wayanad',
                'state': 'Kerala',
                'organic': True,
                'images': ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
            },
            {
                'name': 'Coffee Powder',
                'description': 'Freshly ground plantation coffee powder.',
                'price': Decimal('250.00'),
                'stock': 50,
                'location': 'Coorg, Karnataka',
                'district': 'Kodagu',
                'state': 'Karnataka',
                'organic': False,
                'images': ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
            },
            {
                'name': 'Battery Sprayer',
                'description': 'Compact battery sprayer for small farms.',
                'price': Decimal('3200.00'),
                'stock': 15,
                'location': 'Kochi, Kerala',
                'district': 'Ernakulam',
                'state': 'Kerala',
                'organic': False,
                'images': ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
            },
        ]

        for product_data in products:
            product, _ = Product.objects.update_or_create(
                seller=seller,
                name=product_data['name'],
                defaults={**product_data, 'approved': True, 'active': True},
            )
            self.stdout.write(self.style.SUCCESS(f'Seeded product: {product.name}'))

        self.stdout.write(self.style.SUCCESS('Seed data complete.'))
