import secrets

from django.utils.text import slugify


def unique_slug(model, value, *, max_length=200, instance=None, field='slug'):
    """Slugify `value`, appending a short random suffix if the slug is already taken."""
    base = slugify(value)[: max_length - 7].strip('-') or 'item'
    candidate = base
    queryset = model._default_manager.all()
    if instance is not None and instance.pk:
        queryset = queryset.exclude(pk=instance.pk)
    while queryset.filter(**{field: candidate}).exists():
        candidate = f'{base}-{secrets.token_hex(3)}'
    return candidate
