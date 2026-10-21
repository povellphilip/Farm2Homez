from django.conf import settings
from django.utils.encoding import filepath_to_uri
from storages.backends.s3 import S3Storage


class MediaStorage(S3Storage):
    """S3 storage whose public URLs are served by the site's own CDN.

    Objects are stored under the `media/` prefix of a private bucket. CloudFront routes
    `/media/*` on the site domain to that prefix, so a stored file `products/1/a.jpg` is
    served at `/media/products/1/a.jpg` - a same-origin, relative URL that needs no knowledge
    of the deployed domain. With MEDIA_PUBLIC_BASE empty, fall back to short-lived signed S3 URLs.
    """

    def url(self, name, parameters=None, expire=None, http_method=None):
        base = settings.MEDIA_PUBLIC_BASE
        if base:
            return f'{base.rstrip("/")}/{filepath_to_uri(name).lstrip("/")}'
        return super().url(name, parameters=parameters, expire=expire, http_method=http_method)
