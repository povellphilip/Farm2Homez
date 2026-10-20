import hashlib
import hmac

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    CONSUMER = 'CONSUMER', 'Consumer'
    PRODUCER = 'PRODUCER', 'Producer'
    ADMIN = 'ADMIN', 'Admin'


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError('An email address is required.')
        user = self.model(email=self.normalize_email(email).strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('role', Role.CONSUMER)
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=Role.ADMIN, is_staff=True, is_superuser=True, email_verified=True)
        return self._create_user(email, password, **extra)

    def get_by_natural_key(self, email):
        return self.get(email__iexact=email)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CONSUMER, db_index=True)
    email_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, help_text='Unset to suspend the account.')
    is_staff = models.BooleanField(default=False, help_text='Grants access to the Django admin site.')
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspension_reason = models.TextField(blank=True)
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    EMAIL_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        ordering = ['-date_joined']

    def save(self, *args, **kwargs):
        self.email = (self.email or '').strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email

    @property
    def is_producer(self):
        return self.role == Role.PRODUCER

    @property
    def is_consumer(self):
        return self.role == Role.CONSUMER

    @property
    def is_platform_admin(self):
        return self.role == Role.ADMIN


class OneTimeCode(models.Model):
    """Short numeric codes for email verification and password reset.
    Only an HMAC of the code is stored; attempts are capped."""

    class Purpose(models.TextChoices):
        EMAIL_VERIFICATION = 'EMAIL_VERIFICATION', 'Email verification'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Password reset'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='one_time_codes')
    purpose = models.CharField(max_length=24, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'purpose', 'used_at'])]

    def __str__(self):
        return f'{self.get_purpose_display()} code for {self.user}'

    @staticmethod
    def hash_code(code):
        return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()

    @property
    def is_usable(self):
        return self.used_at is None and self.expires_at > timezone.now() and self.attempts < settings.OTP_MAX_ATTEMPTS
