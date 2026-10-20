from django.db import migrations

from apps.products.catalog_data import install_default_categories


def install(apps, schema_editor):
    install_default_categories(apps.get_model('products', 'Category'))


class Migration(migrations.Migration):
    dependencies = [('products', '0001_initial')]

    operations = [migrations.RunPython(install, migrations.RunPython.noop)]
