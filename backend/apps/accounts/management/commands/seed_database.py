from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the database with initial data for testing and development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin',
            action='store_true',
            help='Create admin user only',
        )
        parser.add_argument(
            '--users',
            type=int,
            default=10,
            help='Number of test users to create',
        )

    def handle(self, *args, **options):
        if options['admin']:
            self.create_admin_user()
        else:
            self.create_admin_user()
            self.create_test_users(options['users'])

    def create_admin_user(self):
        """Create a superuser admin account"""
        admin_email = 'admin@farm2homez.com'
        
        if User.objects.filter(email=admin_email).exists():
            self.stdout.write(self.style.WARNING(f'Admin user {admin_email} already exists'))
            return

        admin = User.objects.create_superuser(
            email=admin_email,
            username=admin_email,
            password='Admin@123',
            full_name='Farm2Homez Admin',
            phone_number='+1234567890',
            role=User.Role.ADMIN,
        )
        admin.email_verified = True
        admin.is_active = True
        admin.save()

        self.stdout.write(self.style.SUCCESS(
            f'✓ Admin user created: {admin_email} (password: Admin@123)\n'
            f'  Change this password immediately in production!'
        ))

    def create_test_users(self, count=10):
        """Create test customer and seller accounts"""
        test_users = [
            {
                'email': 'customer@test.com',
                'password': 'Customer@123',
                'full_name': 'Test Customer',
                'phone_number': '+1111111111',
                'role': User.Role.CUSTOMER,
            },
            {
                'email': 'seller@test.com',
                'password': 'Seller@123',
                'full_name': 'Test Seller',
                'phone_number': '+2222222222',
                'role': User.Role.SELLER,
                'farm_name': 'Test Farm',
                'owner_name': 'Test Owner',
                'address': '123 Farm Lane',
                'district': 'Test District',
                'state': 'Test State',
            },
        ]

        created = 0
        for user_data in test_users:
            if User.objects.filter(email=user_data['email']).exists():
                self.stdout.write(self.style.WARNING(f'User {user_data["email"]} already exists'))
                continue

            password = user_data.pop('password')
            user = User.objects.create_user(**user_data, username=user_data['email'])
            user.set_password(password)
            user.email_verified = True
            user.is_active = True
            user.save()

            created += 1
            self.stdout.write(self.style.SUCCESS(f'✓ Created {user_data["role"]} user: {user_data["email"]}'))

        self.stdout.write(self.style.SUCCESS(f'\n✓ Seeding complete: {created} test users created'))
