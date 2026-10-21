from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# Security & Environment
SECRET_KEY = config('SECRET_KEY', default='unsafe-dev-secret-change-in-production')
DEBUG_RAW = str(config('DEBUG', default='True')).lower()
DEBUG = DEBUG_RAW not in ['false', '0', 'no', 'off', 'release', 'prod', 'production']
ENVIRONMENT = config('ENVIRONMENT', default='development')  # development, production

# Hosts and URLs
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')
BACKEND_URL = config('BACKEND_URL', default='http://127.0.0.1:8000')

# HTTPS & Security
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=not DEBUG, cast=bool)
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# Product image storage: 's3' on AWS (needs AWS_MEDIA_BUCKET), otherwise Cloudinary
AWS_REGION = config('AWS_REGION', default='us-east-1')
AWS_MEDIA_BUCKET = config('AWS_MEDIA_BUCKET', default='')
MEDIA_BASE_URL = config('MEDIA_BASE_URL', default='')
IMAGE_STORAGE_PROVIDER = config('IMAGE_STORAGE_PROVIDER', default='s3' if AWS_MEDIA_BUCKET else 'cloudinary')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    *(['cloudinary_storage', 'cloudinary'] if IMAGE_STORAGE_PROVIDER == 'cloudinary' else []),
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'drf_spectacular',
    'apps.accounts',
    'apps.products',
    'apps.cart',
    'apps.orders',
    'apps.reviews',
    'apps.contacts',
    'apps.communications',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'utils.exception_middleware.APIExceptionMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': dj_database_url.config(
        default=config('DATABASE_URL', default=f'sqlite:///{BASE_DIR / "db.sqlite3"}'),
        conn_max_age=600,
        conn_health_checks=True,
    )
}
# dj_database_url.config() has no OPTIONS argument, so PostgreSQL options are set afterwards
if DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql':
    DATABASES['default']['OPTIONS'] = {
        'connect_timeout': 10,
        'options': '-c statement_timeout=30000',
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'
# STATICFILES_STORAGE / DEFAULT_FILE_STORAGE were removed in Django 5.1; STORAGES replaces them
STORAGES = {
    'default': {
        'BACKEND': (
            'cloudinary_storage.storage.MediaCloudinaryStorage'
            if IMAGE_STORAGE_PROVIDER == 'cloudinary'
            else 'django.core.files.storage.FileSystemStorage'
        ),
    },
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'accounts.User'
AUTHENTICATION_BACKENDS = [
    'apps.accounts.authentication.EmailBackend',
    'django.contrib.auth.backends.ModelBackend',
]

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://.*\.vercel\.app$',
    r'^https://farm2homez\..*$',  # Custom domain
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'utils.exceptions.custom_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour'
    },
    # Behind CloudFront + ALB the real client IP is in X-Forwarded-For (2 proxies)
    'NUM_PROXIES': config('NUM_PROXIES', default=None, cast=lambda v: int(v) if v not in (None, '') else None),
}

# django-ratelimit must also see the client IP rather than the load balancer's
RATELIMIT_IP_META_KEY = 'utils.client_ip.get_client_ip'
SILENCED_SYSTEM_CHECKS = ['django_ratelimit.W001']

SIMPLE_JWT = {
    'SIGNING_KEY': config('JWT_SECRET', default=SECRET_KEY),
    'ALGORITHM': 'HS256',
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'JTI_CLAIM': 'jti',
}

EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
# Without SMTP credentials, emails (including OTP codes) are written to the app log instead
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.smtp.EmailBackend' if EMAIL_HOST_USER
    else 'django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='no-reply@farm2homez.com')
ADMIN_NOTIFICATION_EMAIL = config('ADMIN_NOTIFICATION_EMAIL', default='admin@farm2homez.com')
EMAIL_PROVIDER = config('EMAIL_PROVIDER', default='smtp')
SENDGRID_API_KEY = config('SENDGRID_API_KEY', default='')
BREVO_API_KEY = config('BREVO_API_KEY', default='')

CLOUDINARY_STORAGE = {
    'CLOUD_NAME': config('CLOUDINARY_CLOUD_NAME', default=''),
    'API_KEY': config('CLOUDINARY_API_KEY', default=''),
    'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
}

# Redis when REDIS_URL is set; otherwise a database-backed cache shared by every app server
# (run `python manage.py createcachetable` once)
REDIS_URL = config('REDIS_URL', default='')
CACHES = {
    'default': (
        {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': REDIS_URL}
        if REDIS_URL
        else {'BACKEND': 'django.core.cache.backends.db.DatabaseCache', 'LOCATION': 'django_cache'}
    )
}

# With no broker configured, Celery tasks run inline in the web request
CELERY_TASK_ALWAYS_EAGER = not config('CELERY_BROKER_URL', default='')
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='memory://')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='')
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TASK_IGNORE_RESULT = True
OTP_EXPIRY_SECONDS = 600

SPECTACULAR_SETTINGS = {
    'TITLE': 'Farm 2 Homez API',
    'DESCRIPTION': 'Backend API for customer, seller, product, cart, order, review, and admin workflows.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

WHATSAPP_PROVIDER = config('WHATSAPP_PROVIDER', default='twilio')
TWILIO_ACCOUNT_SID = config('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN = config('TWILIO_AUTH_TOKEN', default='')
TWILIO_WHATSAPP_NUMBER = config('TWILIO_WHATSAPP_NUMBER', default='')
WHATSAPP_ACCESS_TOKEN = config('WHATSAPP_ACCESS_TOKEN', default='')
WHATSAPP_PHONE_NUMBER_ID = config('WHATSAPP_PHONE_NUMBER_ID', default='')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {name} {module} {funcName} {lineno} {message}',
            'style': '{',
        },
        'standard': {
            'format': '[{levelname}] {asctime} {name}: {message}',
            'style': '{',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s',
        } if not DEBUG else None,
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose' if DEBUG else 'standard',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'farm2homez.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        } if not DEBUG else None,
    },
    'root': {
        'handlers': ['console'] if DEBUG else ['console', 'file'],
        'level': config('LOG_LEVEL', default='INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'] if DEBUG else ['console', 'file'],
            'level': config('DJANGO_LOG_LEVEL', default='INFO'),
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'] if DEBUG else ['console', 'file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'] if DEBUG else ['console', 'file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'] if DEBUG else ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# Clean up handlers without formatters
LOGGING['handlers'] = {k: v for k, v in LOGGING['handlers'].items() if v is not None}

# Ensure logs directory exists
LOGS_DIR = BASE_DIR / 'logs'
if not DEBUG:
    LOGS_DIR.mkdir(exist_ok=True)
