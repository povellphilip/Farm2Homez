"""XML sitemap of public marketplace pages, served at /api/seo/sitemap.xml."""
from xml.sax.saxutils import escape

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.cache import cache_page

from apps.producers.models import ProducerProfile, VerificationStatus

from .models import Category, Product

STATIC_PATHS = ['/', '/products', '/farms', '/about', '/faq', '/contact', '/privacy', '/terms']


@cache_page(60 * 60)
def sitemap(request):
    base = (settings.FRONTEND_URL or request.build_absolute_uri('/')).rstrip('/')
    entries = [(path, None) for path in STATIC_PATHS]
    entries += [(f'/categories/{slug}', None) for slug in Category.objects.filter(is_active=True).values_list('slug', flat=True)]
    entries += [
        (f'/products/{slug}', updated)
        for slug, updated in Product.objects.public().values_list('slug', 'updated_at').order_by('-updated_at')[:5000]
    ]
    producers = ProducerProfile.objects.filter(user__is_active=True)
    if settings.PRODUCER_VERIFICATION_REQUIRED:
        producers = producers.filter(verification_status=VerificationStatus.VERIFIED)
    entries += [(f'/farms/{slug}', updated) for slug, updated in producers.values_list('slug', 'updated_at')]

    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, updated in entries:
        lastmod = f'<lastmod>{updated.date().isoformat()}</lastmod>' if updated else ''
        lines.append(f'<url><loc>{escape(base + path)}</loc>{lastmod}</url>')
    lines.append('</urlset>')
    return HttpResponse('\n'.join(lines), content_type='application/xml')
