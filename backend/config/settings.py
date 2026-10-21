"""
Farm2Home Django settings.

One module, three environments selected by DJANGO_ENV:
  development (default) - local machine, console email, local file storage
  test                  - pytest; fast hashing, in-memory cache, no throttling
  production            - requires real secrets; HTTPS, secure cookies, JSON logs
"""
from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DJANGO_ENV = config('DJANGO_ENV', default='development')
if DJANGO_ENV not in {'development', 'test', 'production'}:
    raise ImproperlyConfigured(f'Unknown DJANGO_ENV "{DJANGO_ENV}"')
IS_PRODUCTION = DJANGO_ENV == 'production'
IS_TEST = DJANGO_ENV == 'test'

DEBUG = config('DEBUG', default=DJANGO_ENV == 'development', cast=bool)
if IS_PRODUCTION and DEBUG:
    raise ImproperlyConfigured('DEBUG must be False in production.')

_DEV_SECRET = 'dev-only-insecure-secret-key-do-not-use-in-production'
SECRET_KEY = config('SECRET_KEY', default='' if IS_PRODUCTION else _DEV_SECRET)
if IS_PRODUCTION and (not SECRET_KEY or SECRET_KEY == _DEV_SECRET):
    raise ImproperlyConfigured('SECRET_KEY must be set in production.')

def _csv(name, default=''):
    """Comma-separated setting with blank entries dropped."""
    return [item for item in config(name, default=default, cast=Csv()) if item]


ALLOWED_HOSTS = _csv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver')
# Public site address for absolute links (sitemap). Empty means "derive it from the request".
FRONTEND_URL = config('FRONTEND_URL', default='' if IS_PRODUCTION else 'http://localhost:5173')

# Shared secret CloudFront adds to every request it forwards (X-Origin-Verify). When set,
# requests without it are refused and the forwarded viewer host is trusted.
ORIGIN_VERIFY_SECRET = config('ORIGIN_VERIFY_SECRET', default='')
USE_X_FORWARDED_HOST = bool(ORIGIN_VERIFY_SECRET)

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'drf_spectacular',
    'apps.core',
    'apps.accounts',
    'apps.producers',
    'apps.consumers',
    'apps.products',
    'apps.cart',
    'apps.orders',
    'apps.payments',
    'apps.inquiries',
    'apps.reviews',
    'apps.analytics',
    'apps.administration',
]

MIDDLEWARE = [
    'apps.core.middleware.OriginVerifyMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

if IS_TEST:
    MIDDLEWARE.remove('whitenoise.middleware.WhiteNoiseMiddleware')

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
_default_db = '' if IS_PRODUCTION else f'sqlite:///{BASE_DIR / "db.sqlite3"}'
DATABASE_URL = config('DATABASE_URL', default=_default_db)
if IS_PRODUCTION and not DATABASE_URL.startswith(('postgres://', 'postgresql://')):
    raise ImproperlyConfigured('Production requires a PostgreSQL DATABASE_URL.')

DATABASES = {
    'default': dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=config('DB_CONN_MAX_AGE', default=60, cast=int),
        conn_health_checks=True,
        ssl_require=config('DB_SSL_REQUIRE', default=IS_PRODUCTION, cast=bool),
    )
}
if DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql':
    DATABASES['default'].setdefault('OPTIONS', {})
    DATABASES['default']['OPTIONS'].update({'connect_timeout': 10})

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Cache (used for API throttling). Database-backed so no Redis is required;
# run `python manage.py createcachetable` once per database.
# ---------------------------------------------------------------------------
if IS_TEST:
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
            'LOCATION': 'f2h_cache',
        }
    }

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = 'accounts.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
    {'NAME': 'apps.accounts.validators.LetterAndDigitValidator'},
]
if IS_TEST:
    PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# One-time codes (email verification, password reset)
OTP_EXPIRY_MINUTES = 15
OTP_MAX_ATTEMPTS = 5

# Refresh token lives in an HttpOnly cookie scoped to the auth endpoints.
REFRESH_COOKIE_NAME = 'f2h_refresh'
REFRESH_COOKIE_PATH = '/api/auth/'
REFRESH_COOKIE_SECURE = config('REFRESH_COOKIE_SECURE', default=IS_PRODUCTION, cast=bool)
REFRESH_COOKIE_SAMESITE = 'Lax'

SIMPLE_JWT = {
    'SIGNING_KEY': config('JWT_SIGNING_KEY', default=SECRET_KEY),
    'ALGORITHM': 'HS256',
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_MINUTES', default=15, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ---------------------------------------------------------------------------
# Business rules
# ---------------------------------------------------------------------------
CURRENCY = 'INR'
# Producers must be verified by an admin before listings can be published.
PRODUCER_VERIFICATION_REQUIRED = config('PRODUCER_VERIFICATION_REQUIRED', default=True, cast=bool)
# When True, newly published listings wait for admin approval before going live.
PRODUCT_PREMODERATION = config('PRODUCT_PREMODERATION', default=False, cast=bool)
# Flat delivery fee per farm in an order, waived above the threshold (in CURRENCY).
DELIVERY_FEE_PER_PRODUCER = config('DELIVERY_FEE_PER_PRODUCER', default='49.00')
FREE_DELIVERY_THRESHOLD = config('FREE_DELIVERY_THRESHOLD', default='500.00')
# The mock online payment provider is for development only. Never enable it for real customers.
PAYMENTS_MOCK_ENABLED = config('PAYMENTS_MOCK_ENABLED', default=not IS_PRODUCTION, cast=bool)
MAX_IMAGES_PER_PRODUCT = 8
MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024

# ---------------------------------------------------------------------------
# REST framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'apps.core.exceptions.api_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/hour',
        'user': '5000/hour',
        # Overridable for automated end-to-end runs, which sign in many times a minute.
        'auth_login': config('AUTH_LOGIN_RATE', default='10/min'),
        'auth_register': '10/hour',
        'auth_code': '10/hour',
        'auth_refresh': '60/min',
        'inquiry': '20/hour',
        'checkout': '30/hour',
        'upload': '120/hour',
        'product_view': '300/hour',
    },
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
    # Number of trusted reverse proxies (CloudFront + App Runner = 2) used to read the
    # real client IP from X-Forwarded-For for throttling and audit logs.
    'NUM_PROXIES': config('NUM_PROXIES', default='', cast=lambda v: int(v) if v else None),
}
if IS_TEST:
    # Throttling is exercised explicitly in tests that need it.
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = ()

SPECTACULAR_SETTINGS = {
    'TITLE': 'Farm2Home API',
    'DESCRIPTION': 'Farm-to-consumer marketplace API: producers, consumers, catalogue, orders and administration.',
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'POSTPROCESSING_HOOKS': [
        'drf_spectacular.hooks.postprocess_schema_enums',
        'apps.core.schema.mark_response_fields_required',
    ],
    'ENUM_NAME_OVERRIDES': {
        'FulfillmentStatusEnum': 'apps.orders.models.FulfillmentStatus',
        'OrderStatusEnum': 'apps.orders.models.OrderStatus',
        'ProductStatusEnum': 'apps.products.models.ProductStatus',
        'ModerationStatusEnum': 'apps.products.models.ModerationStatus',
        'VerificationStatusEnum': 'apps.producers.models.VerificationStatus',
        'InquiryStatusEnum': 'apps.inquiries.models.InquiryStatus',
        'PaymentStatusEnum': 'apps.payments.models.PaymentStatus',
    },
}

# ---------------------------------------------------------------------------
# CORS / CSRF. In development the Vite dev server proxies /api to Django, and in
# production CloudFront serves the SPA and /api from one domain, so the browser
# normally makes same-origin requests. CORS stays available for other setups.
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = _csv('CORS_ALLOWED_ORIGINS', '' if IS_PRODUCTION else 'http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = _csv('CSRF_TRUSTED_ORIGINS', '' if IS_PRODUCTION else 'http://localhost:5173,http://127.0.0.1:5173')
CSRF_COOKIE_HTTPONLY = False  # the SPA reads it and echoes it in X-CSRFToken
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SAMESITE = 'Lax'

# ---------------------------------------------------------------------------
# Security headers (production)
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
if IS_PRODUCTION:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SECURE_REDIRECT_EXEMPT = [r'^api/health/']
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ---------------------------------------------------------------------------
# Static and media files
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {
        'BACKEND': (
            'django.contrib.staticfiles.storage.StaticFilesStorage'
            if IS_TEST
            else 'whitenoise.storage.CompressedManifestStaticFilesStorage'
        )
    },
}

# Product images: local disk in development, Amazon S3 in production. On AWS the
# credentials come from the service's IAM role; never put access keys in settings.
STORAGE_BACKEND = config('STORAGE_BACKEND', default='local')  # local | s3
AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='')
AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='ap-south-1')
# Objects are stored under this prefix; CloudFront serves it at /media/* on the site domain.
AWS_MEDIA_LOCATION = 'media'
# Base for public media URLs. '/media/' gives same-origin relative URLs through CloudFront;
# an absolute CDN URL also works; empty falls back to short-lived signed S3 URLs.
MEDIA_PUBLIC_BASE = config('MEDIA_PUBLIC_BASE', default='/media/')
# Browser uploads go to this prefix and are deleted once processed (plus a lifecycle rule).
S3_UPLOAD_PREFIX = 'uploads/'
UPLOAD_URL_EXPIRY_SECONDS = 300
if STORAGE_BACKEND == 's3':
    if not AWS_STORAGE_BUCKET_NAME:
        raise ImproperlyConfigured('STORAGE_BACKEND=s3 requires AWS_STORAGE_BUCKET_NAME.')
    STORAGES['default'] = {
        'BACKEND': 'apps.core.storage.MediaStorage',
        'OPTIONS': {
            'bucket_name': AWS_STORAGE_BUCKET_NAME,
            'region_name': AWS_S3_REGION_NAME,
            'location': AWS_MEDIA_LOCATION,
            'querystring_auth': True,  # only used when MEDIA_PUBLIC_BASE is empty
            'default_acl': None,  # the bucket stays private; CloudFront reads it via origin access control
            'file_overwrite': False,
            'object_parameters': {'CacheControl': 'public, max-age=31536000, immutable'},
        },
    }
elif STORAGE_BACKEND != 'local':
    raise ImproperlyConfigured('STORAGE_BACKEND must be "local" or "s3".')

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
if IS_TEST:
    EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
else:
    EMAIL_BACKEND = config(
        'EMAIL_BACKEND',
        default='django.core.mail.backends.smtp.EmailBackend' if IS_PRODUCTION else 'django.core.mail.backends.console.EmailBackend',
    )
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Farm2Home <no-reply@farm2home.example>')
# Receives contact-form messages addressed to the platform rather than a farm.
ADMIN_NOTIFICATION_EMAIL = config('ADMIN_NOTIFICATION_EMAIL', default='support@farm2home.example')

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Logging: readable in development, JSON to stdout in production (CloudWatch).
# ---------------------------------------------------------------------------
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'readable': {'format': '[{levelname}] {asctime} {name}: {message}', 'style': '{'},
        'json': {
            '()': 'pythonjsonlogger.json.JsonFormatter',
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'json' if IS_PRODUCTION else 'readable'},
    },
    'root': {'handlers': ['console'], 'level': config('LOG_LEVEL', default='INFO')},
    'loggers': {
        'django.request': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'apps': {'handlers': ['console'], 'level': config('APP_LOG_LEVEL', default='INFO'), 'propagate': False},
    },
}
