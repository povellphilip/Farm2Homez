import getpass
import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Role, User
from apps.core import audit


class Command(BaseCommand):
    help = (
        'Provision a Farm2Home administrator. Admins can only be created this way, never through public '
        'registration. The password is read from F2H_ADMIN_PASSWORD or prompted for interactively.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--name', default='Farm2Home Admin')
        parser.add_argument(
            '--django-admin', action='store_true', help='Also grant superuser access to the /django-admin/ site.'
        )

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f'A user with email {email} already exists.')

        password = os.environ.get('F2H_ADMIN_PASSWORD')
        if not password:
            password = getpass.getpass('Password: ')
            if password != getpass.getpass('Password (again): '):
                raise CommandError('Passwords do not match.')
        try:
            validate_password(password, user=User(email=email, full_name=options['name']))
        except ValidationError as exc:
            raise CommandError(' '.join(exc.messages)) from exc

        grant = options['django_admin']
        user = User.objects.create_user(
            email=email,
            password=password,
            full_name=options['name'],
            role=Role.ADMIN,
            email_verified=True,
            is_staff=grant,
            is_superuser=grant,
        )
        audit.record('admin.provisioned', target=user, metadata={'django_admin': grant})
        self.stdout.write(self.style.SUCCESS(f'Administrator {email} created.'))
