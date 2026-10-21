from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

# Arbitrary constant identifying Farm2Home's migration lock.
LOCK_ID = 7_202_610


class Command(BaseCommand):
    help = (
        'Apply migrations and create the cache table. On PostgreSQL an advisory lock makes '
        'concurrently starting containers wait for each other instead of migrating twice.'
    )

    def handle(self, *args, **options):
        postgres = connection.vendor == 'postgresql'
        if postgres:
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_lock(%s)', [LOCK_ID])
        try:
            call_command('migrate', interactive=False, verbosity=1)
            call_command('createcachetable', verbosity=0)
        finally:
            if postgres:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_unlock(%s)', [LOCK_ID])
